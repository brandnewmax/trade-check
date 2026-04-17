export const dynamic = 'force-dynamic'

import { getGlobalSettings, getUserSettings, saveQuery } from '@/lib/kv'
import { gatherIntel, formatIntelAsBriefing } from '@/lib/intel'

// ─── SERVICE_API_KEY auth ───────────────────────────────────────────────────
function authenticateService(req) {
  const key = process.env.SERVICE_API_KEY
  if (!key) return { ok: false, status: 503, error: 'SERVICE_API_KEY not configured' }

  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token || token !== key) {
    return { ok: false, status: 401, error: 'Invalid or missing API key' }
  }
  return { ok: true }
}

export async function POST(req) {
  // Pre-stream checks: return plain JSON so auth/body errors don't get
  // swallowed inside an SSE frame. Anything past this point speaks SSE.
  const auth = authenticateService(req)
  if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status })

  let body
  try { body = await req.json() }
  catch { return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 }) }

  const { inquiry, company = {}, images = [], options = {} } = body
  if (!inquiry?.trim()) {
    return Response.json({ ok: false, error: 'inquiry is required' }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const streamStart = Date.now()
  const HEARTBEAT_MS = 8000

  const stream = new ReadableStream({
    async start(controller) {
      let heartbeatTimer = null
      let currentStage = 'queued'
      let closed = false

      const emit = (event, data) => {
        if (closed) return
        const payload = typeof data === 'string' ? data : JSON.stringify(data)
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`))
        } catch { /* stream already closed */ }
      }

      const progress = (stage) => {
        currentStage = stage
        emit('progress', { stage, elapsed_ms: Date.now() - streamStart })
      }

      const close = () => {
        if (closed) return
        closed = true
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
        try { controller.close() } catch {}
      }

      const fail = (code, message) => {
        emit('error', { code, message })
        close()
      }

      // 首字节 deadline: emit the first progress immediately so the Vercel
      // edge proxy sees traffic well before its 60s idle-timeout window.
      progress('queued')

      heartbeatTimer = setInterval(() => {
        emit('progress', { stage: currentStage, elapsed_ms: Date.now() - streamStart })
      }, HEARTBEAT_MS)

      try {
        progress('load_settings')
        const globalSettings = await getGlobalSettings()
        const baseUrl = globalSettings.baseUrl?.trim()
        if (!baseUrl) return fail('config', 'Base URL not configured on server')

        const adminEmail = process.env.ADMIN_EMAIL
        const adminSettings = await getUserSettings(adminEmail)
        const apiKey = adminSettings.apiKey?.trim()
        if (!apiKey) return fail('config', 'Admin API Key not configured')
        const modelName = adminSettings.modelName?.trim() || 'gemini-3.1-pro-preview-vertex'

        const enableIntel = options.enable_intel !== false
        if (enableIntel && !globalSettings.serpApiKey?.trim()) {
          return fail('config', 'SerpAPI Key not configured, set enable_intel: false to skip')
        }

        // ── Prepare image payloads ─────────────────────────────────────────
        progress('prepare_images')
        const preparedImages = []
        for (const img of images.slice(0, 4)) {
          if (img.base64) {
            preparedImages.push({ base64: img.base64, type: img.type || 'image/jpeg' })
          } else if (img.url) {
            try {
              const res = await fetch(img.url, { signal: AbortSignal.timeout(10_000) })
              if (res.ok) {
                const buf = await res.arrayBuffer()
                const base64 = Buffer.from(buf).toString('base64')
                preparedImages.push({ base64, type: img.type || res.headers.get('content-type') || 'image/jpeg' })
              }
            } catch { /* skip failed image downloads */ }
          }
        }

        // ── Stage 1-3: Intel pipeline ──────────────────────────────────────
        const url = company.website || ''
        let intel = null
        if (enableIntel) {
          progress('gather_intel')
          try {
            intel = await gatherIntel({
              url,
              inquiry,
              images: preparedImages,
              apiKey,
              mainModel: modelName,
              globalSettings,
              onProgress: null,
            })
          } catch (e) {
            intel = null
          }
        }

        // ── Stage 4: Main LLM analysis (synchronous, non-streaming) ───────
        progress('llm_analysis')
        const useBriefing = !!intel
        const systemPrompt = useBriefing
          ? globalSettings.systemPrompt
          : globalSettings.fallbackSystemPrompt

        const briefing = useBriefing ? formatIntelAsBriefing(intel) : ''

        const userSite = intel?.userSite
        const userContext = intel?.userContext
        let userSiteBlock
        if (userSite?.status === 'ok') {
          userSiteBlock =
            `【我方公司背景(收件方,仅供语境参考,不是调查目标)】\n` +
            `网址:${url || '未提供'}\n` +
            (userSite.title ? `网站标题:${userSite.title}\n` : '') +
            `网站摘录:${(userSite.excerpt || '').slice(0, 1500).replace(/\n/g, ' ')}\n`
          if (userContext && userContext.results?.length > 0) {
            userSiteBlock +=
              `\n我方公司网络足迹(Google 搜索 ${userContext.query}):\n` +
              userContext.results
                .map((r, i) => `  ${i + 1}. ${r.title} — ${r.link}\n     ${r.snippet || ''}`)
                .join('\n') +
              `\n`
          }
          userSiteBlock += `\n`
        } else if (company.intro) {
          userSiteBlock =
            `【我方公司背景(收件方,仅供语境参考,不是调查目标)】\n` +
            `公司名:${company.name || '未提供'}\n` +
            `网址:${url || '未提供'}\n` +
            `简介:${company.intro}\n` +
            (company.industry ? `行业:${company.industry}\n` : '') +
            (company.product_lines?.length ? `产品线:${company.product_lines.join('、')}\n` : '') +
            `\n`
        } else {
          userSiteBlock = `**我方公司网址:** ${url || '未提供'}\n\n`
        }

        const textPart =
          (briefing ? `${briefing}\n\n---\n\n` : '') +
          userSiteBlock +
          `**客户询盘内容:**\n${inquiry}`

        let userContent
        if (preparedImages.length > 0) {
          userContent = [
            { type: 'text', text: textPart },
            ...preparedImages.map(img => ({
              type: 'image_url',
              image_url: {
                url: `data:${img.type || 'image/jpeg'};base64,${img.base64}`,
                detail: 'high',
              },
            })),
          ]
        } else {
          userContent = textPart
        }

        const endpoint = baseUrl.replace(/\/$/, '') + '/chat/completions'

        let llmRes
        try {
          llmRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: modelName,
              stream: false,
              messages: [
                ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                { role: 'user', content: userContent },
              ],
            }),
          })
        } catch (e) {
          return fail('llm', `LLM connection failed: ${e.message}`)
        }

        if (!llmRes.ok) {
          let detail = ''
          try { detail = await llmRes.text() } catch {}
          try { detail = JSON.parse(detail)?.error?.message || detail } catch {}
          return fail('llm', `LLM API error ${llmRes.status}: ${String(detail).slice(0, 300)}`)
        }

        const llmJson = await llmRes.json()
        const fullText = llmJson.choices?.[0]?.message?.content || ''
        if (!fullText) return fail('llm', 'LLM returned empty content')

        // ── Post-processing ────────────────────────────────────────────────
        progress('post_process')

        // Risk level: coerce misses to "medium" so SN platform never sees
        // "unknown". If an admin's prompt or LLM drift drops the keyword,
        // we still return a valid enum and log for later quality tracking.
        const riskMatched = fullText.includes('高风险') ? 'high'
          : fullText.includes('中风险') ? 'medium'
          : fullText.includes('低风险') ? 'low'
          : null
        const riskLevel = riskMatched || 'medium'
        if (!riskMatched) {
          console.warn('[v1/analyze] risk_level keyword miss, defaulting to medium', {
            model: modelName, caller: company.name || 'external',
          })
        }

        const pickScore = (label) => {
          const re = new RegExp(label + '[^0-9]{0,30}(\\d{1,3})\\s*\\/\\s*100')
          const m = fullText.match(re)
          if (!m) return null
          const n = parseInt(m[1])
          return n >= 0 && n <= 100 ? n : null
        }
        const scores = {
          inquiry: pickScore('询盘质量分'),
          customer: pickScore('客户实力分'),
          match: pickScore('匹配度得分'),
          strategy: pickScore('综合战略分'),
        }

        const extracted = intel?.extracted || null
        const buyer = {
          company_name: extracted?.companyName || null,
          person_name: extracted?.personName || null,
          person_title: extracted?.personTitle || null,
          email: extracted?.email || null,
          phone: extracted?.phone || null,
          country: extracted?.country || null,
          company_url: extracted?.companyUrl || null,
          products: extracted?.products || [],
        }

        const tokens = {
          prompt: llmJson.usage?.prompt_tokens || null,
          completion: llmJson.usage?.completion_tokens || null,
        }

        // ── Save to history ─────────────────────────────────────────────────
        saveQuery({
          userEmail: `api:${company.name || 'external'}`,
          url: url,
          inquiry: inquiry.slice(0, 2000),
          hasImages: preparedImages.length > 0,
          imageCount: preparedImages.length,
          result: fullText,
          riskLevel,
          scoreInquiry: scores.inquiry,
          scoreCustomer: scores.customer,
          scoreMatch: scores.match,
          scoreStrategy: scores.strategy,
          customerName: buyer.company_name,
          customerUrl: buyer.company_url,
          customerEmail: buyer.email,
          customerCountry: buyer.country,
          createdAt: new Date().toISOString(),
          model: modelName,
          intel,
          intelEnabled: enableIntel,
        }).catch(() => {})

        // ── Done ────────────────────────────────────────────────────────────
        emit('done', {
          ok: true,
          data: {
            report: fullText,
            risk_level: riskLevel,
            scores,
            buyer,
            intel: intel ? {
              extracted: intel.extracted,
              website: intel.website,
              linkedin: intel.linkedin,
              facebook: intel.facebook,
              panjiva: intel.panjiva,
              negative: intel.negative,
              phone: intel.phone,
              generalSearch: intel.generalSearch,
              wayback: intel.wayback,
              meta: intel.meta,
            } : null,
            model: modelName,
            tokens,
            elapsed_ms: Date.now() - streamStart,
          },
        })
        close()
      } catch (e) {
        fail('internal', String(e?.message || e).slice(0, 300))
      }
    },
    cancel() { /* client disconnected */ },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  })
}

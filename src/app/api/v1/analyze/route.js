export const dynamic = 'force-dynamic'

import { getGlobalSettings, getUserSettings, saveQuery } from '@/lib/kv'
import { gatherIntel, formatIntelAsBriefing } from '@/lib/intel'
import { newRequestId, hashInquiry, writeObservationLog } from '@/lib/obs'
import { normalizeRequest, deriveOwnDomains } from '@/lib/requestNormalizer'
import { createLogger, previewText, runWithRequestContext } from '@/lib/logger'

const log = createLogger('route/v1-analyze')

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
  if (!auth.ok) {
    log.warn('auth_fail', { status: auth.status, error: auth.error })
    return Response.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  let body
  try { body = await req.json() }
  catch {
    log.warn('body_parse_fail')
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const normalized = normalizeRequest(body)
  const { inquiry_text, company_profile, inquiry_images, enable_intel, scan_mode } = normalized
  if (!inquiry_text?.trim()) {
    log.warn('empty_inquiry')
    return Response.json({ ok: false, error: 'inquiry is required' }, { status: 400 })
  }

  // company_profile accepts either legacy object ({ name, website, intro, ... })
  // or new string form — downstream uses companyObj/companyText consistently.
  const companyObj = (typeof company_profile === 'object' && company_profile !== null) ? company_profile : {}
  const companyText = typeof company_profile === 'string' ? company_profile : ''

  const encoder = new TextEncoder()
  const streamStart = Date.now()
  const HEARTBEAT_MS = 8000
  const requestId = normalized.request_id || newRequestId()
  const inputHash = hashInquiry(inquiry_text)

  const stream = new ReadableStream({
    async start(controller) {
      return runWithRequestContext({ requestId, route: 'v1/analyze' }, () => streamBody(controller))
    },
    cancel() { /* client disconnected */ },
  })

  async function streamBody(controller) {
      let heartbeatTimer = null
      let currentStage = 'queued'
      let closed = false

      log.start({
        scanMode: scan_mode,
        enableIntel: enable_intel,
        inquiryLen: inquiry_text.length,
        inputHash: inputHash.slice(0, 12),
        imageCount: inquiry_images.length,
        caller: companyObj.name || (typeof company_profile === 'string' ? previewText(company_profile, 60) : null),
      })
      log.info('raw_inputs', {
        inquiry_text,
        company_profile,
        inquiry_images: inquiry_images.map(img => ({
          type: img.type || null,
          hasBase64: !!img.base64,
          base64Len: img.base64 ? img.base64.length : 0,
          url: img.url || null,
        })),
      })

      // Observation log state — mutated as the request progresses.
      // recordObs() is idempotent (fires once).
      const obs = {
        enableIntel: enable_intel,
        riskLevel: null, scores: null, model: null, tokens: null,
        fired: false,
      }
      const recordObs = (status, errorCode) => {
        if (obs.fired) return
        obs.fired = true
        writeObservationLog(requestId, {
          request_id: requestId,
          timestamp: new Date().toISOString(),
          scan_mode,
          input_hash: inputHash,
          output_summary: status === 'success' ? {
            risk_level: obs.riskLevel,
            scores: obs.scores,
            model: obs.model,
            tokens: obs.tokens,
          } : null,
          elapsed_ms: Date.now() - streamStart,
          enable_intel: obs.enableIntel,
          source: 'sn_platform_api',
          status,
          error_code: errorCode,
        })
      }

      const emit = (event, data) => {
        if (closed) return
        const payload = typeof data === 'string' ? data : JSON.stringify(data)
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`))
        } catch { /* stream already closed */ }
      }

      const progress = (stage) => {
        currentStage = stage
        log.info('stage', { stage, elapsedMs: Date.now() - streamStart })
        emit('progress', { stage, elapsed_ms: Date.now() - streamStart })
      }

      const close = () => {
        if (closed) return
        closed = true
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
        try { controller.close() } catch {}
      }

      const fail = (code, message) => {
        log.fail({ stage: currentStage, code, message: previewText(message, 300) })
        emit('error', { code, message })
        close()
        recordObs('error', code)
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

        const enableIntel = enable_intel
        obs.enableIntel = enableIntel
        if (enableIntel && !globalSettings.serpApiKey?.trim()) {
          return fail('config', 'SerpAPI Key not configured, set enable_intel: false to skip')
        }

        // ── Prepare image payloads ─────────────────────────────────────────
        progress('prepare_images')
        const preparedImages = []
        for (const img of inquiry_images.slice(0, 4)) {
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
        // Derive ALL domains the seller owns from company_profile regardless
        // of whether SN passed object-form (.website) or string-form (the
        // markdown profile_report, contract §10.7). `ownDomains` feeds the
        // self-exclusion in extractEntities so the regex fallback can't
        // mis-pick the seller's own site from the inquiry text (P1).
        const ownDomains = deriveOwnDomains(company_profile)
        const url = companyObj.website || (ownDomains[0] ? `https://${ownDomains[0]}` : '')
        let intel = null
        if (enableIntel) {
          progress('gather_intel')
          try {
            intel = await gatherIntel({
              url,
              ownDomains,
              inquiry: inquiry_text,
              images: preparedImages,
              apiKey,
              mainModel: modelName,
              globalSettings,
              onProgress: null,
            })
          } catch (e) {
            log.warn('intel_threw', { error: e.message || String(e) })
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
        } else if (companyObj.intro) {
          userSiteBlock =
            `【我方公司背景(收件方,仅供语境参考,不是调查目标)】\n` +
            `公司名:${companyObj.name || '未提供'}\n` +
            `网址:${url || '未提供'}\n` +
            `简介:${companyObj.intro}\n` +
            (companyObj.industry ? `行业:${companyObj.industry}\n` : '') +
            (companyObj.product_lines?.length ? `产品线:${companyObj.product_lines.join('、')}\n` : '') +
            `\n`
        } else if (companyText) {
          userSiteBlock =
            `【我方公司背景(收件方,仅供语境参考,不是调查目标)】\n` +
            (url ? `网址:${url}\n` : '') +
            `资料:${companyText}\n\n`
        } else {
          userSiteBlock = `**我方公司网址:** ${url || '未提供'}\n\n`
        }

        const textPart =
          (briefing ? `${briefing}\n\n---\n\n` : '') +
          userSiteBlock +
          `**客户询盘内容:**\n${inquiry_text}`

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
        const tLlm = Date.now()
        log.info('llm_call', {
          model: modelName,
          useBriefing,
          hasImages: preparedImages.length > 0,
          systemPromptLen: (systemPrompt || '').length,
        })
        log.info('llm_request', {
          endpoint,
          model: modelName,
          useBriefing,
          hasImages: preparedImages.length > 0,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: typeof userContent === 'string' ? userContent : '[multimodal content]' },
          ],
        })

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
          log.fail({ phase: 'llm_http', status: llmRes.status, detail: previewText(String(detail), 300), llmMs: Date.now() - tLlm })
          return fail('llm', `LLM API error ${llmRes.status}: ${String(detail).slice(0, 300)}`)
        }

        const llmJson = await llmRes.json()
        const fullText = llmJson.choices?.[0]?.message?.content || ''
        if (!fullText) {
          log.fail({ phase: 'llm_empty', llmMs: Date.now() - tLlm })
          return fail('llm', 'LLM returned empty content')
        }
        log.info('llm_response', {
          content: fullText,
          finishReason: llmJson.choices?.[0]?.finish_reason || null,
          usage: llmJson.usage || null,
        })
        log.info('llm_ok', {
          model: modelName,
          fullTextLen: fullText.length,
          tokens: {
            prompt: llmJson.usage?.prompt_tokens || null,
            completion: llmJson.usage?.completion_tokens || null,
          },
          llmMs: Date.now() - tLlm,
        })

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
          log.warn('risk_keyword_miss', {
            defaulted: 'medium',
            model: modelName,
            caller: companyObj.name || 'external',
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
          match: pickScore('匹配度(?:得)?分'),
          strategy: pickScore('(?:综合战略|策略执行|综合|战略)分'),
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
          userEmail: `api:${companyObj.name || 'external'}`,
          url: url,
          inquiry: inquiry_text.slice(0, 2000),
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
        obs.riskLevel = riskLevel
        obs.scores = scores
        obs.model = modelName
        obs.tokens = tokens

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
        log.ok({
          riskLevel,
          scores,
          tokens,
          intelEnabled: enableIntel,
          skippedIntel: intel?.meta?.skipped?.length ?? null,
          totalMs: Date.now() - streamStart,
        })
        close()
        recordObs('success', null)
      } catch (e) {
        log.fail({ phase: 'internal', error: String(e?.message || e).slice(0, 300) })
        fail('internal', String(e?.message || e).slice(0, 300))
      }
  }

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  })
}

export const dynamic = 'force-dynamic'

import { requireSession } from '@/lib/auth'
import { getGlobalSettings, getUserSettings, saveQuery } from '@/lib/kv'
import { gatherIntel, formatIntelAsBriefing } from '@/lib/intel'
import { newRequestId, hashInquiry, writeObservationLog } from '@/lib/obs'
import { normalizeRequest } from '@/lib/requestNormalizer'

export async function POST(req) {
  const { session, error, status } = await requireSession()
  if (error) return Response.json({ error }, { status })

  let body
  try { body = await req.json() }
  catch { return Response.json({ error: '请求格式错误' }, { status: 400 }) }

  // Web frontend historically omitted enable_intel (defaulting to true).
  // Preserve that by defaulting the normalized flag to true only here.
  if (body.enable_intel === undefined && body.enableIntel === undefined && body.options?.enable_intel === undefined) {
    body = { ...body, enableIntel: true }
  }

  const normalized = normalizeRequest(body)
  const { inquiry_text, company_profile, inquiry_images, enable_intel: enableIntel, scan_mode } = normalized
  // Web frontend sends `url` as a top-level field, not part of company_profile.
  const url = (body.url || '').toString()
  const inquiry = inquiry_text
  const images = inquiry_images
  if (!url?.trim() && !inquiry?.trim() && images.length === 0) {
    return Response.json({ error: '请填写信息或上传图片' }, { status: 400 })
  }

  const [globalSettings, userSettings] = await Promise.all([
    getGlobalSettings(),
    getUserSettings(session.email),
  ])

  const baseUrl = globalSettings.baseUrl?.trim()
  const apiKey = userSettings.apiKey?.trim()
  const modelName = userSettings.modelName?.trim() || 'gemini-3.1-pro-preview-vertex'

  if (!baseUrl) return Response.json({ error: '管理员尚未配置 Base URL' }, { status: 503 })
  if (!apiKey) return Response.json({ error: '请先在【设置】中填写您的 API Key' }, { status: 400 })
  if (enableIntel && !globalSettings.serpApiKey?.trim()) {
    return Response.json({ error: '管理员尚未配置 SerpAPI Key,请关闭"实时情报检索"后重试' }, { status: 503 })
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const HEARTBEAT_INTERVAL = 8000
  const streamStart = Date.now()
  const requestId = normalized.request_id || newRequestId()
  const inputHash = hashInquiry(inquiry)

  const stream = new ReadableStream({
    async start(controller) {
      let heartbeatTimer = null
      let currentStage = 'init'

      // Observation log state — mutated as the request progresses.
      // recordObs() is idempotent (fires once).
      const obs = {
        enableIntel: !!enableIntel,
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
          source: 'web_frontend',
          status,
          error_code: errorCode,
        })
      }

      const enqueue = (obj) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)) } catch {}
      }
      heartbeatTimer = setInterval(() => {
        enqueue({ type: 'heartbeat', stage: currentStage, elapsed: Date.now() - streamStart })
      }, HEARTBEAT_INTERVAL)

      // ── Stage 1-3: intel ─────────────────────────────────────────────────
      let intel = null
      if (enableIntel) {
        currentStage = 'intel'
        try {
          intel = await gatherIntel({
            url,
            inquiry,
            images,
            apiKey,
            mainModel: modelName,
            globalSettings,
            onProgress: (partial) => enqueue({ type: 'intel', partial }),
          })
          enqueue({ type: 'intelDone', intel })
        } catch (e) {
          enqueue({ type: 'intelError', error: e.message || String(e) })
          intel = null
        }
      }

      // ── Stage 4: main LLM ────────────────────────────────────────────────
      currentStage = 'analysis'
      const useBriefing = !!intel
      const systemPrompt = useBriefing
        ? globalSettings.systemPrompt
        : globalSettings.fallbackSystemPrompt

      const briefing = useBriefing ? formatIntelAsBriefing(intel) : ''

      // Inject the user's own site content + Google search hits as a
      // separate context block so the LLM can distinguish "us" from "the
      // sender being investigated" and has richer grounding about our
      // actual business (used when the target has a sparse footprint).
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
      } else {
        userSiteBlock = `**我方公司网址:** ${url || '未提供'}\n\n`
      }

      const textPart =
        (briefing ? `${briefing}\n\n---\n\n` : '') +
        userSiteBlock +
        `**客户询盘内容:**\n${inquiry || '未提供'}`

      let userContent
      if (images.length > 0) {
        userContent = [
          { type: 'text', text: textPart },
          ...images.map(img => ({
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

      let upstreamRes
      try {
        upstreamRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            stream: true,
            stream_options: { include_usage: true },
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              { role: 'user', content: userContent },
            ],
          }),
        })
      } catch (e) {
        enqueue({ type: 'error', error: `无法连接到 API：${e.message}` })
        clearInterval(heartbeatTimer)
        try { controller.close() } catch {}
        recordObs('error', 'llm')
        return
      }

      if (!upstreamRes.ok) {
        let detail = ''
        try { detail = await upstreamRes.text() } catch {}
        try { detail = JSON.parse(detail)?.error?.message || detail } catch {}
        enqueue({ type: 'error', error: `API 错误 ${upstreamRes.status}：${String(detail).slice(0, 300)}` })
        clearInterval(heartbeatTimer)
        try { controller.close() } catch {}
        recordObs('error', 'llm')
        return
      }

      const reader = upstreamRes.body.getReader()
      let fullText = ''
      let buffer = ''
      let llmUsage = null

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content || ''
              if (delta) {
                fullText += delta
                enqueue({ type: 'delta', delta })
              }
              // Token usage typically arrives in the final chunk when
              // stream_options.include_usage is true. Keep the latest non-null.
              if (parsed.usage) llmUsage = parsed.usage
            } catch {}
          }
        }
      } catch (e) {
        enqueue({ type: 'error', error: `流中断：${e.message}` })
      } finally {
        clearInterval(heartbeatTimer)

        if (fullText) {
          const riskMatched = fullText.includes('高风险') ? 'high'
            : fullText.includes('中风险') ? 'medium'
            : fullText.includes('低风险') ? 'low'
            : null
          const riskLevel = riskMatched || 'medium'
          if (!riskMatched) {
            console.warn('[analyze] risk_level keyword miss, defaulting to medium', {
              model: modelName, email: session.email,
            })
          }

          const pickScore = (label) => {
            const re = new RegExp(label + '[^0-9]{0,30}(\\d{1,3})\\s*\\/\\s*100')
            const m = fullText.match(re)
            if (!m) return null
            const n = parseInt(m[1])
            return n >= 0 && n <= 100 ? n : null
          }
          const scoreInquiry = pickScore('询盘质量分')
          const scoreCustomer = pickScore('客户实力分')
          const scoreMatch = pickScore('匹配度(?:得)?分')
          const scoreStrategy = pickScore('(?:综合战略|策略执行|综合|战略)分')

          const tokens = {
            prompt: llmUsage?.prompt_tokens ?? null,
            completion: llmUsage?.completion_tokens ?? null,
          }

          enqueue({ type: 'done', result: fullText, riskLevel, intel, tokens })

          const extracted = intel?.extracted || null
          saveQuery({
            userEmail: session.email,
            url: url?.trim() || '',
            inquiry: inquiry?.trim() || '',
            hasImages: images.length > 0,
            imageCount: images.length,
            result: fullText,
            riskLevel,
            scoreInquiry,
            scoreCustomer,
            scoreMatch,
            scoreStrategy,
            customerName: extracted?.companyName || null,
            customerUrl: extracted?.companyUrl || null,
            customerEmail: extracted?.email || null,
            customerCountry: extracted?.country || null,
            createdAt: new Date().toISOString(),
            model: modelName,
            intel,
            intelEnabled: enableIntel,
          }).catch(() => {})

          obs.riskLevel = riskLevel
          obs.scores = { inquiry: scoreInquiry, customer: scoreCustomer, match: scoreMatch, strategy: scoreStrategy }
          obs.model = modelName
          obs.tokens = tokens
          recordObs('success', null)
        } else {
          enqueue({ type: 'error', error: 'AI 返回空内容,请检查 Model Name 是否正确' })
          recordObs('error', 'llm')
        }
        try { controller.close() } catch {}
      }
    },
    cancel() {}
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  })
}

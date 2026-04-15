export const dynamic = 'force-dynamic'

import { requireSession } from '@/lib/auth'
import { getGlobalSettings, getUserSettings, saveQuery } from '@/lib/kv'
import { gatherIntel, formatIntelAsBriefing } from '@/lib/intel'

export async function POST(req) {
  const { session, error, status } = await requireSession()
  if (error) return Response.json({ error }, { status })

  let body
  try { body = await req.json() }
  catch { return Response.json({ error: '请求格式错误' }, { status: 400 }) }

  const { url, inquiry, images = [], enableIntel = true } = body
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

  const stream = new ReadableStream({
    async start(controller) {
      let heartbeatTimer = null
      const enqueue = (obj) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)) } catch {}
      }
      const enqueueRaw = (s) => {
        try { controller.enqueue(encoder.encode(s)) } catch {}
      }
      heartbeatTimer = setInterval(() => enqueueRaw(': ping\n\n'), HEARTBEAT_INTERVAL)

      // ── Stage 1-3: intel ─────────────────────────────────────────────────
      let intel = null
      if (enableIntel) {
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
        return
      }

      if (!upstreamRes.ok) {
        let detail = ''
        try { detail = await upstreamRes.text() } catch {}
        try { detail = JSON.parse(detail)?.error?.message || detail } catch {}
        enqueue({ type: 'error', error: `API 错误 ${upstreamRes.status}：${String(detail).slice(0, 300)}` })
        clearInterval(heartbeatTimer)
        try { controller.close() } catch {}
        return
      }

      const reader = upstreamRes.body.getReader()
      let fullText = ''
      let buffer = ''

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
            } catch {}
          }
        }
      } catch (e) {
        enqueue({ type: 'error', error: `流中断：${e.message}` })
      } finally {
        clearInterval(heartbeatTimer)

        if (fullText) {
          const riskLevel = fullText.includes('高风险') ? 'high'
            : fullText.includes('中风险') ? 'medium'
            : fullText.includes('低风险') ? 'low'
            : 'unknown'

          const pickScore = (label) => {
            const re = new RegExp(label + '[^0-9]{0,30}(\\d{1,3})\\s*\\/\\s*100')
            const m = fullText.match(re)
            if (!m) return null
            const n = parseInt(m[1])
            return n >= 0 && n <= 100 ? n : null
          }
          const scoreInquiry = pickScore('询盘质量分')
          const scoreCustomer = pickScore('客户实力分')
          const scoreMatch = pickScore('匹配度得分')
          const scoreStrategy = pickScore('综合战略分')

          enqueue({ type: 'done', result: fullText, riskLevel, intel })

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
        } else {
          enqueue({ type: 'error', error: 'AI 返回空内容,请检查 Model Name 是否正确' })
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

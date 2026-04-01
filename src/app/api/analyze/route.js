export const dynamic = 'force-dynamic'

import { requireSession } from '@/lib/auth'
import { getGlobalSettings, getUserSettings, saveQuery } from '@/lib/kv'

export async function POST(req) {
  const { session, error, status } = await requireSession()
  if (error) return Response.json({ error }, { status })

  let body
  try { body = await req.json() }
  catch { return Response.json({ error: '请求格式错误' }, { status: 400 }) }

  const { url, inquiry } = body
  if (!url?.trim() && !inquiry?.trim()) {
    return Response.json({ error: '请至少填写公司网址或询盘信息' }, { status: 400 })
  }

  const [globalSettings, userSettings] = await Promise.all([
    getGlobalSettings(),
    getUserSettings(session.email),
  ])

  const baseUrl = globalSettings.baseUrl?.trim()
  const systemPrompt = globalSettings.systemPrompt || ''
  const apiKey = userSettings.apiKey?.trim()
  const modelName = userSettings.modelName?.trim() || 'gpt-4o'

  if (!baseUrl) return Response.json({ error: '管理员尚未配置 Base URL' }, { status: 503 })
  if (!apiKey) return Response.json({ error: '请先在【设置】中填写您的 API Key' }, { status: 400 })

  const endpoint = baseUrl.replace(/\/$/, '') + '/chat/completions'
  const userContent = `**公司网址：** ${url || '未提供'}\n\n**询盘详细信息：**\n${inquiry || '未提供'}`

  let upstreamRes
  try {
    upstreamRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
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
    return Response.json({ error: `无法连接到 API：${e.message}` }, { status: 502 })
  }

  if (!upstreamRes.ok) {
    let detail = ''
    try { detail = await upstreamRes.text() } catch {}
    try { detail = JSON.parse(detail)?.error?.message || detail } catch {}
    return Response.json({ error: `API 错误 ${upstreamRes.status}：${detail.slice(0, 300)}` }, { status: 502 })
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  // Heartbeat: send a comment line every 15s to keep the connection alive
  // SSE comment lines (": ping\n\n") are ignored by the client but prevent proxy timeouts
  const HEARTBEAT_INTERVAL = 15000
  let heartbeatTimer = null

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data) => {
        try { controller.enqueue(encoder.encode(data)) } catch {}
      }

      // Start heartbeat
      heartbeatTimer = setInterval(() => {
        enqueue(': ping\n\n')
      }, HEARTBEAT_INTERVAL)

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
                enqueue(`data: ${JSON.stringify({ delta })}\n\n`)
              }
            } catch {}
          }
        }
      } catch (e) {
        enqueue(`data: ${JSON.stringify({ error: `流中断：${e.message}` })}\n\n`)
      } finally {
        clearInterval(heartbeatTimer)

        if (fullText) {
          const riskLevel = fullText.includes('高风险') ? 'high'
            : fullText.includes('中风险') ? 'medium'
            : fullText.includes('低风险') ? 'low' : 'unknown'

          enqueue(`data: ${JSON.stringify({ done: true, result: fullText, riskLevel })}\n\n`)

          saveQuery({
            userEmail: session.email,
            url: url?.trim() || '',
            inquiry: inquiry?.trim() || '',
            result: fullText,
            riskLevel,
            createdAt: new Date().toISOString(),
            model: modelName,
          }).catch(() => {})
        } else {
          enqueue(`data: ${JSON.stringify({ error: 'AI 返回空内容，请检查 Model Name 是否正确' })}\n\n`)
        }

        try { controller.close() } catch {}
      }
    },

    cancel() {
      clearInterval(heartbeatTimer)
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  })
}

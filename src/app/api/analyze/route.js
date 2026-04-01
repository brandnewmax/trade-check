import { requireSession } from '@/lib/auth'
import { getGlobalSettings, getUserSettings, saveQuery } from '@/lib/kv'

export const maxDuration = 60

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
        stream: false,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: userContent },
        ],
      }),
    })
  } catch (e) {
    return Response.json({ error: `无法连接到 API (${endpoint})：${e.message}` }, { status: 502 })
  }

  // Read raw text first — never assume JSON
  let rawText = ''
  try { rawText = await upstreamRes.text() } catch (e) {
    return Response.json({ error: `读取 API 响应失败：${e.message}` }, { status: 502 })
  }

  if (!upstreamRes.ok) {
    // Try to extract message from JSON error body
    let detail = rawText
    try { detail = JSON.parse(rawText)?.error?.message || rawText } catch {}
    return Response.json({
      error: `上游 API 错误 ${upstreamRes.status}：${detail.slice(0, 300)}`
    }, { status: 502 })
  }

  // Parse successful response
  let result = ''
  try {
    const parsed = JSON.parse(rawText)
    result = parsed.choices?.[0]?.message?.content || ''
  } catch {
    return Response.json({
      error: `API 返回了非 JSON 内容：${rawText.slice(0, 300)}`
    }, { status: 502 })
  }

  if (!result) {
    return Response.json({ error: 'AI 返回空内容，请检查 Model Name 是否正确' }, { status: 502 })
  }

  const riskLevel = result.includes('高风险') ? 'high'
    : result.includes('中风险') ? 'medium'
    : result.includes('低风险') ? 'low' : 'unknown'

  await saveQuery({
    userEmail: session.email,
    url: url?.trim() || '',
    inquiry: inquiry?.trim() || '',
    result,
    riskLevel,
    createdAt: new Date().toISOString(),
    model: modelName,
  }).catch(console.error)

  return Response.json({ result, riskLevel })
}

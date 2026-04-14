// Calls the lightweight extraction LLM and parses a structured JSON result.
// Pure parser (`parseExtractionJson`) is exported for testing.

const FIELDS = ['companyName', 'personName', 'personTitle', 'email', 'phone', 'country', 'products']

export function parseExtractionJson(raw) {
  if (!raw || typeof raw !== 'string') return null

  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) text = fence[1].trim()

  let obj = null
  try { obj = JSON.parse(text) } catch {}

  if (!obj) {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      try { obj = JSON.parse(m[0]) } catch {}
    }
  }

  if (!obj || typeof obj !== 'object') return null

  const out = {}
  for (const f of FIELDS) {
    if (f === 'products') out.products = Array.isArray(obj.products) ? obj.products.map(String) : []
    else out[f] = obj[f] ?? null
  }
  return out
}

export async function extractEntities({ inquiry, websiteText, baseUrl, apiKey, model, systemPrompt }) {
  if (!baseUrl || !apiKey) {
    return { status: 'skipped', error: 'missing baseUrl or apiKey', extracted: null }
  }

  const userContent =
    `【询盘文本】\n${inquiry || '(无)'}\n\n` +
    `【网站正文摘录】\n${websiteText || '(未抓取)'}`

  const endpoint = baseUrl.replace(/\/$/, '') + '/chat/completions'

  let res
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: false,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    })
  } catch (e) {
    return { status: 'failed', error: e.message || String(e), extracted: null }
  }

  if (!res.ok) {
    let detail = ''
    try { detail = await res.text() } catch {}
    return { status: 'failed', error: `HTTP ${res.status}: ${detail.slice(0, 200)}`, extracted: null }
  }

  let json
  try { json = await res.json() } catch (e) {
    return { status: 'failed', error: 'non-json response', extracted: null }
  }

  const content = json?.choices?.[0]?.message?.content ?? ''
  const extracted = parseExtractionJson(content)
  if (!extracted) return { status: 'failed', error: 'parse failed', extracted: null, raw: content }

  return { status: 'ok', extracted }
}

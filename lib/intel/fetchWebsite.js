// Fetches a user-supplied URL and extracts a coarse text excerpt.
// Returns { status, title, excerpt, siteName, error }.

const USER_AGENT = 'Mozilla/5.0 (compatible; TradeCheckBot/1.0; +https://trade-check.local)'
const TIMEOUT_MS = 8000
const MAX_HTML_BYTES = 500_000
const EXCERPT_CHARS = 3000

function normalizeUrl(input) {
  if (!input) return null
  let u = String(input).trim()
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  try {
    return new URL(u).toString()
  } catch {
    return null
  }
}

function extractTag(html, re) {
  const m = html.match(re)
  return m ? m[1].trim() : null
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function fetchWebsite(rawUrl) {
  const url = normalizeUrl(rawUrl)
  if (!url) return { status: 'skipped', error: 'no url' }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    })
    if (!res.ok) return { status: 'failed', error: `HTTP ${res.status}` }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: false })
    let html = ''
    let received = 0
    while (received < MAX_HTML_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      html += decoder.decode(value, { stream: true })
    }
    try { reader.cancel() } catch {}

    if (html.length > MAX_HTML_BYTES) {
      html = html.slice(0, MAX_HTML_BYTES)
    }

    const title = extractTag(html, /<title[^>]*>([^<]*)<\/title>/i)
    const siteName = extractTag(
      html,
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i
    )
    const body = stripHtml(html).slice(0, EXCERPT_CHARS)

    return {
      status: 'ok',
      url,
      title: title || null,
      siteName: siteName || null,
      excerpt: body,
    }
  } catch (e) {
    return { status: 'failed', error: e.message || String(e) }
  }
}

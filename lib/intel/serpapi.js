// Low-level SerpAPI client. One call = one search. Increments monthly usage
// counter on every call.

import { incrSerpUsage } from '@/lib/kv'

const TIMEOUT_MS = 10_000
const ENDPOINT = 'https://serpapi.com/search.json'

export async function serpSearch({ query, apiKey, num = 5, engine = 'google', extra = {} }) {
  if (!apiKey) return { ok: false, error: 'missing serpApiKey' }
  if (!query) return { ok: false, error: 'empty query' }

  const params = new URLSearchParams({
    engine,
    q: query,
    api_key: apiKey,
    num: String(num),
    hl: 'en',
    ...extra,
  })

  try {
    const res = await fetch(`${ENDPOINT}?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      let detail = ''
      try { detail = await res.text() } catch {}
      const safe = detail.replace(/api_key=[^&\s"']+/gi, 'api_key=***')
      return { ok: false, error: `HTTP ${res.status}: ${safe.slice(0, 200)}` }
    }

    const json = await res.json()
    if (json.error) return { ok: false, error: json.error }

    const organic = Array.isArray(json.organic_results) ? json.organic_results : []
    const results = organic.slice(0, num).map(r => ({
      title: r.title || '',
      link: r.link || '',
      snippet: r.snippet || '',
    }))
    const totalResults = Number(json.search_information?.total_results ?? results.length)

    incrSerpUsage().catch(() => {})
    return { ok: true, query, results, totalResults }
  } catch (e) {
    const msg = (e.message || String(e)).replace(/api_key=[^&\s"']+/gi, 'api_key=***')
    return { ok: false, error: msg }
  }
}

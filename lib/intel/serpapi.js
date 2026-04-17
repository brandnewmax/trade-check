// Low-level Serper.dev client. One call = one search. Increments monthly
// usage counter on every successful call. (File kept as serpapi.js for
// backwards compatibility with existing imports and the serpapi:usage Redis
// key namespace.)

import { incrSerpUsage } from '@/lib/kv'

const TIMEOUT_MS = 10_000
const ENDPOINT = 'https://google.serper.dev/search'
const MAPS_ENDPOINT = 'https://google.serper.dev/maps'

export async function serpSearch({ query, apiKey, num = 5, extra = {} }) {
  if (!apiKey) return { ok: false, error: 'missing serper apiKey' }
  if (!query) return { ok: false, error: 'empty query' }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num, gl: 'us', hl: 'en', ...extra }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      let detail = ''
      try { detail = await res.text() } catch {}
      // Redact any long hex blob that could resemble a leaked key
      const safe = detail.replace(/[A-Fa-f0-9]{32,}/g, '***')
      return { ok: false, error: `HTTP ${res.status}: ${safe.slice(0, 200)}` }
    }

    const json = await res.json()

    const organic = Array.isArray(json.organic) ? json.organic : []
    const results = organic.slice(0, num).map(r => ({
      title: r.title || '',
      link: r.link || '',
      snippet: r.snippet || '',
    }))
    const totalResults = Number(json.searchInformation?.totalResults ?? results.length)

    incrSerpUsage().catch(() => {})
    return { ok: true, query, results, totalResults }
  } catch (e) {
    const msg = (e.message || String(e)).replace(/[A-Fa-f0-9]{32,}/g, '***')
    return { ok: false, error: msg }
  }
}

// Serper Google Maps endpoint. Returns Place objects, not organic web results.
// Each place: { title, address, phoneNumber, website, category, rating,
// ratingCount, latitude, longitude, thumbnailUrl, cid }
export async function mapsSearch({ query, apiKey, num = 5 }) {
  if (!apiKey) return { ok: false, error: 'missing serper apiKey' }
  if (!query) return { ok: false, error: 'empty query' }

  try {
    const res = await fetch(MAPS_ENDPOINT, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, gl: 'us', hl: 'en' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      let detail = ''
      try { detail = await res.text() } catch {}
      const safe = detail.replace(/[A-Fa-f0-9]{32,}/g, '***')
      return { ok: false, error: `HTTP ${res.status}: ${safe.slice(0, 200)}` }
    }

    const json = await res.json()
    const places = Array.isArray(json.places) ? json.places : []
    const results = places.slice(0, num).map(p => ({
      title: p.title || '',
      address: p.address || '',
      phoneNumber: p.phoneNumber || '',
      website: p.website || '',
      category: p.category || '',
      rating: typeof p.rating === 'number' ? p.rating : null,
      ratingCount: typeof p.ratingCount === 'number' ? p.ratingCount : null,
      latitude: typeof p.latitude === 'number' ? p.latitude : null,
      longitude: typeof p.longitude === 'number' ? p.longitude : null,
      cid: p.cid || '',
    }))

    incrSerpUsage().catch(() => {})
    return { ok: true, query, results }
  } catch (e) {
    const msg = (e.message || String(e)).replace(/[A-Fa-f0-9]{32,}/g, '***')
    return { ok: false, error: msg }
  }
}

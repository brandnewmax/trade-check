// Low-level Serper.dev client. One call = one search. Increments monthly
// usage counter on every successful call. (File kept as serpapi.js for
// backwards compatibility with existing imports and the serpapi:usage Redis
// key namespace.)

import { incrSerpUsage } from '@/lib/kv'
import { createLogger, previewText } from '@/lib/logger'

const log = createLogger('intel/serpapi')

const TIMEOUT_MS = 10_000
const ENDPOINT = 'https://google.serper.dev/search'

// ─── Rate limiter (token bucket, 5 requests/second) ─────────────────────────
// Module-level singleton — shared across requests within the same Vercel
// Fluid Compute instance. No external dependencies.
const RATE_RPS = 5
const rateBucket = { tokens: RATE_RPS, last: Date.now() }
const rateQueue = []

function refillBucket() {
  const now = Date.now()
  const elapsed = now - rateBucket.last
  rateBucket.tokens = Math.min(RATE_RPS, rateBucket.tokens + (elapsed / 1000) * RATE_RPS)
  rateBucket.last = now
}

function drainQueue() {
  while (rateQueue.length > 0) {
    refillBucket()
    if (rateBucket.tokens < 1) {
      const waitMs = Math.ceil((1 - rateBucket.tokens) / RATE_RPS * 1000)
      setTimeout(drainQueue, waitMs)
      return
    }
    rateBucket.tokens -= 1
    const resolve = rateQueue.shift()
    resolve()
  }
}

function acquireToken() {
  return new Promise((resolve) => {
    refillBucket()
    if (rateBucket.tokens >= 1) {
      rateBucket.tokens -= 1
      resolve()
    } else {
      rateQueue.push(resolve)
      if (rateQueue.length === 1) {
        const waitMs = Math.ceil((1 - rateBucket.tokens) / RATE_RPS * 1000)
        setTimeout(drainQueue, waitMs)
      }
    }
  })
}

export async function serpSearch({ query, apiKey, num = 5, extra = {} }) {
  const t0 = Date.now()
  const queryPreview = previewText(query, 100)

  if (!apiKey) {
    log.skip({ reason: 'missing apiKey', query: queryPreview })
    return { ok: false, error: 'missing serper apiKey' }
  }
  if (!query) {
    log.skip({ reason: 'empty query' })
    return { ok: false, error: 'empty query' }
  }

  log.start({ query: queryPreview, num })

  try {
    const tAcquire = Date.now()
    await acquireToken()
    const waitMs = Date.now() - tAcquire
    if (waitMs > 50) {
      log.info('rate_wait', { query: queryPreview, waitMs })
    }

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
      log.fail({
        query: queryPreview,
        status: res.status,
        detail: previewText(safe, 200),
        durationMs: Date.now() - t0,
      })
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
    log.ok({
      query: queryPreview,
      resultCount: results.length,
      totalResults,
      durationMs: Date.now() - t0,
    })
    return { ok: true, query, results, totalResults }
  } catch (e) {
    const msg = (e.message || String(e)).replace(/[A-Fa-f0-9]{32,}/g, '***')
    log.fail({ query: queryPreview, error: msg, durationMs: Date.now() - t0 })
    return { ok: false, error: msg }
  }
}

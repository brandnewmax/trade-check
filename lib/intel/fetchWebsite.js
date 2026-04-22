// Fetches a user-supplied URL and extracts a coarse text excerpt.
// Returns { status, source?, url?, title?, siteName?, excerpt?, error? }.
//
// P2 fixes:
//   - Browser User-Agent (was SnapCheckBot, which most Cloudflare/WAF
//     configs block on sight). Paired with Accept / Accept-Language so
//     the request looks like a normal browser.
//   - Cloudflare / anti-bot challenge markers are detected in the HTML
//     body even when HTTP 200 is returned; such responses become
//     `failed` with a clear error code.
//   - HTTP 403 / 429 / 503 are recognized as blocking signals (not
//     just generic !ok errors).
//   - Optional SerpAPI fallback: when `enableSerpFallback: true` and
//     direct fetch is blocked, run a `site:<host>` Serper search and
//     aggregate title+snippet of the top results into a pseudo-excerpt.
//     This is what the `/api/v1/profile` route already does inline; it
//     is now shared so `/api/v1/analyze`'s target-website step can use
//     the same recovery path.

import { createLogger, previewText } from '@/lib/logger'
import { serpSearch } from '@/lib/intel/serpapi'

const log = createLogger('intel/fetchWebsite')

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const TIMEOUT_MS = 10000
const MAX_HTML_BYTES = 2 * 1024 * 1024
const EXCERPT_CHARS = 3000
const MIN_EXCERPT_CHARS = 200

// HTTP status codes that strongly suggest the site is intentionally
// blocking bot / unknown clients. These trigger the SerpAPI fallback
// when enabled (rather than bubbling up as a terminal failure).
const BLOCKED_STATUS = new Set([403, 429, 503])

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

function hostOfUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
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
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
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

// Classic Cloudflare / WAF challenge markers. When a server returns 200
// but the body is actually a JS challenge page, treat it as blocked.
const CHALLENGE_MARKERS = /cf-chl|cf-browser-verification|Just a moment\.{3}|cf-turnstile|Checking your browser/i

async function directFetch(url) {
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    })

    if (BLOCKED_STATUS.has(res.status)) {
      log.fail({ url, reason: 'blocked_status', status: res.status, durationMs: Date.now() - t0 })
      return { ok: false, blocked: true, error: `blocked: HTTP ${res.status}` }
    }
    if (!res.ok) {
      log.fail({ url, reason: `HTTP ${res.status}`, durationMs: Date.now() - t0 })
      return { ok: false, blocked: false, error: `HTTP ${res.status}` }
    }

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

    if (CHALLENGE_MARKERS.test(html)) {
      log.fail({ url, reason: 'cloudflare_challenge', bytes: received, durationMs: Date.now() - t0 })
      return { ok: false, blocked: true, error: 'blocked: cloudflare challenge' }
    }

    const title = extractTag(html, /<title[^>]*>([^<]*)<\/title>/i)
    const siteName = extractTag(
      html,
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i
    )
    const body = stripHtml(html).slice(0, EXCERPT_CHARS)

    log.info('fetch_full', { excerpt: body, title, siteName: siteName || null })
    log.ok({
      url,
      bytes: received,
      title: previewText(title, 80),
      siteName,
      excerptLen: body.length,
      durationMs: Date.now() - t0,
    })
    return {
      ok: true,
      blocked: false,
      result: {
        title: title || null,
        siteName: siteName || null,
        excerpt: body,
      },
    }
  } catch (e) {
    const error = e.message || String(e)
    log.fail({ url, error, durationMs: Date.now() - t0 })
    return { ok: false, blocked: false, error }
  }
}

async function serpSiteFallback(url, serpKey) {
  const t0 = Date.now()
  const host = hostOfUrl(url)
  if (!host) {
    log.info('serp_fallback_skip', { reason: 'no host' })
    return null
  }
  if (!serpKey) {
    log.info('serp_fallback_skip', { reason: 'no serpKey' })
    return null
  }

  const r = await serpSearch({ query: `site:${host}`, apiKey: serpKey, num: 10 })
  if (!r.ok || !r.results?.length) {
    log.warn('serp_fallback_empty', {
      host,
      error: r.error || null,
      durationMs: Date.now() - t0,
    })
    return null
  }

  const aggregated = r.results
    .map((x, i) => {
      const parts = []
      if (x.title) parts.push(x.title)
      if (x.snippet) parts.push(x.snippet)
      return `${i + 1}. ${parts.join(' — ')}`
    })
    .join('\n')

  if (aggregated.length < MIN_EXCERPT_CHARS) {
    log.warn('serp_fallback_too_short', { host, aggregatedLen: aggregated.length })
    return null
  }

  log.ok({
    host,
    source: 'serp_fallback',
    resultCount: r.results.length,
    excerptLen: aggregated.length,
    durationMs: Date.now() - t0,
  })

  // Top result's title as a reasonable proxy for the site name/title.
  const topTitle = r.results[0]?.title || null
  return {
    title: topTitle,
    siteName: null,
    excerpt: aggregated,
  }
}

export async function fetchWebsite(rawUrl, opts = {}) {
  const { enableSerpFallback = false, serpKey = null } = opts
  const url = normalizeUrl(rawUrl)
  if (!url) {
    log.skip({ reason: 'no url', rawUrl: previewText(rawUrl, 80) })
    return { status: 'skipped', error: 'no url' }
  }
  log.start({ url, enableSerpFallback })

  const direct = await directFetch(url)
  if (direct.ok) {
    return {
      status: 'ok',
      source: 'direct_fetch',
      url,
      ...direct.result,
    }
  }

  // Direct fetch failed. Try SerpAPI aggregation ONLY when the caller
  // opted in AND the failure looks like a block (WAF / CF / 4xx-5xx
  // gating). DNS / timeout / generic errors don't benefit from retry
  // via Serper either, so we still attempt fallback on those if opted
  // in — the call is cheap (1 Serper credit) and the /profile route
  // already validated this recovery path is worth it.
  if (enableSerpFallback) {
    const fb = await serpSiteFallback(url, serpKey)
    if (fb) {
      return {
        status: 'ok',
        source: 'serp_fallback',
        url,
        ...fb,
      }
    }
  }

  return { status: 'failed', error: direct.error || 'fetch failed' }
}

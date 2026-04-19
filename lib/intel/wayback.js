// Queries archive.org CDX API to find the earliest snapshot
// of the user-supplied URL. Returns { status, firstSnapshot, ageYears, error }.

import { createLogger, previewText } from '@/lib/logger'

const log = createLogger('intel/wayback')

const TIMEOUT_MS = 12000

function domainOf(rawUrl) {
  try {
    const u = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://' + rawUrl)
    return u.hostname
  } catch {
    return null
  }
}

function parseTimestamp(ts) {
  if (!ts || ts.length < 8) return null
  const y = ts.slice(0, 4), m = ts.slice(4, 6), d = ts.slice(6, 8)
  return `${y}-${m}-${d}`
}

export async function waybackFirstSnapshot(rawUrl) {
  const t0 = Date.now()
  const domain = domainOf(rawUrl)
  if (!domain) {
    log.skip({ reason: 'no url', rawUrl: previewText(rawUrl, 80) })
    return { status: 'skipped', error: 'no url' }
  }
  log.start({ domain })

  try {
    // CDX API: returns earliest snapshot sorted by date, limit 1
    const api = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}&output=json&limit=1&fl=timestamp&from=19960101`
    const res = await fetch(api, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) {
      log.fail({ domain, reason: `HTTP ${res.status}`, durationMs: Date.now() - t0 })
      return { status: 'failed', error: `HTTP ${res.status}` }
    }

    const json = await res.json()
    // CDX returns [[header], [row]] — first row is header, second is data
    if (!Array.isArray(json) || json.length < 2 || !json[1]?.[0]) {
      log.ok({ domain, firstSnapshot: null, note: 'no snapshots', durationMs: Date.now() - t0 })
      return { status: 'ok', firstSnapshot: null, ageYears: null }
    }

    const ts = json[1][0]
    const iso = parseTimestamp(ts)
    const snapDate = new Date(iso)
    const ageMs = Date.now() - snapDate.getTime()
    const ageYears = Math.round((ageMs / (365.25 * 24 * 3600 * 1000)) * 10) / 10

    log.ok({ domain, firstSnapshot: iso, ageYears, durationMs: Date.now() - t0 })
    return { status: 'ok', firstSnapshot: iso, ageYears }
  } catch (e) {
    const error = e.message || String(e)
    log.fail({ domain, error, durationMs: Date.now() - t0 })
    return { status: 'failed', error }
  }
}

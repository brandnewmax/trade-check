// Queries archive.org Wayback "available" API to find the earliest snapshot
// of the user-supplied URL. Returns { status, firstSnapshot, ageYears, error }.

const TIMEOUT_MS = 8000

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
  const domain = domainOf(rawUrl)
  if (!domain) return { status: 'skipped', error: 'no url' }

  try {
    const api = `https://archive.org/wayback/available?url=${encodeURIComponent(domain)}&timestamp=19960101`
    const res = await fetch(api, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return { status: 'failed', error: `HTTP ${res.status}` }

    const json = await res.json()
    const snap = json?.archived_snapshots?.closest
    if (!snap || !snap.timestamp) {
      return { status: 'ok', firstSnapshot: null, ageYears: null }
    }

    const iso = parseTimestamp(snap.timestamp)
    const snapDate = new Date(iso)
    const ageMs = Date.now() - snapDate.getTime()
    const ageYears = Math.round((ageMs / (365.25 * 24 * 3600 * 1000)) * 10) / 10

    return { status: 'ok', firstSnapshot: iso, ageYears }
  } catch (e) {
    return { status: 'failed', error: e.message || String(e) }
  }
}

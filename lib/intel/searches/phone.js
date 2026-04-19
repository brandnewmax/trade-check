import { serpSearch } from '@/lib/intel/serpapi'
import { createLogger, previewText } from '@/lib/logger'

const log = createLogger('intel/phone')

export function buildPhoneQuery({ phone }) {
  if (!phone) return null
  const normalized = String(phone).replace(/[\s\-()]/g, '')
  if (normalized.length < 6) return null
  return `"${normalized}"`
}

export async function searchPhone(extracted, apiKey) {
  const t0 = Date.now()
  const query = buildPhoneQuery(extracted || {})
  if (!query) {
    log.skip({ reason: '询盘未提及发件方电话' })
    return { status: 'skipped', error: '询盘未提及发件方电话' }
  }
  log.start({ query: previewText(query, 120) })

  const r = await serpSearch({ query, apiKey, num: 5 })
  if (!r.ok) {
    log.fail({ query: previewText(query, 120), error: r.error, durationMs: Date.now() - t0 })
    return { status: 'failed', query, error: r.error }
  }

  log.ok({ query: previewText(query, 120), hitCount: r.results.length, durationMs: Date.now() - t0 })
  return {
    status: 'ok',
    query,
    hitCount: r.results.length,
    hits: r.results,
  }
}

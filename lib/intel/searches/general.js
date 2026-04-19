import { serpSearch } from '@/lib/intel/serpapi'
import { createLogger, previewText } from '@/lib/logger'

const log = createLogger('intel/general')

export function buildGeneralQuery({ companyName }) {
  if (!companyName) return null
  return `"${companyName}"`
}

export async function searchGeneral(extracted, apiKey) {
  const t0 = Date.now()
  const query = buildGeneralQuery(extracted || {})
  if (!query) {
    log.skip({ reason: '缺少公司名' })
    return { status: 'skipped', error: '缺少公司名' }
  }
  log.start({ query: previewText(query, 120) })

  const r = await serpSearch({ query, apiKey, num: 5 })
  if (!r.ok) {
    log.fail({ query: previewText(query, 120), error: r.error, durationMs: Date.now() - t0 })
    return { status: 'failed', query, error: r.error }
  }

  log.ok({ query: previewText(query, 120), resultCount: r.results.length, durationMs: Date.now() - t0 })
  return {
    status: 'ok',
    query,
    topResults: r.results,
  }
}

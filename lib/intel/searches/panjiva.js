import { serpSearch } from '@/lib/intel/serpapi'
import { createLogger, previewText } from '@/lib/logger'

const log = createLogger('intel/panjiva')

export function buildPanjivaQuery({ companyName }) {
  if (!companyName) return null
  return `site:panjiva.com "${companyName}"`
}

export async function searchPanjiva(extracted, apiKey) {
  const t0 = Date.now()
  const query = buildPanjivaQuery(extracted || {})
  if (!query) {
    log.skip({ reason: '缺少公司名' })
    return { status: 'skipped', error: '缺少公司名' }
  }
  log.start({ query: previewText(query, 120) })

  const r = await serpSearch({ query, apiKey, num: 10 })
  if (!r.ok) {
    log.fail({ query: previewText(query, 120), error: r.error, durationMs: Date.now() - t0 })
    return { status: 'failed', query, error: r.error }
  }

  const resultCount = r.results.length
  log.ok({
    query: previewText(query, 120),
    hasRecord: resultCount > 0,
    resultCount,
    durationMs: Date.now() - t0,
  })
  return {
    status: 'ok',
    query,
    hasRecord: resultCount > 0,
    resultCount,
    topResults: r.results.slice(0, 5),
  }
}

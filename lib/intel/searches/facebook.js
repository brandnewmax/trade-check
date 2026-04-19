import { serpSearch } from '@/lib/intel/serpapi'
import { createLogger, previewText } from '@/lib/logger'

const log = createLogger('intel/facebook')

export function buildFacebookQuery({ companyName, personName }) {
  if (companyName) return `site:facebook.com "${companyName}"`
  if (personName) return `site:facebook.com "${personName}"`
  return null
}

export async function searchFacebook(extracted, apiKey) {
  const t0 = Date.now()
  const query = buildFacebookQuery(extracted || {})
  if (!query) {
    log.skip({ reason: '缺少人名和公司名' })
    return { status: 'skipped', error: '缺少人名和公司名' }
  }
  log.start({ query: previewText(query, 120) })

  const r = await serpSearch({ query, apiKey, num: 5 })
  if (!r.ok) {
    log.fail({ query: previewText(query, 120), error: r.error, durationMs: Date.now() - t0 })
    return { status: 'failed', query, error: r.error }
  }

  const found = r.results.length > 0
  log.ok({ query: previewText(query, 120), found, resultCount: r.results.length, durationMs: Date.now() - t0 })
  return {
    status: 'ok',
    query,
    found,
    topResults: r.results,
  }
}

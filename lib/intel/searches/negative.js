import { serpSearch } from '@/lib/intel/serpapi'
import { createLogger, previewText } from '@/lib/logger'

const log = createLogger('intel/negative')

const KEYWORDS = '(scam OR fraud OR 骗 OR complaint)'

export function buildNegativeQuery({ companyName, email, personName }) {
  const target = companyName || email || personName
  if (!target) return null
  return `"${target}" ${KEYWORDS}`
}

export async function searchNegative(extracted, apiKey) {
  const t0 = Date.now()
  const query = buildNegativeQuery(extracted || {})
  if (!query) {
    log.skip({ reason: '缺少公司名/邮箱/人名' })
    return { status: 'skipped', error: '缺少公司名/邮箱/人名' }
  }
  log.start({ query: previewText(query, 120) })

  const r = await serpSearch({ query, apiKey, num: 5 })
  if (!r.ok) {
    log.fail({ query: previewText(query, 120), error: r.error, durationMs: Date.now() - t0 })
    return { status: 'failed', query, error: r.error }
  }

  log.ok({
    query: previewText(query, 120),
    hitCount: r.results.length,
    hasNegative: r.results.length > 0,
    durationMs: Date.now() - t0,
  })
  return {
    status: 'ok',
    query,
    hitCount: r.results.length,
    hits: r.results,
  }
}

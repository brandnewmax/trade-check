import { serpSearch } from '@/lib/intel/serpapi'

const KEYWORDS = '(scam OR fraud OR 骗 OR complaint)'

export function buildNegativeQuery({ companyName, email, personName }) {
  const target = companyName || email || personName
  if (!target) return null
  return `"${target}" ${KEYWORDS}`
}

export async function searchNegative(extracted, apiKey) {
  const query = buildNegativeQuery(extracted || {})
  if (!query) return { status: 'skipped', error: '缺少公司名/邮箱/人名' }

  const r = await serpSearch({ query, apiKey, num: 5 })
  if (!r.ok) return { status: 'failed', query, error: r.error }

  return {
    status: 'ok',
    query,
    hitCount: r.results.length,
    hits: r.results,
  }
}

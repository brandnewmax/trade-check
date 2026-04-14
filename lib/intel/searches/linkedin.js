import { serpSearch } from '@/lib/intel/serpapi'

export function buildLinkedInQuery({ personName, companyName }) {
  if (personName && companyName) return `site:linkedin.com/in "${personName}" "${companyName}"`
  if (personName) return `site:linkedin.com/in "${personName}"`
  if (companyName) return `site:linkedin.com/company "${companyName}"`
  return null
}

export async function searchLinkedIn(extracted, apiKey) {
  const query = buildLinkedInQuery(extracted || {})
  if (!query) return { status: 'skipped', error: '缺少人名和公司名' }

  const r = await serpSearch({ query, apiKey, num: 5 })
  if (!r.ok) return { status: 'failed', query, error: r.error }

  return {
    status: 'ok',
    query,
    found: r.results.length > 0,
    topResults: r.results,
  }
}

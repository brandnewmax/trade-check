import { serpSearch } from '@/lib/intel/serpapi'

export function buildFacebookQuery({ companyName, personName }) {
  if (companyName) return `site:facebook.com "${companyName}"`
  if (personName) return `site:facebook.com "${personName}"`
  return null
}

export async function searchFacebook(extracted, apiKey) {
  const query = buildFacebookQuery(extracted || {})
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

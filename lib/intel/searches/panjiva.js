import { serpSearch } from '@/lib/intel/serpapi'

export function buildPanjivaQuery({ companyName }) {
  if (!companyName) return null
  return `site:panjiva.com "${companyName}"`
}

export async function searchPanjiva(extracted, apiKey) {
  const query = buildPanjivaQuery(extracted || {})
  if (!query) return { status: 'skipped', error: '缺少公司名' }

  const r = await serpSearch({ query, apiKey, num: 10 })
  if (!r.ok) return { status: 'failed', query, error: r.error }

  const resultCount = r.results.length
  return {
    status: 'ok',
    query,
    hasRecord: resultCount > 0,
    resultCount,
    topResults: r.results.slice(0, 5),
  }
}

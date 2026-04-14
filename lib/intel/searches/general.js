import { serpSearch } from '@/lib/intel/serpapi'

export function buildGeneralQuery({ companyName }) {
  if (!companyName) return null
  return `"${companyName}"`
}

export async function searchGeneral(extracted, apiKey) {
  const query = buildGeneralQuery(extracted || {})
  if (!query) return { status: 'skipped', error: '缺少公司名' }

  const r = await serpSearch({ query, apiKey, num: 5 })
  if (!r.ok) return { status: 'failed', query, error: r.error }

  return {
    status: 'ok',
    query,
    topResults: r.results,
  }
}

import { serpSearch } from '@/lib/intel/serpapi'

export function buildPhoneQuery({ phone }) {
  if (!phone) return null
  const normalized = String(phone).replace(/[\s\-()]/g, '')
  if (normalized.length < 6) return null
  return `"${normalized}"`
}

export async function searchPhone(extracted, apiKey) {
  const query = buildPhoneQuery(extracted || {})
  if (!query) return { status: 'skipped', error: '询盘未提及发件方电话' }

  const r = await serpSearch({ query, apiKey, num: 5 })
  if (!r.ok) return { status: 'failed', query, error: r.error }

  return {
    status: 'ok',
    query,
    hitCount: r.results.length,
    hits: r.results,
  }
}

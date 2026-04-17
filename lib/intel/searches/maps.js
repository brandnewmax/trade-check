import { mapsSearch } from '@/lib/intel/serpapi'

// Build a Google Maps query for the sender's company. Strategy:
//   1. Always require companyName — without it Maps degenerates to noisy
//      address-only or country-only hits which confuse the LLM.
//   2. If we have a full address, append it (e.g. `"PROSTYLE" 街道+城市`).
//      The address is the strongest signal — Maps geocodes it directly.
//   3. Otherwise fall back to country (e.g. `"PROSTYLE" Serbia`) so Maps
//      at least biases the search to the right region.
//   4. With neither address nor country, just the quoted company name.
export function buildMapsQuery({ companyName, address, country }) {
  if (!companyName || !companyName.trim()) return null
  const name = `"${companyName.trim()}"`
  if (address && address.trim()) return `${name} ${address.trim()}`
  if (country && country.trim()) return `${name} ${country.trim()}`
  return name
}

export async function searchMaps(extracted, apiKey) {
  const query = buildMapsQuery(extracted || {})
  if (!query) return { status: 'skipped', error: '缺少公司名' }

  const r = await mapsSearch({ query, apiKey, num: 5 })
  if (!r.ok) return { status: 'failed', query, error: r.error }

  return {
    status: 'ok',
    query,
    hasRecord: r.results.length > 0,
    resultCount: r.results.length,
    places: r.results,
  }
}

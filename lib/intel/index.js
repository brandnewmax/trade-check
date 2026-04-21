import { fetchWebsite } from '@/lib/intel/fetchWebsite'
import { waybackFirstSnapshot } from '@/lib/intel/wayback'
import { extractEntities } from '@/lib/intel/extract'
import { serpSearch } from '@/lib/intel/serpapi'
import { searchLinkedIn } from '@/lib/intel/searches/linkedin'
import { searchFacebook } from '@/lib/intel/searches/facebook'
import { searchPanjiva } from '@/lib/intel/searches/panjiva'
import { searchNegative } from '@/lib/intel/searches/negative'
import { searchGeneral } from '@/lib/intel/searches/general'
import { searchPhone } from '@/lib/intel/searches/phone'
import { searchMaps } from '@/lib/intel/searches/maps'

export { formatIntelAsBriefing } from '@/lib/intel/format'

// Resolves which endpoint, apiKey, and model the extraction call should use.
// Pair (extractionBaseUrl, extractionApiKey) is atomic — if either side is
// blank we fall back to the main endpoint + user apiKey. Save validation
// (`validateGlobalExtractionSettings`) prevents partial config from being
// persisted, but this function stays defensive.
export function resolveExtractionEndpoint(globalSettings, userApiKey, hasImages) {
  const gs = globalSettings || {}
  const useSeparate = !!(gs.extractionBaseUrl && gs.extractionApiKey)
  return {
    baseUrl: useSeparate ? gs.extractionBaseUrl : gs.baseUrl,
    apiKey: useSeparate ? gs.extractionApiKey : userApiKey,
    model: hasImages ? gs.extractionModelVision : gs.extractionModel,
  }
}

// Pick the best short brand-name query to run on the user's own site for
// supplementary context. Priority:
//   1. og:site_name meta tag
//   2. Shortest meaningful segment of <title>, split on common separators
//   3. Second-level domain without TLD (e.g. konmison.com → konmison)
function deriveUserQueryFromSite(site) {
  if (!site || site.status !== 'ok') return null
  if (site.siteName && site.siteName.trim()) return site.siteName.trim()
  if (site.title) {
    const parts = site.title
      .split(/\s*[|·•\-—–]\s*/)
      .map(p => p.trim())
      .filter(p => p.length >= 2)
    if (parts.length > 0) {
      // Prefer the shortest non-trivial part — brand names are usually short,
      // descriptive taglines are long.
      return parts.reduce((a, b) => (a.length <= b.length ? a : b))
    }
  }
  try {
    const host = new URL(site.url || '').hostname.replace(/^www\./, '')
    const hostParts = host.split('.')
    if (hostParts.length >= 2) return hostParts[hostParts.length - 2]
  } catch {}
  return null
}

// Orchestrates background-check intel collection.
//
// Important semantics:
//   - `url`       = the USER'S OWN company website (收件方). Used only for
//                   context — its content helps the main LLM understand the
//                   exporter's business. NOT the target of investigation.
//   - `inquiry`   = the incoming message from a potential customer (发件方).
//                   This is where the investigation target comes from.
//   - `images`    = optional attachments (business cards, email/chat
//                   screenshots) passed multimodally to the extraction LLM.
//   - `apiKey`    = the user's main-analysis apiKey; used as fallback for
//                   extraction when no separate `extractionApiKey` is set.
//   - Extraction endpoint + model come from `resolveExtractionEndpoint`,
//     which consults `globalSettings.extractionBaseUrl/ApiKey/Model/ModelVision`.
export async function gatherIntel({ url, inquiry, images = [], apiKey, globalSettings, onProgress }) {
  const start = Date.now()
  const report = (obj) => { try { onProgress && onProgress(obj) } catch {} }

  // Stage 1: fetch the user's own site + run a supplementary Serper search
  // on our brand name. Both are silent context (not in the intel panel) —
  // they get injected into the main analysis LLM's user message so it has
  // richer grounding about what we sell, which matters when the 发件方 has
  // a sparse footprint.
  const serpKey = globalSettings.serpApiKey
  const userSite = await fetchWebsite(url)
  let userContext = null
  if (userSite.status === 'ok' && serpKey) {
    const q = deriveUserQueryFromSite(userSite)
    if (q) {
      const r = await serpSearch({ query: `"${q}"`, apiKey: serpKey, num: 5 })
      if (r.ok) {
        userContext = { query: r.query, results: r.results }
      }
    }
  }
  report({ userSite, userContext })

  // Stage 2: LLM extracts the sender's entity (from inquiry text + images).
  // Endpoint + model resolution delegates to `resolveExtractionEndpoint` so
  // admins can point extraction at a separate provider and pick different
  // models for text vs. vision cases.
  const hasImages = Array.isArray(images) && images.length > 0
  const endpoint = resolveExtractionEndpoint(globalSettings, apiKey, hasImages)

  const extractResult = await extractEntities({
    inquiry,
    images,
    userUrl: url,
    websiteText: userSite.status === 'ok' ? userSite.excerpt : '',
    baseUrl: endpoint.baseUrl,
    apiKey: endpoint.apiKey,
    model: endpoint.model,
    systemPrompt: globalSettings.extractionPrompt,
  })
  const extracted = extractResult.extracted // may be null
  report({ extracted, extractionStatus: extractResult.status })

  // Stage 3: target-driven parallel searches. `website` and `wayback` now
  // describe the TARGET's website (from extracted.companyUrl), not the user's.
  const targetUrl = extracted?.companyUrl || null

  const [website, wayback, linkedin, facebook, panjiva, maps, negative, generalSearch, phone] = await Promise.all([
    targetUrl
      ? fetchWebsite(targetUrl)
      : Promise.resolve({ status: 'skipped', error: '询盘未提及发件方公司网址' }),
    targetUrl
      ? waybackFirstSnapshot(targetUrl)
      : Promise.resolve({ status: 'skipped', error: '询盘未提及发件方公司网址' }),
    searchLinkedIn(extracted, serpKey),
    searchFacebook(extracted, serpKey),
    searchPanjiva(extracted, serpKey),
    searchMaps(extracted, serpKey),
    searchNegative(extracted, serpKey),
    searchGeneral(extracted, serpKey),
    searchPhone(extracted, serpKey),
  ])
  report({ website, wayback, linkedin, facebook, panjiva, maps, negative, generalSearch, phone })

  const skipped = []
  for (const [k, v] of Object.entries({ website, wayback, linkedin, facebook, panjiva, maps, negative, generalSearch, phone })) {
    if (v.status === 'skipped') skipped.push(`${k} (${v.error})`)
  }

  return {
    extracted,
    userSite,    // exporter's own site scrape; silent LLM context
    userContext, // Serper hits for the exporter's brand; silent LLM context
    website,     // TARGET's site
    linkedin,
    facebook,
    panjiva,
    maps,        // TARGET's Google Maps presence (address truthing)
    negative,
    phone,       // TARGET's phone number lookup
    generalSearch,
    wayback,     // TARGET's first snapshot (placed last — often empty for new sites)
    meta: {
      durationMs: Date.now() - start,
      skipped,
      extractionStatus: extractResult.status,
      extractionError: extractResult.error || null,
      extractionModel: endpoint.model,
    },
  }
}

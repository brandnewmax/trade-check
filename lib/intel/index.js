import { fetchWebsite } from '@/lib/intel/fetchWebsite'
import { waybackFirstSnapshot } from '@/lib/intel/wayback'
import { extractEntities } from '@/lib/intel/extract'
import { searchLinkedIn } from '@/lib/intel/searches/linkedin'
import { searchFacebook } from '@/lib/intel/searches/facebook'
import { searchPanjiva } from '@/lib/intel/searches/panjiva'
import { searchNegative } from '@/lib/intel/searches/negative'
import { searchGeneral } from '@/lib/intel/searches/general'

export { formatIntelAsBriefing } from '@/lib/intel/format'

export async function gatherIntel({ url, inquiry, apiKey, globalSettings, onProgress }) {
  const start = Date.now()
  const report = (obj) => { try { onProgress && onProgress(obj) } catch {} }

  const [website, wayback] = await Promise.all([
    fetchWebsite(url),
    waybackFirstSnapshot(url),
  ])
  report({ website, wayback })

  const extractResult = await extractEntities({
    inquiry,
    websiteText: website.status === 'ok' ? website.excerpt : '',
    baseUrl: globalSettings.baseUrl,
    apiKey,
    model: globalSettings.extractionModel,
    systemPrompt: globalSettings.extractionPrompt,
  })
  const extracted = extractResult.extracted
  report({ extracted, extractionStatus: extractResult.status })

  const enriched = extracted
    ? {
        ...extracted,
        companyName: extracted.companyName || website.siteName || null,
      }
    : website.siteName
      ? {
          companyName: website.siteName,
          personName: null,
          personTitle: null,
          email: null,
          phone: null,
          country: null,
          products: [],
        }
      : null

  const serpKey = globalSettings.serpApiKey
  const [linkedin, facebook, panjiva, negative, generalSearch] = await Promise.all([
    searchLinkedIn(enriched, serpKey),
    searchFacebook(enriched, serpKey),
    searchPanjiva(enriched, serpKey),
    searchNegative(enriched, serpKey),
    searchGeneral(enriched, serpKey),
  ])
  report({ linkedin, facebook, panjiva, negative, generalSearch })

  const skipped = []
  for (const [k, v] of Object.entries({ linkedin, facebook, panjiva, negative, generalSearch })) {
    if (v.status === 'skipped') skipped.push(`${k} (${v.error})`)
  }

  return {
    extracted: enriched,
    website,
    wayback,
    linkedin,
    facebook,
    panjiva,
    negative,
    generalSearch,
    meta: {
      durationMs: Date.now() - start,
      skipped,
    },
  }
}

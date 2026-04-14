import { fetchWebsite } from '@/lib/intel/fetchWebsite'
import { waybackFirstSnapshot } from '@/lib/intel/wayback'
import { extractEntities } from '@/lib/intel/extract'
import { searchLinkedIn } from '@/lib/intel/searches/linkedin'
import { searchFacebook } from '@/lib/intel/searches/facebook'
import { searchPanjiva } from '@/lib/intel/searches/panjiva'
import { searchNegative } from '@/lib/intel/searches/negative'
import { searchGeneral } from '@/lib/intel/searches/general'

export { formatIntelAsBriefing } from '@/lib/intel/format'

// Orchestrates background-check intel collection.
//
// Important semantics:
//   - `url`     = the USER'S OWN company website (收件方). Used only for context
//                 — its content helps the main LLM understand the exporter's
//                 business. It is NOT the target of investigation.
//   - `inquiry` = the incoming message from a potential customer (发件方).
//                 This is where we extract the investigation target from.
//   - `images`  = optional attachments (business cards, email/chat screenshots)
//                 passed multimodally to the extraction LLM for OCR.
//
// The 6 intel panel cards all describe the 发件方 (target), not the user.
export async function gatherIntel({ url, inquiry, images = [], apiKey, globalSettings, onProgress }) {
  const start = Date.now()
  const report = (obj) => { try { onProgress && onProgress(obj) } catch {} }

  // Stage 1: fetch the user's own site (exporter context — NOT shown in the
  // intel panel, only injected into the main analysis LLM's user message).
  const userSite = await fetchWebsite(url)
  report({ userSite })

  // Stage 2: LLM extracts the sender's entity (from inquiry text + images).
  const extractResult = await extractEntities({
    inquiry,
    images,
    websiteText: userSite.status === 'ok' ? userSite.excerpt : '',
    baseUrl: globalSettings.baseUrl,
    apiKey,
    model: globalSettings.extractionModel,
    systemPrompt: globalSettings.extractionPrompt,
  })
  const extracted = extractResult.extracted // may be null
  report({ extracted, extractionStatus: extractResult.status })

  // Stage 3: target-driven parallel searches. `website` and `wayback` now
  // describe the TARGET's website (from extracted.companyUrl), not the user's.
  const serpKey = globalSettings.serpApiKey
  const targetUrl = extracted?.companyUrl || null

  const [website, wayback, linkedin, facebook, panjiva, negative, generalSearch] = await Promise.all([
    targetUrl
      ? fetchWebsite(targetUrl)
      : Promise.resolve({ status: 'skipped', error: '询盘未提及发件方公司网址' }),
    targetUrl
      ? waybackFirstSnapshot(targetUrl)
      : Promise.resolve({ status: 'skipped', error: '询盘未提及发件方公司网址' }),
    searchLinkedIn(extracted, serpKey),
    searchFacebook(extracted, serpKey),
    searchPanjiva(extracted, serpKey),
    searchNegative(extracted, serpKey),
    searchGeneral(extracted, serpKey),
  ])
  report({ website, wayback, linkedin, facebook, panjiva, negative, generalSearch })

  const skipped = []
  for (const [k, v] of Object.entries({ website, wayback, linkedin, facebook, panjiva, negative, generalSearch })) {
    if (v.status === 'skipped') skipped.push(`${k} (${v.error})`)
  }

  return {
    extracted,
    userSite, // exporter's own site; consumed by analyze route as LLM context
    website,  // TARGET's site
    wayback,  // TARGET's first snapshot
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

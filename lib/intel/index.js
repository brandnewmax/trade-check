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
import { createLogger, previewText } from '@/lib/logger'

export { formatIntelAsBriefing } from '@/lib/intel/format'

const log = createLogger('intel/orchestrator')

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
//   - `url`             = USER'S OWN company website (收件方).
//   - `ownDomains`      = ALL of the user's own domains, for self-exclusion
//                         in extractEntities. Passed through to `extract`.
//   - `userProfileText` = pre-curated self-description (SN contract §10.7:
//                         the markdown `profile_report` from
//                         /api/v1/profile). When present, we SKIP fetching
//                         the user site + running the Google search on our
//                         brand (P5: avoid re-doing work SN already did),
//                         and we use this text directly as the "who we
//                         are" context for the extraction LLM (P3: don't
//                         let the 3000-char HTML excerpt shadow this).
//   - `inquiry`         = the incoming message (发件方).
//   - `images`          = optional attachments passed multimodally.
//   - `mainModel`       = main analysis model; used for extraction only
//                         when images are present (better OCR).
export async function gatherIntel({ url, ownDomains, userProfileText, inquiry, images = [], apiKey, mainModel, globalSettings, onProgress }) {
  const start = Date.now()
  const report = (obj) => { try { onProgress && onProgress(obj) } catch {} }

  const hasImages = Array.isArray(images) && images.length > 0
  const hasUserProfile = typeof userProfileText === 'string' && userProfileText.trim().length > 0
  log.start({
    userUrl: url || null,
    ownDomains: Array.isArray(ownDomains) ? ownDomains : [],
    hasUserProfile,
    userProfileTextLen: hasUserProfile ? userProfileText.length : 0,
    inquiryLen: (inquiry || '').length,
    hasImages,
    imageCount: hasImages ? images.length : 0,
    extractionModel: globalSettings.extractionModel,
    mainModel,
    hasSerpKey: !!globalSettings.serpApiKey,
  })

  // Stage 1: establish "who we are" context for the main analysis LLM.
  //
  // Two branches:
  //   A) Caller gave us `userProfileText` (SN contract flow):
  //      skip fetchWebsite / userContext serp — 8s + 1 Serper call saved
  //      per invocation (P5). userSite is marked skipped with reason.
  //
  //   B) No pre-curated text (legacy Web UI flow):
  //      direct-fetch the user's own site and supplementally search our
  //      brand name on Serper for richer grounding.
  const serpKey = globalSettings.serpApiKey
  let userSite
  let userContext = null
  if (hasUserProfile) {
    log.info('stage', { name: 'userSite', skipped: true, reason: 'userProfileText provided' })
    userSite = { status: 'skipped', error: 'userProfileText provided' }
  } else {
    log.info('stage', { name: 'userSite', url: url || null })
    // userSite = 自家站。我们控制它的 WAF 配置（如果开了），一般直抓没问题；
    // 开 SerpAPI fallback 没必要，也不应该为自己多花 Serper 额度。
    userSite = await fetchWebsite(url, { enableSerpFallback: false })
    if (userSite.status === 'ok' && serpKey) {
      const q = deriveUserQueryFromSite(userSite)
      if (q) {
        log.info('userContext_query', { query: previewText(q, 80) })
        const r = await serpSearch({ query: `"${q}"`, apiKey: serpKey, num: 5 })
        if (r.ok) {
          userContext = { query: r.query, results: r.results }
          log.info('userContext_ok', { query: previewText(q, 80), resultCount: r.results.length })
        } else {
          log.warn('userContext_fail', { query: previewText(q, 80), error: r.error })
        }
      } else {
        log.info('userContext_skip', { reason: 'no derivable brand query' })
      }
    } else if (!serpKey) {
      log.info('userContext_skip', { reason: 'no serpKey' })
    } else {
      log.info('userContext_skip', { reason: `userSite.status=${userSite.status}` })
    }
  }
  report({ userSite, userContext })

  // Stage 2: LLM extracts the sender's entity (from inquiry text + images).
  // Route-hardening: when images are present, use the user's main
  // multimodal model instead of the cheap extractionModel — the latter is
  // often too weak to reliably OCR cramped business-card text, so it used
  // to return `companyUrl: null` even when the card clearly showed one,
  // leaving the intel panel blank. The main model is already proven
  // multimodal (it handles the same images in stage 4).
  const extractModel = hasImages
    ? (mainModel || globalSettings.extractionModel)
    : globalSettings.extractionModel
  log.info('stage', { name: 'extract', model: extractModel, hasImages })

  // Pre-curated profile wins over scraped excerpt for "who we are" grounding
  // — it's richer and more accurate than 3000 chars of stripped HTML (P3).
  const selfContextForExtract = hasUserProfile
    ? userProfileText
    : (userSite.status === 'ok' ? userSite.excerpt : '')
  const extractResult = await extractEntities({
    inquiry,
    images,
    userUrl: url,
    ownDomains,
    websiteText: selfContextForExtract,
    baseUrl: globalSettings.baseUrl,
    apiKey,
    model: extractModel,
    systemPrompt: globalSettings.extractionPrompt,
  })
  const extracted = extractResult.extracted // may be null
  log.info('extract_done', {
    status: extractResult.status,
    error: extractResult.error || null,
    hasCompanyUrl: !!extracted?.companyUrl,
    hasCompanyName: !!extracted?.companyName,
    hasPersonName: !!extracted?.personName,
  })
  report({ extracted, extractionStatus: extractResult.status })

  // Stage 3: target-driven parallel searches. `website` and `wayback` now
  // describe the TARGET's website (from extracted.companyUrl), not the user's.
  const targetUrl = extracted?.companyUrl || null
  log.info('stage', { name: 'fanout', targetUrl })

  const [website, wayback, linkedin, facebook, panjiva, negative, generalSearch, phone] = await Promise.all([
    targetUrl
      // target = 发件方网站。真实世界里大量 target 站挂 Cloudflare / WAF，
      // 直抓返回 403 或 JS 挑战。开 SerpAPI fallback 用 `site:<host>` 聚合
      // Google 索引把「站存在且以下是它的基础内容」这个信号救回来（P2）。
      ? fetchWebsite(targetUrl, { enableSerpFallback: true, serpKey })
      : Promise.resolve({ status: 'skipped', error: '询盘未提及发件方公司网址' }),
    targetUrl
      ? waybackFirstSnapshot(targetUrl)
      : Promise.resolve({ status: 'skipped', error: '询盘未提及发件方公司网址' }),
    searchLinkedIn(extracted, serpKey),
    searchFacebook(extracted, serpKey),
    searchPanjiva(extracted, serpKey),
    searchNegative(extracted, serpKey),
    searchGeneral(extracted, serpKey),
    searchPhone(extracted, serpKey),
  ])
  report({ website, wayback, linkedin, facebook, panjiva, negative, generalSearch, phone })

  const statusMap = { website, wayback, linkedin, facebook, panjiva, negative, generalSearch, phone }
  const skipped = []
  const statuses = {}
  for (const [k, v] of Object.entries(statusMap)) {
    statuses[k] = v.status
    if (v.status === 'skipped') skipped.push(`${k} (${v.error})`)
  }
  const durationMs = Date.now() - start

  log.ok({
    durationMs,
    statuses,
    skippedCount: skipped.length,
    extractionStatus: extractResult.status,
  })

  return {
    extracted,
    userSite,    // exporter's own site scrape; silent LLM context
    userContext, // Serper hits for the exporter's brand; silent LLM context
    website,     // TARGET's site
    linkedin,
    facebook,
    panjiva,
    negative,
    phone,       // TARGET's phone number lookup
    generalSearch,
    wayback,     // TARGET's first snapshot (placed last — often empty for new sites)
    meta: {
      durationMs,
      skipped,
      extractionStatus: extractResult.status,
      extractionError: extractResult.error || null,
      extractionModel: extractModel,
    },
  }
}

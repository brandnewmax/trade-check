// Input adapter for /api/analyze and /api/v1/analyze.
// Accepts both the legacy shape ({ inquiry, company, images, options, enableIntel })
// and the new SN-facing shape ({ inquiry_text, company_profile, inquiry_images,
// enable_intel, scan_mode, request_id }). Downstream code reads only the
// normalized field names.

import {
  FREE_EMAIL_DOMAINS,
  NON_COMPANY_DOMAINS,
  CORPORATE_TLD_ALTERNATION,
  normalizeBareDomain,
} from '@/lib/intel/extract'

export function normalizeRequest(body = {}) {
  const enable_intel =
    body.enable_intel !== undefined
      ? body.enable_intel
      : body.enableIntel !== undefined
        ? body.enableIntel
        : body.options?.enable_intel ?? false

  return {
    request_id: body.request_id || null,
    inquiry_text: body.inquiry_text || body.inquiry || '',
    company_profile: body.company_profile ?? body.company ?? '',
    inquiry_images: body.inquiry_images || body.images || [],
    enable_intel,
    scan_mode: body.scan_mode || (enable_intel ? 'online' : 'offline'),
  }
}

// Scan every plausible corporate domain out of free-form text, filtering
// out free-email providers and non-corporate (social/marketplace/search)
// domains. Used when `company_profile` is the string-form (SN contract
// §2.1 / §10.7 recommended shape: the markdown profile_report).
function extractCorporateDomainsFromText(text) {
  if (!text || typeof text !== 'string') return []
  const lower = text.toLowerCase()
  const found = new Set()
  const blacklist = new Set([...FREE_EMAIL_DOMAINS, ...NON_COMPANY_DOMAINS])

  const tryAdd = (raw) => {
    const d = normalizeBareDomain(raw)
    if (!d) return
    const parts = d.split('.')
    if (parts.length < 2) return
    const sld = parts[parts.length - 2]
    if (!sld || sld.length < 2 || /^\d+$/.test(sld)) return
    if (blacklist.has(d)) return
    const last2 = parts.slice(-2).join('.')
    if (blacklist.has(last2)) return
    found.add(d)
  }

  // Pass 1: explicit http(s):// or www. prefix
  const STRONG = /(?:https?:\/\/|\bwww\.)([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi
  for (const m of lower.matchAll(STRONG)) tryAdd(m[1])

  // Pass 2: bare domain limited to corporate TLD whitelist (same as extract.js)
  const BARE = new RegExp(
    `(?<![@\\w.-])([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\\.(?:${CORPORATE_TLD_ALTERNATION}))(?![@\\w-])`,
    'gi'
  )
  for (const m of lower.matchAll(BARE)) tryAdd(m[1])

  // Pass 3: corporate email domains — blacklist filters free providers
  const EMAIL = /\b[a-z0-9][a-z0-9._+-]*@([a-z0-9][a-z0-9.-]*\.[a-z]{2,})\b/gi
  for (const m of lower.matchAll(EMAIL)) tryAdd(m[1])

  return Array.from(found)
}

// Returns the list of domains that belong to the USER's own business
// (收件方 / seller), derived from `company_profile` regardless of whether
// SN passes object-form ({website, name, ...}) or string-form (markdown
// profile_report per contract §10.7). Used as `ownDomains` to exclude
// the seller's own site from the regex fallback in `extractEntities` —
// preventing the self-background-check bug (P1).
export function deriveOwnDomains(companyProfile) {
  if (!companyProfile) return []

  if (typeof companyProfile === 'string') {
    return extractCorporateDomainsFromText(companyProfile)
  }

  if (typeof companyProfile === 'object') {
    const domains = new Set()
    if (companyProfile.website) {
      const d = normalizeBareDomain(companyProfile.website)
      if (d) domains.add(d)
    }
    return Array.from(domains)
  }

  return []
}

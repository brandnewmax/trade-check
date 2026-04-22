// End-to-end smoke test for the SN P1 scenario: a real-world-shaped
// request body reproducing the production bug (inquiry mentions the
// seller's own domain), running through every library layer touched by
// the fix with a mocked LLM. Serves as a "wiring sanity check" before
// opening the PR — complements the per-unit tests by verifying the
// pieces actually compose.
//
// Scenario:
//   - SN platform sends company_profile as a markdown string per
//     contract §10.7 (includes seller's domain starseedpkg.com)
//   - inquiry text is the classic pattern: buyer saying "I saw your
//     website starseedpkg.com..."
//   - extraction LLM (mocked) returns companyUrl:null (correct: sender
//     didn't supply a URL)
//   - fallback regex sees starseedpkg.com but MUST reject it because
//     it's in ownDomains
//   - final extracted.companyUrl must NOT be starseedpkg.com
//   - fanout targetUrl must NOT be starseedpkg.com
//   - self-background-check does not happen

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock external deps BEFORE importing the module under test ─────────
const fetchWebsiteMock = vi.fn()
const waybackMock = vi.fn()
const serpSearchMock = vi.fn()
const linkedInMock = vi.fn()
const facebookMock = vi.fn()
const panjivaMock = vi.fn()
const negativeMock = vi.fn()
const generalMock = vi.fn()
const phoneMock = vi.fn()
const extractLlmFetchMock = vi.fn()

vi.mock('@/lib/intel/fetchWebsite', () => ({ fetchWebsite: (...a) => fetchWebsiteMock(...a) }))
vi.mock('@/lib/intel/wayback', () => ({ waybackFirstSnapshot: (...a) => waybackMock(...a) }))
vi.mock('@/lib/intel/serpapi', () => ({ serpSearch: (...a) => serpSearchMock(...a) }))
vi.mock('@/lib/intel/searches/linkedin', () => ({ searchLinkedIn: (...a) => linkedInMock(...a) }))
vi.mock('@/lib/intel/searches/facebook', () => ({ searchFacebook: (...a) => facebookMock(...a) }))
vi.mock('@/lib/intel/searches/panjiva', () => ({ searchPanjiva: (...a) => panjivaMock(...a) }))
vi.mock('@/lib/intel/searches/negative', () => ({ searchNegative: (...a) => negativeMock(...a) }))
vi.mock('@/lib/intel/searches/general', () => ({ searchGeneral: (...a) => generalMock(...a) }))
vi.mock('@/lib/intel/searches/phone', () => ({ searchPhone: (...a) => phoneMock(...a) }))

// Import AFTER mocks registered
import { normalizeRequest, deriveOwnDomains } from '@/lib/requestNormalizer'
import { gatherIntel } from '@/lib/intel'

const okSkipped = { status: 'skipped', error: 'not relevant' }

function mockLlmExtraction(extractedPayload) {
  // extractEntities hits a bare `fetch` (to an OpenAI-compatible
  // endpoint). Stub global fetch with a stream-less response returning
  // the extracted JSON. We also need to mock the OCR pre-pass call
  // when images are present — test here has no images, so single
  // fetch call suffices.
  const body = { choices: [{ message: { content: JSON.stringify(extractedPayload) } }], usage: null }
  extractLlmFetchMock.mockImplementation(async () => ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }))
  vi.stubGlobal('fetch', extractLlmFetchMock)
}

describe('SN P1 scenario — end-to-end smoke through gatherIntel', () => {
  beforeEach(() => {
    fetchWebsiteMock.mockReset()
    waybackMock.mockReset()
    serpSearchMock.mockReset()
    linkedInMock.mockReset()
    facebookMock.mockReset()
    panjivaMock.mockReset()
    negativeMock.mockReset()
    generalMock.mockReset()
    phoneMock.mockReset()
    extractLlmFetchMock.mockReset()

    // Sensible defaults for the fanout — not under test here
    fetchWebsiteMock.mockResolvedValue(okSkipped)
    waybackMock.mockResolvedValue(okSkipped)
    linkedInMock.mockResolvedValue({ status: 'skipped' })
    facebookMock.mockResolvedValue({ status: 'skipped' })
    panjivaMock.mockResolvedValue({ status: 'skipped' })
    negativeMock.mockResolvedValue({ status: 'skipped' })
    generalMock.mockResolvedValue({ status: 'skipped' })
    phoneMock.mockResolvedValue({ status: 'skipped' })
  })

  it('production reproducer: string profile + inquiry mentioning seller domain + LLM returns null — target is NOT the seller site', async () => {
    // ─── Simulate SN contract §2.1 request body ───
    const requestBody = {
      request_id: 'req_sn_smoke_p1',
      inquiry_text: `Hello,

I saw your website starseedpkg.com and am very interested in bulk packaging orders.
Please send me a catalogue and pricing for 20-foot container quantities.

Regards,
Parul Verma
mishtiparul7@gmail.com
+91-98765-43210`,
      company_profile: `# 星籽包装 Star Seed Packaging Co.

官网：https://starseedpkg.com

我们主营环保可降解包装材料,服务东南亚电商卖家,成立于 2019 年。
主要产品:纸质快递袋、无塑胶封箱带、植物纤维填充料。`,
      enable_intel: true,
      scan_mode: 'online',
    }

    // ─── Run the normalizer exactly as the route does ───
    const normalized = normalizeRequest(requestBody)
    const companyObj = (typeof normalized.company_profile === 'object' && normalized.company_profile !== null) ? normalized.company_profile : {}
    const companyText = typeof normalized.company_profile === 'string' ? normalized.company_profile : ''

    const ownDomains = deriveOwnDomains(normalized.company_profile)
    expect(ownDomains).toContain('starseedpkg.com')

    const url = companyObj.website || (ownDomains[0] ? `https://${ownDomains[0]}` : '')
    expect(url).toBe('https://starseedpkg.com')

    // ─── Stub the extraction LLM to return companyUrl:null (the exact
    //     condition that triggered the old regex fallback bug) ───
    mockLlmExtraction({
      companyName: null,
      companyUrl: null,
      personName: 'Parul Verma',
      personTitle: null,
      email: 'mishtiparul7@gmail.com',
      phone: '+91-98765-43210',
      country: 'India',
      products: ['packaging'],
    })

    // ─── Drive gatherIntel ───
    const intel = await gatherIntel({
      url,
      ownDomains,
      userProfileText: companyText,
      inquiry: normalized.inquiry_text,
      images: [],
      apiKey: 'stub',
      mainModel: 'stub-model',
      globalSettings: {
        serpApiKey: 'stub-serp',
        extractionModel: 'stub-extract',
        extractionPrompt: 'stub prompt',
        baseUrl: 'https://llm.example',
      },
    })

    // ─── Assertions: every surface that the bug used to corrupt ───

    // 1. userSite fetch was SKIPPED (P5) — no wasted 8s on our own site
    const userSiteFetchCall = fetchWebsiteMock.mock.calls.find(c => c[0] === 'https://starseedpkg.com' && c[1]?.enableSerpFallback === false)
    expect(userSiteFetchCall).toBeUndefined()
    expect(intel.userSite.status).toBe('skipped')
    expect(intel.userSite.error).toMatch(/userProfileText/i)

    // 2. userContext Serper search did NOT fire (P5)
    expect(serpSearchMock).not.toHaveBeenCalled()

    // 3. The extracted companyUrl is NOT the seller's own domain (P1)
    //    Either it's null (regex rejected by confidence gate OR ownDomain
    //    exclusion), OR it's something else entirely. Critically NOT
    //    starseedpkg.com.
    expect(intel.extracted.companyUrl).not.toBe('https://starseedpkg.com')

    // 4. Fanout didn't fire `fetchWebsite(starseedpkg.com)` as the TARGET
    //    (the self-bg-check signature in the production log)
    const targetFanoutCall = fetchWebsiteMock.mock.calls.find(
      c => c[0] === 'https://starseedpkg.com' && c[1]?.enableSerpFallback === true
    )
    expect(targetFanoutCall).toBeUndefined()

    // 5. Wayback also didn't get called on our own site
    const waybackCall = waybackMock.mock.calls.find(c => c[0] === 'https://starseedpkg.com')
    expect(waybackCall).toBeUndefined()
  })

  it('positive case: corroborated regex fallback (URL matches email domain) DOES commit', async () => {
    // Contrast with the scenario above — when the buyer DOES give a
    // corporate email whose domain matches a URL in the text, the
    // regex fallback should accept it (P4 gate allows it).
    const requestBody = {
      request_id: 'req_sn_smoke_p4',
      inquiry_text: `Hi,

We're interested in sourcing LED panels.
Please contact me at quotes@buyerco.com or visit buyerco.com for our profile.

--
Jane Smith
Tel: +1-555-0100
Web: https://buyerco.com`,
      company_profile: 'Our company makes LED panels — https://starseedpkg.com',
      enable_intel: true,
      scan_mode: 'online',
    }

    const normalized = normalizeRequest(requestBody)
    const ownDomains = deriveOwnDomains(normalized.company_profile)
    const url = `https://${ownDomains[0]}`

    mockLlmExtraction({
      companyName: null,
      companyUrl: null,  // LLM says no URL — regex fallback will try
      personName: 'Jane Smith',
      email: 'quotes@buyerco.com',
      phone: '+1-555-0100',
      country: null,
      products: ['LED panels'],
    })

    const intel = await gatherIntel({
      url,
      ownDomains,
      userProfileText: normalized.company_profile,
      inquiry: normalized.inquiry_text,
      images: [],
      apiKey: 'stub',
      mainModel: 'stub-model',
      globalSettings: {
        serpApiKey: 'stub-serp',
        extractionModel: 'stub-extract',
        extractionPrompt: 'stub prompt',
        baseUrl: 'https://llm.example',
      },
    })

    // Regex fallback accepted because URL domain matches email domain.
    expect(intel.extracted.companyUrl).toBe('https://buyerco.com')
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock serpapi so fallback tests don't hit the real network.
const mockSerpSearch = vi.fn()
vi.mock('@/lib/intel/serpapi', () => ({
  serpSearch: (...args) => mockSerpSearch(...args),
}))

import { fetchWebsite } from '@/lib/intel/fetchWebsite'

function makeResponse({ status = 200, body = '<html><head><title>Test</title></head><body>Hello world content goes here.</body></html>', headers = {} } = {}) {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(body)
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    body: {
      getReader: () => {
        let sent = false
        return {
          read: async () => {
            if (sent) return { done: true, value: undefined }
            sent = true
            return { done: false, value: bytes }
          },
          cancel: async () => {},
        }
      },
    },
    text: async () => body,
  }
}

describe('fetchWebsite', () => {
  beforeEach(() => {
    mockSerpSearch.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses a browser User-Agent (not the SnapCheckBot UA)', async () => {
    const capturedInit = []
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      capturedInit.push(init)
      return makeResponse()
    }))
    await fetchWebsite('https://example.com')
    expect(capturedInit).toHaveLength(1)
    const ua = capturedInit[0].headers['User-Agent']
    expect(ua).not.toMatch(/SnapCheckBot/i)
    expect(ua).toMatch(/Mozilla\/5\.0.*Chrome/i)
  })

  it('detects Cloudflare challenge markers and returns failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => makeResponse({
      status: 200,
      body: '<html><head><title>Just a moment...</title></head><body><div class="cf-chl-widget"></div></body></html>',
    })))
    const out = await fetchWebsite('https://example.com')
    expect(out.status).toBe('failed')
    expect(out.error).toMatch(/cloudflare|challenge|blocked/i)
  })

  it('treats 403 / 429 / 503 as blocked (not just HTTP failed)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => makeResponse({ status: 403, body: 'Forbidden' })))
    const out = await fetchWebsite('https://example.com')
    expect(out.status).toBe('failed')
    expect(out.error).toMatch(/403|blocked/i)
  })

  it('falls back to SerpAPI site: search when direct fetch is blocked AND enableSerpFallback=true', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => makeResponse({ status: 403 })))
    // Aggregated output must clear the 200-char MIN_EXCERPT threshold, so
    // use realistic Google-style snippets rather than tiny placeholders.
    mockSerpSearch.mockResolvedValue({
      ok: true,
      query: 'site:example.com',
      results: [
        { title: 'Example Inc — About Us', link: 'https://example.com/about', snippet: 'Example Inc is a Shenzhen-based manufacturer of industrial sensors serving automotive and aerospace clients since 2012.' },
        { title: 'Example Inc — Products', link: 'https://example.com/products', snippet: 'Our product line includes temperature sensors, pressure gauges, and precision actuators shipped to 40+ countries.' },
        { title: 'Example Inc — Contact', link: 'https://example.com/contact', snippet: 'Headquarters in Shenzhen with regional offices in Frankfurt and Houston. Custom OEM inquiries welcome.' },
      ],
    })
    const out = await fetchWebsite('https://example.com', { enableSerpFallback: true, serpKey: 'k' })
    expect(out.status).toBe('ok')
    expect(out.source).toBe('serp_fallback')
    expect(out.excerpt).toContain('Example Inc')
    expect(mockSerpSearch).toHaveBeenCalledTimes(1)
    expect(mockSerpSearch.mock.calls[0][0].query).toMatch(/^site:example\.com/)
  })

  it('does NOT use SerpAPI fallback when enableSerpFallback=false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => makeResponse({ status: 403 })))
    const out = await fetchWebsite('https://example.com', { enableSerpFallback: false })
    expect(out.status).toBe('failed')
    expect(out.source).toBeUndefined()
    expect(mockSerpSearch).not.toHaveBeenCalled()
  })

  it('preserves the existing ok shape for successful direct fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => makeResponse({
      body: '<html><head><title>Acme Inc</title><meta property="og:site_name" content="Acme"/></head><body>We sell widgets.</body></html>',
    })))
    const out = await fetchWebsite('https://acme.com')
    expect(out.status).toBe('ok')
    expect(out.source).toBe('direct_fetch')
    expect(out.title).toBe('Acme Inc')
    expect(out.siteName).toBe('Acme')
    expect(out.excerpt).toContain('widgets')
  })

  it('returns skipped for empty / null URL (unchanged behavior)', async () => {
    const out = await fetchWebsite('')
    expect(out.status).toBe('skipped')
  })
})

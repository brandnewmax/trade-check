import { describe, it, expect } from 'vitest'
import { normalizeRequest, deriveOwnDomains } from '@/lib/requestNormalizer'

describe('normalizeRequest', () => {
  it('accepts new-shape fields as primary', () => {
    const out = normalizeRequest({
      request_id: 'req_1',
      inquiry_text: 'hi',
      company_profile: 'text',
      inquiry_images: [{ url: 'x' }],
      enable_intel: true,
      scan_mode: 'online',
    })
    expect(out).toEqual({
      request_id: 'req_1',
      inquiry_text: 'hi',
      company_profile: 'text',
      inquiry_images: [{ url: 'x' }],
      enable_intel: true,
      scan_mode: 'online',
    })
  })

  it('falls back to legacy field names', () => {
    const out = normalizeRequest({
      inquiry: 'legacy',
      company: { name: 'Acme' },
      images: ['a'],
      options: { enable_intel: true },
    })
    expect(out.inquiry_text).toBe('legacy')
    expect(out.company_profile).toEqual({ name: 'Acme' })
    expect(out.inquiry_images).toEqual(['a'])
    expect(out.enable_intel).toBe(true)
  })

  it('derives scan_mode from enable_intel when not explicit', () => {
    expect(normalizeRequest({ enable_intel: true }).scan_mode).toBe('online')
    expect(normalizeRequest({ enable_intel: false }).scan_mode).toBe('offline')
  })

  it('defaults enable_intel to false when absent', () => {
    expect(normalizeRequest({}).enable_intel).toBe(false)
  })
})

describe('deriveOwnDomains', () => {
  it('returns [] for null / undefined / empty', () => {
    expect(deriveOwnDomains(null)).toEqual([])
    expect(deriveOwnDomains(undefined)).toEqual([])
    expect(deriveOwnDomains('')).toEqual([])
    expect(deriveOwnDomains({})).toEqual([])
  })

  it('returns .website from object-form company_profile', () => {
    const out = deriveOwnDomains({
      name: 'Acme',
      website: 'https://acme.com',
      intro: 'we make things',
    })
    expect(out).toContain('acme.com')
    expect(out).toHaveLength(1)
  })

  it('normalizes .website with www / path / protocol', () => {
    expect(deriveOwnDomains({ website: 'https://www.acme.com/about' })).toEqual(['acme.com'])
    expect(deriveOwnDomains({ website: 'http://acme.com/' })).toEqual(['acme.com'])
    expect(deriveOwnDomains({ website: 'acme.com' })).toEqual(['acme.com'])
  })

  it('extracts all URLs and bare domains from string-form company_profile', () => {
    const profile = `# 星籽包装

官网：https://starseedpkg.com

我们主营环保包装材料，服务东南亚市场。
也在阿里巴巴店铺 alibaba.com/starseed 有入驻。
联系方式：sales@starseed.cn
`
    const out = deriveOwnDomains(profile)
    // starseedpkg.com from the markdown link
    expect(out).toContain('starseedpkg.com')
    // alibaba.com is a NON_COMPANY domain — should be filtered out
    expect(out).not.toContain('alibaba.com')
    // starseed.cn from the email domain (we want to exclude this too)
    expect(out).toContain('starseed.cn')
  })

  it('dedupes duplicate domains across the profile', () => {
    const profile = `Visit https://starseedpkg.com or www.starseedpkg.com/about. Our site: starseedpkg.com.`
    const out = deriveOwnDomains(profile)
    expect(out).toEqual(['starseedpkg.com'])
  })

  it('returns [] when string-form profile contains no recognizable own domain', () => {
    const profile = `我们是一家外贸公司，主营 LED 产品，面向东南亚市场。`
    const out = deriveOwnDomains(profile)
    expect(out).toEqual([])
  })

  it('handles both string and object forms of company_profile uniformly', () => {
    // This is the P1 scenario — SN may pass either form per contract §2.1
    const objectForm = { website: 'https://starseedpkg.com', name: 'Star Seed' }
    const stringForm = `Star Seed Packaging — 官网 https://starseedpkg.com`
    expect(deriveOwnDomains(objectForm)).toContain('starseedpkg.com')
    expect(deriveOwnDomains(stringForm)).toContain('starseedpkg.com')
  })

  it('extracts corporate email domain but not free email domains', () => {
    const profile = `联系: ceo@starseed.cn, support@gmail.com`
    const out = deriveOwnDomains(profile)
    expect(out).toContain('starseed.cn')
    expect(out).not.toContain('gmail.com')
  })
})

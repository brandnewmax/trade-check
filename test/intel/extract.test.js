import { describe, it, expect } from 'vitest'
import {
  parseExtractionJson,
  deriveCompanyUrlFromEmail,
  deriveCompanyUrlFromText,
} from '@/lib/intel/extract'

describe('parseExtractionJson', () => {
  it('parses a plain JSON object', () => {
    const out = parseExtractionJson('{"companyName":"ABC","email":null}')
    expect(out.companyName).toBe('ABC')
    expect(out.email).toBeNull()
  })

  it('unwraps a fenced code block', () => {
    const out = parseExtractionJson('```json\n{"companyName":"XYZ"}\n```')
    expect(out.companyName).toBe('XYZ')
  })

  it('recovers via regex when there is leading noise', () => {
    const raw = 'Sure! Here you go:\n{"companyName":"Noise Co","products":["led"]}\nEnd.'
    const out = parseExtractionJson(raw)
    expect(out.companyName).toBe('Noise Co')
    expect(out.products).toEqual(['led'])
  })

  it('returns null on totally unparseable input', () => {
    expect(parseExtractionJson('lol nope')).toBeNull()
  })

  it('normalizes missing fields to null / empty products', () => {
    const out = parseExtractionJson('{"companyName":"A"}')
    expect(out.personName).toBeNull()
    expect(out.companyUrl).toBeNull()
    expect(out.products).toEqual([])
  })

  it('extracts companyUrl when present', () => {
    const out = parseExtractionJson('{"companyName":"ABC","companyUrl":"https://abc.com"}')
    expect(out.companyUrl).toBe('https://abc.com')
  })
})

describe('deriveCompanyUrlFromEmail', () => {
  it('derives https URL from a corporate domain', () => {
    expect(deriveCompanyUrlFromEmail('john@abctrading.com')).toBe('https://abctrading.com')
  })

  it('normalizes uppercase to lowercase', () => {
    expect(deriveCompanyUrlFromEmail('JOHN@ABCTRADING.COM')).toBe('https://abctrading.com')
  })

  it('handles subdomains', () => {
    expect(deriveCompanyUrlFromEmail('buyer@mail.factory.co.uk')).toBe('https://mail.factory.co.uk')
  })

  it('returns null for Gmail', () => {
    expect(deriveCompanyUrlFromEmail('foo@gmail.com')).toBeNull()
  })

  it('returns null for Outlook / Yahoo / AOL', () => {
    expect(deriveCompanyUrlFromEmail('a@outlook.com')).toBeNull()
    expect(deriveCompanyUrlFromEmail('a@yahoo.com')).toBeNull()
    expect(deriveCompanyUrlFromEmail('a@aol.com')).toBeNull()
  })

  it('returns null for common Chinese free providers', () => {
    expect(deriveCompanyUrlFromEmail('a@163.com')).toBeNull()
    expect(deriveCompanyUrlFromEmail('b@qq.com')).toBeNull()
    expect(deriveCompanyUrlFromEmail('c@126.com')).toBeNull()
    expect(deriveCompanyUrlFromEmail('d@sina.com')).toBeNull()
  })

  it('returns null on garbage input', () => {
    expect(deriveCompanyUrlFromEmail('not an email')).toBeNull()
    expect(deriveCompanyUrlFromEmail(null)).toBeNull()
    expect(deriveCompanyUrlFromEmail('')).toBeNull()
    expect(deriveCompanyUrlFromEmail('foo@')).toBeNull()
  })
})

describe('deriveCompanyUrlFromText', () => {
  it('extracts an https URL from the middle of text', () => {
    const out = deriveCompanyUrlFromText('Hi, please visit https://abctrading.com for details.')
    expect(out).toBe('https://abctrading.com')
  })

  it('extracts a www-prefixed domain without protocol', () => {
    const out = deriveCompanyUrlFromText('Our site: www.xyz.co.uk/about')
    expect(out).toBe('https://xyz.co.uk')
  })

  it('ignores plain email addresses (no http/www prefix)', () => {
    const out = deriveCompanyUrlFromText('Email me at info@example.com')
    expect(out).toBeNull()
  })

  it('skips known social / marketplace / search domains', () => {
    expect(deriveCompanyUrlFromText('find me on https://linkedin.com/in/foo')).toBeNull()
    expect(deriveCompanyUrlFromText('https://www.facebook.com/pages/foo')).toBeNull()
    expect(deriveCompanyUrlFromText('alibaba.com listing https://www.alibaba.com/xyz')).toBeNull()
  })

  it('excludes the user-provided domain', () => {
    const out = deriveCompanyUrlFromText(
      'Loved your product at https://konmison.com - we are at https://thegoodbuyer.com',
      'konmison.com'
    )
    expect(out).toBe('https://thegoodbuyer.com')
  })

  it('excludes the user-provided domain when passed with protocol + www', () => {
    const out = deriveCompanyUrlFromText(
      'yours: https://www.konmison.com theirs: https://mybuyer.io',
      'https://www.konmison.com'
    )
    expect(out).toBe('https://mybuyer.io')
  })

  it('excludes the user-provided domain when a subdomain is quoted', () => {
    const out = deriveCompanyUrlFromText(
      'we like shop.konmison.com products, our site www.mybuyer.io',
      'konmison.com'
    )
    expect(out).toBe('https://mybuyer.io')
  })

  it('returns null when no URL present', () => {
    expect(deriveCompanyUrlFromText('just some plain text')).toBeNull()
    expect(deriveCompanyUrlFromText('')).toBeNull()
    expect(deriveCompanyUrlFromText(null)).toBeNull()
  })

  it('returns the first valid domain, skipping blacklisted ones along the way', () => {
    const out = deriveCompanyUrlFromText(
      'Follow us on https://twitter.com/foo and visit https://mycorp.com'
    )
    expect(out).toBe('https://mycorp.com')
  })

  // ── Bare-domain fallback ──────────────────────────────────────────────

  it('extracts a bare domain (no protocol, no www)', () => {
    expect(deriveCompanyUrlFromText('Please visit abctrading.com for details.'))
      .toBe('https://abctrading.com')
  })

  it('extracts a bare domain at the start of a sentence', () => {
    expect(deriveCompanyUrlFromText('abctrading.com is our official site'))
      .toBe('https://abctrading.com')
  })

  it('extracts a bare domain followed by a period at end of sentence', () => {
    expect(deriveCompanyUrlFromText('Our site: mycorp.com. Let us know.'))
      .toBe('https://mycorp.com')
  })

  it('extracts a bare domain in Chinese-context prose', () => {
    expect(deriveCompanyUrlFromText('我们的官网是 abctrading.com,欢迎访问'))
      .toBe('https://abctrading.com')
  })

  it('extracts a bare domain wrapped in parentheses', () => {
    expect(deriveCompanyUrlFromText('Check our site (abctrading.com)!'))
      .toBe('https://abctrading.com')
  })

  it('matches a full subdomain as a bare domain', () => {
    expect(deriveCompanyUrlFromText('platform: shop.bigbrand.com'))
      .toBe('https://shop.bigbrand.com')
  })

  it('bare pass does NOT match inside an email address', () => {
    expect(deriveCompanyUrlFromText('reach out at info@example.com'))
      .toBeNull()
  })

  it('bare pass does NOT match blacklisted domains', () => {
    expect(deriveCompanyUrlFromText('find us on facebook.com/mycompany'))
      .toBeNull()
    expect(deriveCompanyUrlFromText('listing on alibaba.com'))
      .toBeNull()
  })

  it('bare pass still honors excludeDomain', () => {
    expect(deriveCompanyUrlFromText(
      'we love konmison.com — we are at thegoodbuyer.com',
      'konmison.com'
    )).toBe('https://thegoodbuyer.com')
  })

  it('strong pass still wins over bare when both present', () => {
    expect(deriveCompanyUrlFromText(
      'main: https://mycorp.com alt: other.com'
    )).toBe('https://mycorp.com')
  })

  // ── Array-form excludeDomain (P1: string | string[]) ─────────────────

  it('accepts string[] as excludeDomain and excludes every listed domain', () => {
    const out = deriveCompanyUrlFromText(
      'We love https://konmison.com and https://starseedpkg.com — our site is https://thegoodbuyer.com',
      ['konmison.com', 'starseedpkg.com']
    )
    expect(out).toBe('https://thegoodbuyer.com')
  })

  it('array form excludes bare-domain matches too', () => {
    const out = deriveCompanyUrlFromText(
      'saw konmison.com and starseedpkg.com — us: thegoodbuyer.com',
      ['konmison.com', 'starseedpkg.com']
    )
    expect(out).toBe('https://thegoodbuyer.com')
  })

  it('array form accepts entries with protocol / www / subdomain variants', () => {
    const out = deriveCompanyUrlFromText(
      'I saw https://www.starseedpkg.com — at shop.konmison.com/products — us https://buyer.co',
      ['https://www.konmison.com/', 'https://starseedpkg.com']
    )
    expect(out).toBe('https://buyer.co')
  })

  it('empty array behaves like no exclude', () => {
    const out = deriveCompanyUrlFromText(
      'visit https://anywhere.com',
      []
    )
    expect(out).toBe('https://anywhere.com')
  })

  it('array with a single domain behaves like string form', () => {
    const out = deriveCompanyUrlFromText(
      'love https://konmison.com theirs https://other.com',
      ['konmison.com']
    )
    expect(out).toBe('https://other.com')
  })

  // The real-world P1 scenario: SN passes company_profile as a string that
  // mentions the seller's own domain; inquiry text also mentions that same
  // domain ("I saw your website starseedpkg.com..."). With an array of all
  // own-domains derived from the profile, the regex fallback must skip the
  // seller's own domain and either return null or the buyer's unrelated one.
  it('real SN scenario — seller domain mentioned in inquiry is excluded', () => {
    const out = deriveCompanyUrlFromText(
      'Hello, I saw your website starseedpkg.com and am interested in bulk LED panels.',
      ['starseedpkg.com']
    )
    expect(out).toBeNull()
  })
})

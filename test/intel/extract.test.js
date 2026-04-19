import { describe, it, expect } from 'vitest'
import {
  parseExtractionJson,
  deriveCompanyUrlFromEmail,
  deriveCompanyUrlFromText,
  cleanExtractedCompanyUrl,
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

  // ── AI tool blocking (bug: ChatGPT/Claude URLs in screenshots leak through) ─

  it('rejects chatgpt.com (strong)', () => {
    expect(deriveCompanyUrlFromText('see https://chatgpt.com/c/abc123')).toBeNull()
  })

  it('rejects bare chatgpt.com', () => {
    expect(deriveCompanyUrlFromText('I asked chatgpt.com to help draft this')).toBeNull()
  })

  it('rejects claude.ai', () => {
    expect(deriveCompanyUrlFromText('drafted via https://claude.ai/chat/xyz')).toBeNull()
  })

  it('rejects openai.com (strong)', () => {
    expect(deriveCompanyUrlFromText('powered by https://openai.com')).toBeNull()
  })

  it('rejects bare openai.com', () => {
    expect(deriveCompanyUrlFromText('used openai.com tech for translation')).toBeNull()
  })

  it('rejects chat.openai.com via parent domain match', () => {
    expect(deriveCompanyUrlFromText('see https://chat.openai.com/share/x')).toBeNull()
  })

  it('rejects copilot.microsoft.com but not microsoft.com itself', () => {
    expect(deriveCompanyUrlFromText('I used https://copilot.microsoft.com/chat')).toBeNull()
    // microsoft.com is NOT blacklisted (could be a real customer's adjacent vendor)
    expect(deriveCompanyUrlFromText('see microsoft.com for info')).toBe('https://microsoft.com')
  })

  it('rejects mainstream Chinese AI tools', () => {
    expect(deriveCompanyUrlFromText('用 doubao.com 翻译的')).toBeNull()
    expect(deriveCompanyUrlFromText('via kimi.com analysis')).toBeNull()
    expect(deriveCompanyUrlFromText('see https://deepseek.com/chat')).toBeNull()
    expect(deriveCompanyUrlFromText('via https://moonshot.cn')).toBeNull()
  })

  it('still picks the real company URL after AI tool noise', () => {
    expect(deriveCompanyUrlFromText(
      'Drafted with chatgpt.com — our company is at https://realfactory.com'
    )).toBe('https://realfactory.com')
  })
})

describe('deriveCompanyUrlFromEmail - AI tool blocking', () => {
  it('rejects @openai.com', () => {
    expect(deriveCompanyUrlFromEmail('noreply@openai.com')).toBeNull()
  })

  it('rejects @anthropic.com', () => {
    expect(deriveCompanyUrlFromEmail('hello@anthropic.com')).toBeNull()
  })

  it('rejects @chatgpt.com', () => {
    expect(deriveCompanyUrlFromEmail('foo@chatgpt.com')).toBeNull()
  })
})

describe('cleanExtractedCompanyUrl', () => {
  it('returns the URL when it is a normal corporate URL', () => {
    expect(cleanExtractedCompanyUrl('https://abctrading.com', 'konmison.com'))
      .toBe('https://abctrading.com')
  })

  it('returns null when URL matches the user own domain', () => {
    expect(cleanExtractedCompanyUrl('https://konmison.com/about', 'konmison.com'))
      .toBeNull()
  })

  it('returns null when URL matches user own domain with www / protocol stripped', () => {
    expect(cleanExtractedCompanyUrl('https://www.konmison.com', 'https://konmison.com'))
      .toBeNull()
  })

  it('returns null when URL is an AI tool (chatgpt.com)', () => {
    expect(cleanExtractedCompanyUrl('https://chatgpt.com/c/abc', null)).toBeNull()
  })

  it('returns null when URL is an AI tool (claude.ai)', () => {
    expect(cleanExtractedCompanyUrl('https://claude.ai/chat/123', null)).toBeNull()
  })

  it('returns null when URL is an AI tool subdomain (chat.openai.com → parent match)', () => {
    expect(cleanExtractedCompanyUrl('https://chat.openai.com/share/123', null)).toBeNull()
  })

  it('returns null for known social/marketplace domains', () => {
    expect(cleanExtractedCompanyUrl('https://linkedin.com/in/foo', null)).toBeNull()
    expect(cleanExtractedCompanyUrl('https://www.alibaba.com/xyz', null)).toBeNull()
  })

  it('returns null for Chinese AI tools (doubao, kimi, deepseek)', () => {
    expect(cleanExtractedCompanyUrl('https://doubao.com/chat', null)).toBeNull()
    expect(cleanExtractedCompanyUrl('https://kimi.com', null)).toBeNull()
    expect(cleanExtractedCompanyUrl('https://deepseek.com', null)).toBeNull()
  })

  it('returns null for null / empty input', () => {
    expect(cleanExtractedCompanyUrl(null, null)).toBeNull()
    expect(cleanExtractedCompanyUrl('', 'konmison.com')).toBeNull()
  })

  it('returns the URL when userUrl is omitted and URL is acceptable', () => {
    expect(cleanExtractedCompanyUrl('https://abctrading.com')).toBe('https://abctrading.com')
  })
})

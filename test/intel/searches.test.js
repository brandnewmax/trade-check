import { describe, it, expect } from 'vitest'
import { buildLinkedInQuery } from '@/lib/intel/searches/linkedin'
import { buildFacebookQuery } from '@/lib/intel/searches/facebook'
import { buildPanjivaQuery } from '@/lib/intel/searches/panjiva'
import { buildNegativeQuery } from '@/lib/intel/searches/negative'
import { buildGeneralQuery } from '@/lib/intel/searches/general'

describe('buildLinkedInQuery', () => {
  it('uses person + company when both are present', () => {
    const q = buildLinkedInQuery({ personName: 'John Smith', companyName: 'ABC Ltd' })
    expect(q).toBe('site:linkedin.com/in "John Smith" "ABC Ltd"')
  })

  it('falls back to person only', () => {
    const q = buildLinkedInQuery({ personName: 'Jane Doe', companyName: null })
    expect(q).toBe('site:linkedin.com/in "Jane Doe"')
  })

  it('falls back to company only (no /in path)', () => {
    const q = buildLinkedInQuery({ personName: null, companyName: 'ABC Ltd' })
    expect(q).toBe('site:linkedin.com/company "ABC Ltd"')
  })

  it('returns null when nothing to search', () => {
    expect(buildLinkedInQuery({ personName: null, companyName: null })).toBeNull()
  })
})

describe('buildFacebookQuery', () => {
  it('prefers company name', () => {
    expect(buildFacebookQuery({ companyName: 'ABC Ltd', personName: 'x' }))
      .toBe('site:facebook.com "ABC Ltd"')
  })
  it('falls back to person name', () => {
    expect(buildFacebookQuery({ companyName: null, personName: 'Jane Doe' }))
      .toBe('site:facebook.com "Jane Doe"')
  })
  it('returns null with neither', () => {
    expect(buildFacebookQuery({})).toBeNull()
  })
})

describe('buildPanjivaQuery', () => {
  it('requires company name', () => {
    expect(buildPanjivaQuery({ companyName: 'ABC Ltd' }))
      .toBe('site:panjiva.com "ABC Ltd"')
  })
  it('returns null without company name', () => {
    expect(buildPanjivaQuery({ personName: 'John' })).toBeNull()
  })
})

describe('buildNegativeQuery', () => {
  it('combines company name and fraud keywords', () => {
    expect(buildNegativeQuery({ companyName: 'ABC Ltd' }))
      .toBe('"ABC Ltd" (scam OR fraud OR 骗 OR complaint)')
  })
  it('falls back to email when company missing', () => {
    expect(buildNegativeQuery({ email: 'a@b.com' }))
      .toBe('"a@b.com" (scam OR fraud OR 骗 OR complaint)')
  })
  it('falls back to person name', () => {
    expect(buildNegativeQuery({ personName: 'John Doe' }))
      .toBe('"John Doe" (scam OR fraud OR 骗 OR complaint)')
  })
  it('returns null with no identifier', () => {
    expect(buildNegativeQuery({})).toBeNull()
  })
})

describe('buildGeneralQuery', () => {
  it('uses company name when present', () => {
    expect(buildGeneralQuery({ companyName: 'ABC Ltd' })).toBe('"ABC Ltd"')
  })
  it('returns null without company name', () => {
    expect(buildGeneralQuery({ personName: 'X' })).toBeNull()
  })
})

import { buildPhoneQuery } from '@/lib/intel/searches/phone'

describe('buildPhoneQuery', () => {
  it('quotes a simple phone number', () => {
    expect(buildPhoneQuery({ phone: '+15551234567' })).toBe('"+15551234567"')
  })
  it('strips spaces, hyphens, and parentheses before quoting', () => {
    expect(buildPhoneQuery({ phone: '+1 (555) 123-4567' })).toBe('"+15551234567"')
  })
  it('returns null when phone is missing', () => {
    expect(buildPhoneQuery({})).toBeNull()
    expect(buildPhoneQuery({ phone: null })).toBeNull()
  })
  it('returns null for unreasonably short strings', () => {
    expect(buildPhoneQuery({ phone: '123' })).toBeNull()
  })
})

import { buildMapsQuery } from '@/lib/intel/searches/maps'

describe('buildMapsQuery', () => {
  it('uses companyName + address when both present', () => {
    expect(buildMapsQuery({ companyName: 'PROSTYLE', address: 'Kralja Petra 1, Belgrade' }))
      .toBe('"PROSTYLE" Kralja Petra 1, Belgrade')
  })
  it('falls back to companyName + country when address missing', () => {
    expect(buildMapsQuery({ companyName: 'PROSTYLE', country: 'Serbia' }))
      .toBe('"PROSTYLE" Serbia')
  })
  it('prefers address over country when both present', () => {
    expect(buildMapsQuery({ companyName: 'X', address: '1 Main St', country: 'US' }))
      .toBe('"X" 1 Main St')
  })
  it('uses just quoted companyName when no location signal', () => {
    expect(buildMapsQuery({ companyName: 'X' })).toBe('"X"')
  })
  it('returns null without companyName', () => {
    expect(buildMapsQuery({ address: '1 Main St' })).toBeNull()
    expect(buildMapsQuery({ country: 'US' })).toBeNull()
    expect(buildMapsQuery({})).toBeNull()
  })
  it('trims whitespace', () => {
    expect(buildMapsQuery({ companyName: '  PROSTYLE  ', address: '  Belgrade  ' }))
      .toBe('"PROSTYLE" Belgrade')
  })
})

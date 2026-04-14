import { describe, it, expect } from 'vitest'
import { parseExtractionJson } from '@/lib/intel/extract'

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

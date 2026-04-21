import { describe, it, expect } from 'vitest'
import { resolveExtractionEndpoint } from '@/lib/intel'

const base = {
  baseUrl: 'https://main.example.com/v1',
  extractionBaseUrl: '',
  extractionApiKey: '',
  extractionModel: 'gemini-2.5-flash',
  extractionModelVision: 'gemini-3.1-pro',
}

describe('resolveExtractionEndpoint', () => {
  it('uses main endpoint + user apiKey when separate fields are blank (text case)', () => {
    const out = resolveExtractionEndpoint(base, 'user-main-key', false)
    expect(out).toEqual({
      baseUrl: 'https://main.example.com/v1',
      apiKey: 'user-main-key',
      model: 'gemini-2.5-flash',
    })
  })

  it('uses main endpoint + user apiKey when separate fields are blank (vision case)', () => {
    const out = resolveExtractionEndpoint(base, 'user-main-key', true)
    expect(out).toEqual({
      baseUrl: 'https://main.example.com/v1',
      apiKey: 'user-main-key',
      model: 'gemini-3.1-pro',
    })
  })

  it('uses separate endpoint + separate apiKey when both filled (text case)', () => {
    const settings = {
      ...base,
      extractionBaseUrl: 'https://extract.example.com/v1',
      extractionApiKey: 'extract-key-xyz',
    }
    const out = resolveExtractionEndpoint(settings, 'user-main-key', false)
    expect(out).toEqual({
      baseUrl: 'https://extract.example.com/v1',
      apiKey: 'extract-key-xyz',
      model: 'gemini-2.5-flash',
    })
  })

  it('uses separate endpoint + separate apiKey when both filled (vision case)', () => {
    const settings = {
      ...base,
      extractionBaseUrl: 'https://extract.example.com/v1',
      extractionApiKey: 'extract-key-xyz',
    }
    const out = resolveExtractionEndpoint(settings, 'user-main-key', true)
    expect(out).toEqual({
      baseUrl: 'https://extract.example.com/v1',
      apiKey: 'extract-key-xyz',
      model: 'gemini-3.1-pro',
    })
  })

  it('treats empty strings as blank (falls back to main)', () => {
    const settings = {
      ...base,
      extractionBaseUrl: '',
      extractionApiKey: '',
    }
    const out = resolveExtractionEndpoint(settings, 'user-main-key', false)
    expect(out.baseUrl).toBe('https://main.example.com/v1')
    expect(out.apiKey).toBe('user-main-key')
  })

  it('if only one of the separate pair is filled, falls back to main (defensive — save validation prevents this state)', () => {
    const onlyBase = { ...base, extractionBaseUrl: 'https://extract.example.com', extractionApiKey: '' }
    const onlyKey = { ...base, extractionBaseUrl: '', extractionApiKey: 'key' }
    expect(resolveExtractionEndpoint(onlyBase, 'user-key', false).baseUrl).toBe(base.baseUrl)
    expect(resolveExtractionEndpoint(onlyKey, 'user-key', false).baseUrl).toBe(base.baseUrl)
  })
})

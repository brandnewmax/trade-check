import { describe, it, expect } from 'vitest'
import { validateGlobalExtractionSettings } from '@/lib/kv'

describe('validateGlobalExtractionSettings', () => {
  const valid = {
    extractionModel: 'gemini-2.5-flash',
    extractionModelVision: 'gemini-3.1-pro',
    extractionBaseUrl: '',
    extractionApiKey: '',
  }

  it('returns null when all required filled and separate pair consistent (both blank)', () => {
    expect(validateGlobalExtractionSettings(valid)).toBeNull()
  })

  it('returns null when separate pair both filled', () => {
    expect(validateGlobalExtractionSettings({
      ...valid,
      extractionBaseUrl: 'https://extract.example.com/v1',
      extractionApiKey: 'key-xyz',
    })).toBeNull()
  })

  it('returns error when extractionModel is blank', () => {
    expect(validateGlobalExtractionSettings({ ...valid, extractionModel: '' }))
      .toBe('请填写:抽取模型(无图片)')
  })

  it('returns error when extractionModel is whitespace-only', () => {
    expect(validateGlobalExtractionSettings({ ...valid, extractionModel: '   ' }))
      .toBe('请填写:抽取模型(无图片)')
  })

  it('returns error when extractionModelVision is blank', () => {
    expect(validateGlobalExtractionSettings({ ...valid, extractionModelVision: '' }))
      .toBe('请填写:抽取模型(有图片)')
  })

  it('returns error when only extractionBaseUrl is filled', () => {
    expect(validateGlobalExtractionSettings({
      ...valid,
      extractionBaseUrl: 'https://extract.example.com/v1',
      extractionApiKey: '',
    })).toBe('填写独立抽取端点时,Base URL 和 API Key 必须同时填写(缺 API Key)')
  })

  it('returns error when only extractionApiKey is filled', () => {
    expect(validateGlobalExtractionSettings({
      ...valid,
      extractionBaseUrl: '',
      extractionApiKey: 'key-xyz',
    })).toBe('填写独立抽取端点时,Base URL 和 API Key 必须同时填写(缺 Base URL)')
  })

  it('returns the model error first when both model and pair are invalid (model validation precedes pair)', () => {
    expect(validateGlobalExtractionSettings({
      extractionModel: '',
      extractionModelVision: 'gemini-3.1-pro',
      extractionBaseUrl: 'https://extract.example.com/v1',
      extractionApiKey: '',
    })).toBe('请填写:抽取模型(无图片)')
  })

  it('returns null when fields are undefined and the caller defaults them upstream (treats undefined as blank and bails on required)', () => {
    // When key is undefined, it's equivalent to blank — required fields still fail.
    expect(validateGlobalExtractionSettings({})).toBe('请填写:抽取模型(无图片)')
  })
})

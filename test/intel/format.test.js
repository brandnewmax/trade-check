import { describe, it, expect } from 'vitest'
import { formatIntelAsBriefing } from '@/lib/intel/format'

const okIntel = {
  extracted: {
    companyName: 'ABC Ltd',
    personName: 'John Smith',
    personTitle: 'Buyer',
    email: 'john@abc.com',
    phone: '+12345',
    country: 'US',
    products: ['LED'],
  },
  website: { status: 'ok', title: 'ABC Home', excerpt: 'hello world' },
  wayback: { status: 'ok', firstSnapshot: '2018-03-12', ageYears: 7 },
  linkedin: {
    status: 'ok',
    query: 'site:linkedin.com/in "John Smith" "ABC Ltd"',
    found: true,
    topResults: [{ title: 'John Smith - Buyer', link: 'https://linkedin.com/in/x', snippet: '...' }],
  },
  facebook: { status: 'ok', query: 'site:facebook.com "ABC Ltd"', found: false, topResults: [] },
  panjiva: { status: 'ok', query: 'site:panjiva.com "ABC Ltd"', hasRecord: true, resultCount: 12, topResults: [] },
  negative: { status: 'ok', query: '"ABC Ltd" (scam)', hitCount: 0, hits: [] },
  generalSearch: { status: 'ok', query: '"ABC Ltd"', topResults: [] },
}

describe('formatIntelAsBriefing', () => {
  it('includes all 8 section headers in order', () => {
    const md = formatIntelAsBriefing(okIntel)
    const positions = [
      '## 1. 抽取到的实体',
      '## 2. 公司网站',
      '## 3. 建站时间',
      '## 4. LinkedIn',
      '## 5. Facebook',
      '## 6. Panjiva',
      '## 7. 负面',
      '## 8. 通用搜索',
    ].map(h => md.indexOf(h))
    expect(positions.every(p => p >= 0)).toBe(true)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1])
    }
  })

  it('renders failed status explicitly', () => {
    const broken = { ...okIntel, linkedin: { status: 'failed', error: 'HTTP 500' } }
    const md = formatIntelAsBriefing(broken)
    expect(md).toMatch(/LinkedIn[\s\S]*失败[\s\S]*HTTP 500/)
  })

  it('renders skipped status explicitly', () => {
    const skipped = { ...okIntel, panjiva: { status: 'skipped', error: '缺少公司名' } }
    const md = formatIntelAsBriefing(skipped)
    expect(md).toMatch(/Panjiva[\s\S]*跳过[\s\S]*缺少公司名/)
  })

  it('handles null extracted', () => {
    const md = formatIntelAsBriefing({ ...okIntel, extracted: null })
    expect(md).toContain('未能识别')
  })
})

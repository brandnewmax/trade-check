import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@upstash/redis', () => {
  const store = new Map()
  const calls = []
  return {
    Redis: class {
      constructor() {}
      hset = vi.fn(async (key, data) => { calls.push(['hset', key, data]); store.set(key, { ...(store.get(key) || {}), ...data }); return 1 })
      hget = vi.fn(async (key, field) => (store.get(key) || {})[field])
      hgetall = vi.fn(async (key) => store.get(key) || null)
      zadd = vi.fn(async (key, ...args) => { calls.push(['zadd', key, args]); return 1 })
      zrange = vi.fn(async () => [])
      rpush = vi.fn(async (key, val) => { calls.push(['rpush', key, val]); const arr = store.get(key) || []; arr.push(val); store.set(key, arr); return arr.length })
      lrange = vi.fn(async (key) => store.get(key) || [])
      expire = vi.fn(async () => 1)
      del = vi.fn(async (key) => { store.delete(key); return 1 })
    },
    __store: store,
    __calls: calls,
    __reset: () => { store.clear(); calls.length = 0 },
  }
})

describe('debug.js env helpers', () => {
  beforeEach(() => {
    delete process.env.DEBUG_TRACE_ENABLED
    delete process.env.DEBUG_TRACE_TTL_DAYS
    delete process.env.DEBUG_TRACE_MAX_PAYLOAD_KB
    delete process.env.DEBUG_TRACE_MAX_IMAGE_KB
  })

  it('isTraceEnabled defaults to true when unset', async () => {
    const { isTraceEnabled } = await import('@/lib/debug')
    expect(isTraceEnabled()).toBe(true)
  })

  it('isTraceEnabled returns false when DEBUG_TRACE_ENABLED=false', async () => {
    process.env.DEBUG_TRACE_ENABLED = 'false'
    const mod = await import('@/lib/debug?bust=1')
    expect(mod.isTraceEnabled()).toBe(false)
  })

  it('getConfig reads TTL and payload limits with defaults', async () => {
    const { getConfig } = await import('@/lib/debug?bust=2')
    const c = getConfig()
    expect(c.ttlDays).toBe(14)
    expect(c.maxPayloadKB).toBe(8)
    expect(c.maxImageKB).toBe(256)
  })

  it('getConfig reads TTL override from env', async () => {
    process.env.DEBUG_TRACE_TTL_DAYS = '7'
    process.env.DEBUG_TRACE_MAX_PAYLOAD_KB = '16'
    const { getConfig } = await import('@/lib/debug?bust=3')
    const c = getConfig()
    expect(c.ttlDays).toBe(7)
    expect(c.maxPayloadKB).toBe(16)
  })
})

describe('truncatePayload', () => {
  it('returns payload unchanged when under limit', async () => {
    const { truncatePayload } = await import('@/lib/debug?bust=trunc1')
    const obj = { a: 'hello', b: 123 }
    const out = truncatePayload(obj, 8)
    expect(out.truncated).toBe(false)
    expect(out.payload).toEqual(obj)
    expect(out.size).toBeGreaterThan(0)
  })

  it('truncates payload when over limit (string field)', async () => {
    const { truncatePayload } = await import('@/lib/debug?bust=trunc2')
    const big = { text: 'x'.repeat(20000) }
    const out = truncatePayload(big, 8) // 8 KB = 8192 bytes
    expect(out.truncated).toBe(true)
    expect(out.size).toBeGreaterThan(8192)
    expect(JSON.stringify(out.payload).length).toBeLessThanOrEqual(9000)
    expect(out.payload.__truncated).toBe(true)
  })

  it('records original size even after truncation', async () => {
    const { truncatePayload } = await import('@/lib/debug?bust=trunc3')
    const big = { text: 'a'.repeat(100000) }
    const out = truncatePayload(big, 8)
    expect(out.size).toBeGreaterThan(100000)
  })
})

describe('serializeImages', () => {
  it('serializes small base64 image inline', async () => {
    const { serializeImages } = await import('@/lib/debug?bust=img1')
    const images = [
      { base64: 'aGVsbG8=', type: 'image/png' },  // 'hello'
    ]
    const out = serializeImages(images, 256)
    expect(out).toHaveLength(1)
    expect(out[0].type).toBe('image/png')
    expect(out[0].size).toBe(5)
    expect(out[0].sha256).toBeTruthy()
    expect(out[0].base64).toBe('aGVsbG8=')
    expect(out[0].truncated).toBe(false)
  })

  it('truncates base64 larger than maxImageKB', async () => {
    const { serializeImages } = await import('@/lib/debug?bust=img2')
    // 300 KB of 'A' characters → base64 = ~400 KB (exceeds 256 KB)
    const big = Buffer.alloc(300 * 1024, 'A').toString('base64')
    const out = serializeImages([{ base64: big, type: 'image/jpeg' }], 256)
    expect(out[0].truncated).toBe(true)
    expect(out[0].sha256).toBeTruthy()
    expect(out[0].base64.length).toBeLessThanOrEqual(128 * 1024)
  })

  it('preserves url field when present', async () => {
    const { serializeImages } = await import('@/lib/debug?bust=img3')
    const images = [{ url: 'https://example.com/x.jpg', type: 'image/jpeg' }]
    const out = serializeImages(images, 256)
    expect(out[0].url).toBe('https://example.com/x.jpg')
    expect(out[0].base64).toBeUndefined()
  })

  it('returns empty array for null/undefined input', async () => {
    const { serializeImages } = await import('@/lib/debug?bust=img4')
    expect(serializeImages(null, 256)).toEqual([])
    expect(serializeImages(undefined, 256)).toEqual([])
    expect(serializeImages([], 256)).toEqual([])
  })
})

describe('key helpers', () => {
  it('utcDateKey formats YYYYMMDD in UTC', async () => {
    const { utcDateKey } = await import('@/lib/debug?bust=key1')
    const d = new Date('2026-04-19T23:59:00Z')
    expect(utcDateKey(d)).toBe('20260419')
  })

  it('metaKey produces debug:meta:YYYYMMDD:requestId', async () => {
    const { metaKey } = await import('@/lib/debug?bust=key2')
    expect(metaKey('20260419', 'abc')).toBe('debug:meta:20260419:abc')
  })

  it('traceKey produces debug:trace:YYYYMMDD:requestId', async () => {
    const { traceKey } = await import('@/lib/debug?bust=key3')
    expect(traceKey('20260419', 'abc')).toBe('debug:trace:20260419:abc')
  })

  it('indexKey produces debug:index:YYYYMMDD', async () => {
    const { indexKey } = await import('@/lib/debug?bust=key4')
    expect(indexKey('20260419')).toBe('debug:index:20260419')
  })
})

describe('startTrace / endTrace', () => {
  beforeEach(async () => {
    process.env.DEBUG_TRACE_ENABLED = 'true'
    const mod = await import('@upstash/redis')
    mod.__reset?.()
  })

  it('startTrace writes meta hash and index zset', async () => {
    const { startTrace } = await import('@/lib/debug?bust=start1')
    const redisMod = await import('@upstash/redis')
    await startTrace({
      requestId: 'req-123',
      route: 'v1/analyze',
      startMs: 1745000000000,
      meta: { scanMode: 'online', enableIntel: true, caller: 'sn' },
    })
    const calls = redisMod.__calls
    expect(calls.some(c => c[0] === 'hset' && c[1].startsWith('debug:meta:'))).toBe(true)
    expect(calls.some(c => c[0] === 'zadd' && c[1].startsWith('debug:index:'))).toBe(true)
  })

  it('startTrace is noop when DEBUG_TRACE_ENABLED=false', async () => {
    process.env.DEBUG_TRACE_ENABLED = 'false'
    const { startTrace } = await import('@/lib/debug?bust=start2')
    const redisMod = await import('@upstash/redis')
    redisMod.__reset()
    await startTrace({ requestId: 'x', route: 'v1/analyze', startMs: 0, meta: {} })
    expect(redisMod.__calls).toHaveLength(0)
  })

  it('endTrace updates meta with status/endMs/duration', async () => {
    const { startTrace, endTrace } = await import('@/lib/debug?bust=end1')
    const redisMod = await import('@upstash/redis')
    redisMod.__reset()
    await startTrace({ requestId: 'r2', route: 'analyze', startMs: 1000, meta: {} })
    await endTrace({ requestId: 'r2', startMs: 1000, endMs: 3000, status: 'success', outcome: { riskLevel: 'high' } })
    const hsets = redisMod.__calls.filter(c => c[0] === 'hset')
    expect(hsets.length).toBeGreaterThanOrEqual(2)
    const last = hsets[hsets.length - 1][2]
    expect(last.status).toBe('success')
    expect(last.endMs).toBe(3000)
    expect(last.durationMs).toBe(2000)
  })

  it('endTrace never throws when Redis fails', async () => {
    const { endTrace } = await import('@/lib/debug?bust=end2')
    await expect(endTrace({ requestId: 'missing', startMs: 0, endMs: 1, status: 'error' })).resolves.not.toThrow()
  })
})

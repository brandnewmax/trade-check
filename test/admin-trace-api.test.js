import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))
vi.mock('@/lib/debug', () => ({
  fetchTraceList: vi.fn(),
  fetchTraceDetail: vi.fn(),
}))

describe('GET /api/admin/trace (list)', () => {
  beforeEach(async () => {
    const { requireAdmin } = await import('@/lib/auth')
    const { fetchTraceList } = await import('@/lib/debug')
    requireAdmin.mockReset()
    fetchTraceList.mockReset()
  })

  it('401 when not authenticated', async () => {
    const { requireAdmin } = await import('@/lib/auth')
    requireAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    const { GET } = await import('@/src/app/api/admin/trace/route')
    const req = new Request('http://x/api/admin/trace?date=20260419')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('403 when authenticated but not admin', async () => {
    const { requireAdmin } = await import('@/lib/auth')
    requireAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    const { GET } = await import('@/src/app/api/admin/trace/route')
    const res = await GET(new Request('http://x/api/admin/trace'))
    expect(res.status).toBe(403)
  })

  it('200 returns list for admin', async () => {
    const { requireAdmin } = await import('@/lib/auth')
    const { fetchTraceList } = await import('@/lib/debug')
    requireAdmin.mockResolvedValue({ session: { email: 'admin@x', role: 'admin' } })
    fetchTraceList.mockResolvedValue({
      items: [{ requestId: 'r1', route: 'v1/analyze', status: 'success' }],
      nextCursor: null,
    })
    const { GET } = await import('@/src/app/api/admin/trace/route')
    const res = await GET(new Request('http://x/api/admin/trace?date=20260419'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.data.items).toHaveLength(1)
  })

  it('passes filter params to fetchTraceList', async () => {
    const { requireAdmin } = await import('@/lib/auth')
    const { fetchTraceList } = await import('@/lib/debug')
    requireAdmin.mockResolvedValue({ session: { role: 'admin' } })
    fetchTraceList.mockResolvedValue({ items: [], nextCursor: null })
    const { GET } = await import('@/src/app/api/admin/trace/route')
    await GET(new Request('http://x/api/admin/trace?date=20260419&status=error&route=v1/analyze&limit=10&cursor=5'))
    expect(fetchTraceList).toHaveBeenCalledWith(expect.objectContaining({
      date: '20260419',
      status: 'error',
      route: 'v1/analyze',
      limit: 10,
      cursor: '5',
    }))
  })
})

describe('GET /api/admin/trace/[requestId] (detail)', () => {
  beforeEach(async () => {
    const { requireAdmin } = await import('@/lib/auth')
    const { fetchTraceDetail } = await import('@/lib/debug')
    requireAdmin.mockReset()
    fetchTraceDetail.mockReset()
  })

  it('401 when not authenticated', async () => {
    const { requireAdmin } = await import('@/lib/auth')
    requireAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    const { GET } = await import('@/src/app/api/admin/trace/[requestId]/route')
    const res = await GET(new Request('http://x/api/admin/trace/r1'), { params: { requestId: 'r1' } })
    expect(res.status).toBe(401)
  })

  it('404 when trace not found', async () => {
    const { requireAdmin } = await import('@/lib/auth')
    const { fetchTraceDetail } = await import('@/lib/debug')
    requireAdmin.mockResolvedValue({ session: { role: 'admin' } })
    fetchTraceDetail.mockResolvedValue(null)
    const { GET } = await import('@/src/app/api/admin/trace/[requestId]/route')
    const res = await GET(new Request('http://x/api/admin/trace/nope'), { params: { requestId: 'nope' } })
    expect(res.status).toBe(404)
  })

  it('200 returns detail for known requestId', async () => {
    const { requireAdmin } = await import('@/lib/auth')
    const { fetchTraceDetail } = await import('@/lib/debug')
    requireAdmin.mockResolvedValue({ session: { role: 'admin' } })
    fetchTraceDetail.mockResolvedValue({
      meta: { requestId: 'r1' },
      events: [{ seq: 1, tag: 'x' }],
    })
    const { GET } = await import('@/src/app/api/admin/trace/[requestId]/route')
    const res = await GET(new Request('http://x/api/admin/trace/r1'), { params: { requestId: 'r1' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.meta.requestId).toBe('r1')
    expect(body.data.events).toHaveLength(1)
  })

  it('400 when requestId param missing', async () => {
    const { requireAdmin } = await import('@/lib/auth')
    requireAdmin.mockResolvedValue({ session: { role: 'admin' } })
    const { GET } = await import('@/src/app/api/admin/trace/[requestId]/route')
    const res = await GET(new Request('http://x/api/admin/trace/'), { params: {} })
    expect(res.status).toBe(400)
  })
})

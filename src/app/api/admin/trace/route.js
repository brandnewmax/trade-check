export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/lib/auth'
import { fetchTraceList } from '@/lib/debug'

export async function GET(req) {
  const gate = await requireAdmin()
  if (gate.error) {
    return Response.json({ ok: false, error: gate.error }, { status: gate.status })
  }

  const url = new URL(req.url)
  const date = url.searchParams.get('date') || undefined
  const status = url.searchParams.get('status') || undefined
  const route = url.searchParams.get('route') || undefined
  const limit = parseInt(url.searchParams.get('limit') || '50', 10)
  const cursor = url.searchParams.get('cursor') || '0'

  const data = await fetchTraceList({ date, status, route, limit, cursor })
  return Response.json({ ok: true, data })
}

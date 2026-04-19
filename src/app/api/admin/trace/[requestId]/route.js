export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/lib/auth'
import { fetchTraceDetail } from '@/lib/debug'

export async function GET(req, { params }) {
  const gate = await requireAdmin()
  if (gate.error) {
    return Response.json({ ok: false, error: gate.error }, { status: gate.status })
  }

  const { requestId } = params
  if (!requestId) {
    return Response.json({ ok: false, error: 'requestId required' }, { status: 400 })
  }

  const url = new URL(req.url)
  const date = url.searchParams.get('date') || undefined

  const data = await fetchTraceDetail(requestId, date)
  if (!data) {
    return Response.json({ ok: false, error: 'trace not found' }, { status: 404 })
  }
  return Response.json({ ok: true, data })
}

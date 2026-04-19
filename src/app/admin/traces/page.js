'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

function todayUtc() {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function statusColor(status) {
  if (status === 'success') return 'bg-stripe-success/15 text-stripe-successText border-stripe-success/40'
  if (status === 'error')   return 'bg-stripe-ruby/15 text-stripe-ruby border-stripe-ruby/40'
  if (status === 'running') return 'bg-stripe-lemon/15 text-stripe-lemon border-stripe-lemon/40'
  return 'bg-stripe-border text-stripe-body border-stripe-border'
}

function riskColor(risk) {
  if (risk === 'high')   return 'text-stripe-ruby'
  if (risk === 'medium') return 'text-stripe-lemon'
  if (risk === 'low')    return 'text-stripe-successText'
  return 'text-stripe-body'
}

function formatTime(ms) {
  if (!ms) return '-'
  const d = new Date(Number(ms))
  return d.toISOString().replace('T', ' ').slice(11, 19) + ' UTC'
}

export default function TracesListPage() {
  const [date, setDate] = useState(todayUtc())
  const [status, setStatus] = useState('all')
  const [route, setRoute] = useState('all')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState('0')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchPage = useCallback(async (reset) => {
    setLoading(true)
    setError('')
    try {
      const yyyymmdd = date.replace(/-/g, '')
      const params = new URLSearchParams({ date: yyyymmdd, limit: '50' })
      if (status !== 'all') params.set('status', status)
      if (route !== 'all')  params.set('route', route)
      if (!reset && cursor) params.set('cursor', cursor)
      const r = await fetch(`/api/admin/trace?${params}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const body = await r.json()
      if (!body.ok) throw new Error(body.error || 'unknown error')
      setItems(reset ? body.data.items : [...items, ...body.data.items])
      setCursor(body.data.nextCursor || '')
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [date, status, route, cursor, items])

  useEffect(() => {
    setCursor('0')
    fetchPage(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, status, route])

  const filtered = search
    ? items.filter(i => i.requestId.toLowerCase().includes(search.toLowerCase()))
    : items

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-heading font-light text-stripe-navy mb-6">Trace List</h1>

      <div className="sticky top-0 bg-white z-10 flex flex-wrap items-center gap-3 py-3 border-b border-stripe-border mb-4">
        <label className="flex items-center gap-2">
          <span className="text-caption text-stripe-body">日期</span>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="h-9 px-2 border border-stripe-border rounded-stripe-sm text-caption"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-caption text-stripe-body">状态</span>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="h-9 px-2 border border-stripe-border rounded-stripe-sm text-caption bg-white"
          >
            <option value="all">全部</option>
            <option value="success">成功</option>
            <option value="error">失败</option>
            <option value="running">进行中</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-caption text-stripe-body">Route</span>
          <select
            value={route}
            onChange={e => setRoute(e.target.value)}
            className="h-9 px-2 border border-stripe-border rounded-stripe-sm text-caption bg-white"
          >
            <option value="all">全部</option>
            <option value="v1/analyze">v1/analyze</option>
            <option value="analyze">analyze</option>
            <option value="v1/profile">v1/profile</option>
          </select>
        </label>
        <input
          type="text"
          placeholder="requestId 前缀搜索"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 px-3 border border-stripe-border rounded-stripe-sm text-caption w-64"
        />
        <button
          type="button"
          onClick={() => { setCursor('0'); fetchPage(true) }}
          className="h-9 px-3 bg-stripe-purple text-white rounded-stripe-sm text-caption hover:bg-stripe-purpleHover"
        >
          刷新
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-stripe-ruby/10 text-stripe-ruby border border-stripe-ruby/30 rounded-stripe text-caption">
          {error}
        </div>
      )}

      <div className="overflow-x-auto border border-stripe-border rounded-stripe">
        <table className="w-full text-caption">
          <thead className="bg-stripe-border/30 border-b border-stripe-border">
            <tr className="text-left">
              <th className="px-3 py-2 font-normal">开始时间</th>
              <th className="px-3 py-2 font-normal">requestId</th>
              <th className="px-3 py-2 font-normal">route</th>
              <th className="px-3 py-2 font-normal">status</th>
              <th className="px-3 py-2 font-normal">时长 ms</th>
              <th className="px-3 py-2 font-normal">riskLevel</th>
              <th className="px-3 py-2 font-normal">caller</th>
              <th className="px-3 py-2 font-normal">询盘预览</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-stripe-body">该日期无 trace</td></tr>
            )}
            {filtered.map(it => (
              <tr key={it.requestId} className="border-b border-stripe-border hover:bg-stripe-purpleLight/10 cursor-pointer">
                <td className="px-3 py-2 font-mono">{formatTime(it.startMs)}</td>
                <td className="px-3 py-2 font-mono">
                  <Link href={`/admin/traces/${it.requestId}?date=${date.replace(/-/g, '')}`} className="text-stripe-purple hover:underline">
                    {String(it.requestId).slice(0, 8)}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono">{it.route}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded-stripe-sm border text-caption-sm ${statusColor(it.status)}`}>
                    {it.status}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono">{it.durationMs ?? '-'}</td>
                <td className={`px-3 py-2 font-normal ${riskColor(it.riskLevel)}`}>{it.riskLevel || '-'}</td>
                <td className="px-3 py-2 text-stripe-body truncate max-w-[160px]">{it.caller || '-'}</td>
                <td className="px-3 py-2 text-stripe-body truncate max-w-[280px]">{it.inquiryPreview || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-center">
        {cursor && (
          <button
            type="button"
            disabled={loading}
            onClick={() => fetchPage(false)}
            className="h-9 px-4 border border-stripe-border rounded-stripe-sm text-caption hover:bg-stripe-purpleLight/10"
          >
            {loading ? '加载中…' : '加载更多'}
          </button>
        )}
      </div>
    </div>
  )
}

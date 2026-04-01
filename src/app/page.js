'use client'
import React, { useState, useEffect, useRef } from 'react'

// ─── DESIGN TOKENS (Ant Design inspired) ─────────────────────────────────────
const T = {
  // Colors
  primary:      '#1677ff',
  primaryHover: '#4096ff',
  primaryBg:    'rgba(22,119,255,0.08)',
  primaryBorder:'rgba(22,119,255,0.35)',
  success:      '#52c41a',
  successBg:    'rgba(82,196,26,0.1)',
  warning:      '#faad14',
  warningBg:    'rgba(250,173,20,0.1)',
  error:        '#ff4d4f',
  errorBg:      'rgba(255,77,79,0.1)',
  // Text
  textPrimary:  'rgba(255,255,255,0.88)',
  textSecondary:'rgba(255,255,255,0.55)',
  textTertiary: 'rgba(255,255,255,0.3)',
  textDisabled: 'rgba(255,255,255,0.18)',
  // Surface
  bgContainer:  'rgba(255,255,255,0.04)',
  bgElevated:   'rgba(255,255,255,0.06)',
  bgLayout:     '#0d1117',
  bgSider:      '#161b22',
  // Border
  border:       'rgba(255,255,255,0.1)',
  borderSecond: 'rgba(255,255,255,0.06)',
  // Radius
  radiusSm: 6,
  radiusMd: 8,
  radiusLg: 12,
  // Shadow
  shadow: '0 1px 2px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)',
}

// ─── SPINNER ──────────────────────────────────────────────────────────────────
function Spinner({ size = 16, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke={color || 'currentColor'} strokeWidth="2.5" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0110 10" stroke={color || 'currentColor'} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

// ─── MARKDOWN RENDERER ────────────────────────────────────────────────────────
function MarkdownRenderer({ content }) {
  if (!content || typeof content !== 'string') return null
  const lines = content.split('\n')
  const elements = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ color: T.textPrimary, fontSize: 13.5, fontWeight: 600, margin: '18px 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 3, height: 14, background: T.primary, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />{renderInline(line.slice(4))}</h3>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ color: T.textPrimary, fontSize: 15, fontWeight: 600, margin: '24px 0 10px', paddingBottom: 8, borderBottom: `1px solid ${T.borderSecond}` }}>{renderInline(line.slice(3))}</h2>)
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: '0 0 14px' }}>{renderInline(line.slice(2))}</h1>)
    } else if (line.trim() === '---') {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: `1px solid ${T.borderSecond}`, margin: '16px 0' }} />)
    } else if (line.match(/^[\*\-] /)) {
      const items = []
      while (i < lines.length && lines[i].match(/^[\*\-] /)) {
        items.push(<li key={i} style={{ marginBottom: 4, lineHeight: 1.7, color: T.textSecondary }}>{renderInline(lines[i].slice(2))}</li>)
        i++
      }
      elements.push(<ul key={`ul-${i}`} style={{ paddingLeft: 16, margin: '4px 0 10px' }}>{items}</ul>)
      continue
    } else if (line.match(/^\d+\. /)) {
      const items = []
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(<li key={i} style={{ marginBottom: 4, lineHeight: 1.7, color: T.textSecondary }}>{renderInline(lines[i].replace(/^\d+\. /, ''))}</li>)
        i++
      }
      elements.push(<ol key={`ol-${i}`} style={{ paddingLeft: 18, margin: '4px 0 10px' }}>{items}</ol>)
      continue
    } else if (line.startsWith('> ')) {
      elements.push(<blockquote key={i} style={{ borderLeft: `3px solid ${T.primaryBorder}`, margin: '8px 0', paddingLeft: 12, color: T.textSecondary, fontStyle: 'italic', fontSize: 13 }}>{renderInline(line.slice(2))}</blockquote>)
    } else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: 4 }} />)
    } else {
      elements.push(<p key={i} style={{ margin: '2px 0 6px', lineHeight: 1.75, color: T.textSecondary, fontSize: 13.5 }}>{renderInline(line)}</p>)
    }
    i++
  }
  return <div>{elements}</div>
}

function renderInline(text) {
  if (typeof text !== 'string') return text
  const parts = []
  let remaining = text
  let key = 0
  while (remaining.length > 0) {
    const bi = remaining.match(/^\*\*\*(.*?)\*\*\*/)
    if (bi) { parts.push(<strong key={key++} style={{ fontWeight: 600, fontStyle: 'italic', color: T.textPrimary }}>{bi[1]}</strong>); remaining = remaining.slice(bi[0].length); continue }
    const b = remaining.match(/^\*\*(.*?)\*\*/)
    if (b) { parts.push(<strong key={key++} style={{ fontWeight: 600, color: T.textPrimary }}>{b[1]}</strong>); remaining = remaining.slice(b[0].length); continue }
    const it = remaining.match(/^\*(.*?)\*/)
    if (it) { parts.push(<em key={key++} style={{ fontStyle: 'italic' }}>{it[1]}</em>); remaining = remaining.slice(it[0].length); continue }
    const co = remaining.match(/^`(.*?)`/)
    if (co) { parts.push(<code key={key++} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace', fontSize: '0.88em', color: '#79c0ff' }}>{co[1]}</code>); remaining = remaining.slice(co[0].length); continue }
    const next = remaining.search(/[\*`]/)
    if (next === -1) { parts.push(<span key={key++}>{remaining}</span>); break }
    parts.push(<span key={key++}>{remaining.slice(0, next)}</span>)
    remaining = remaining.slice(next)
  }
  return parts
}

// ─── SAFE MARKDOWN (error boundary) ──────────────────────────────────────────
class SafeMarkdown extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) return <div style={{ color: T.textTertiary, fontSize: 13 }}>内容加载失败</div>
    const { text } = this.props
    if (!text || typeof text !== 'string') return <span style={{ color: T.textTertiary, fontSize: 13 }}>无内容</span>
    return <MarkdownRenderer content={text} />
  }
}

// ─── SCORE HELPERS ────────────────────────────────────────────────────────────
function extractScore(t) {
  if (!t || typeof t !== 'string') return null
  const m100 = t.match(/(\d{1,3})\s*\/\s*100/)
  if (m100) { const n = parseInt(m100[1]); if (n >= 0 && n <= 100) return n }
  const mFen = t.match(/(\d{2,3})\s*分/)
  if (mFen) { const n = parseInt(mFen[1]); if (n >= 0 && n <= 100) return n }
  return null
}

function ScoreBadge({ score, size = 'md' }) {
  const cfg = score === null
    ? { bg: 'rgba(255,255,255,0.06)', color: T.textTertiary, border: T.border, label: '—' }
    : score >= 80
    ? { bg: T.successBg, color: T.success, border: 'rgba(82,196,26,0.3)', label: score }
    : score >= 60
    ? { bg: T.warningBg, color: T.warning, border: 'rgba(250,173,20,0.3)', label: score }
    : { bg: T.errorBg, color: T.error, border: 'rgba(255,77,79,0.3)', label: score }

  const pad = size === 'lg' ? '4px 14px' : '2px 10px'
  const fs = size === 'lg' ? 14 : 12
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: pad, borderRadius: 100, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontSize: fs, fontWeight: 700, letterSpacing: '0.01em', flexShrink: 0 }}>
      {cfg.label}
      {score !== null && <span style={{ fontSize: fs - 3, fontWeight: 400, opacity: 0.65 }}>/100</span>}
    </span>
  )
}

// ─── FORM COMPONENTS ──────────────────────────────────────────────────────────
function FormItem({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ color: T.textSecondary, fontSize: 13, fontWeight: 500 }}>{label}</label>
        {hint && <span style={{ color: T.textTertiary, fontSize: 11.5 }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: T.bgContainer,
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusMd,
  padding: '8px 12px',
  color: T.textPrimary,
  fontSize: 13.5,
  lineHeight: 1.6,
  outline: 'none',
  transition: 'border-color 0.2s',
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) { setError('请填写邮箱和密码'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '登录失败'); return }
      onLogin(data)
    } catch { setError('网络错误，请重试') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bgLayout, position: 'relative', overflow: 'hidden', fontFamily: "'PingFang SC','Microsoft YaHei',system-ui,sans-serif" }}>
      {/* subtle grid bg */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${T.borderSecond} 1px,transparent 1px),linear-gradient(90deg,${T.borderSecond} 1px,transparent 1px)`, backgroundSize: '48px 48px' }} />
      <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(22,119,255,0.08) 0%,transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', width: 400, background: T.bgSider, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, padding: '40px 36px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: T.radiusMd, background: T.primary, marginBottom: 16 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div style={{ color: T.textPrimary, fontSize: 20, fontWeight: 600 }}>外贸背景调查</div>
          <div style={{ color: T.textTertiary, fontSize: 12, marginTop: 4 }}>Trade Background Intelligence</div>
        </div>

        <FormItem label="邮箱">
          <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="your@email.com" style={inputStyle} />
        </FormItem>
        <FormItem label="密码">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="••••••••" style={inputStyle} />
        </FormItem>

        {error && (
          <div style={{ background: T.errorBg, border: `1px solid rgba(255,77,79,0.25)`, borderRadius: T.radiusMd, padding: '8px 12px', marginBottom: 16, color: '#ff7875', fontSize: 13 }}>
            {error}
          </div>
        )}

        <button onClick={handleLogin} disabled={loading} style={{ width: '100%', padding: '9px', border: 'none', borderRadius: T.radiusMd, cursor: loading ? 'wait' : 'pointer', background: loading ? 'rgba(22,119,255,0.5)' : T.primary, color: '#fff', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
          {loading ? <><Spinner color="#fff" />登录中...</> : '登录'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 20, color: T.textDisabled, fontSize: 11 }}>© 2025 mmldigi.com</div>
      </div>
    </div>
  )
}

// ─── QUERY PAGE ───────────────────────────────────────────────────────────────
function QueryPage({ user }) {
  const [url, setUrl] = useState('')
  const [inquiry, setInquiry] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const resultRef = useRef(null)

  const analyze = async () => {
    if (!url.trim() && !inquiry.trim()) { setError('请至少填写公司网址或询盘信息'); return }
    setLoading(true); setError(''); setResult(''); setStreaming(true)
    try {
      const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, inquiry }) })
      if (!res.ok) {
        const text = await res.text()
        let msg = `服务器错误 ${res.status}`
        try { msg = JSON.parse(text).error || msg } catch {}
        throw new Error(msg)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          try {
            const msg = JSON.parse(raw)
            if (msg.error) throw new Error(msg.error)
            if (msg.delta) {
              setResult(prev => prev + msg.delta)
              if (resultRef.current) resultRef.current.scrollTop = resultRef.current.scrollHeight
            }
          } catch (e) { if (e.message !== 'Unexpected end of JSON input') throw e }
        }
      }
    } catch (e) { setError(e.message); setResult('') }
    finally { setLoading(false); setStreaming(false) }
  }

  const score = extractScore(result)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page header */}
      <div>
        <h1 style={{ color: T.textPrimary, fontSize: 22, fontWeight: 600, margin: 0 }}>外贸背景调查</h1>
        <p style={{ color: T.textTertiary, fontSize: 13, marginTop: 4 }}>输入目标公司信息与询盘内容，AI 将进行专业背调分析</p>
      </div>

      {/* Input card */}
      <div style={{ background: T.bgSider, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, padding: '24px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
          <FormItem label="公司网址（或公司详细信息）">
            <textarea value={url} onChange={e => setUrl(e.target.value)}
              placeholder={'https://example.com\n\n或粘贴公司名称、地址、联系方式...'}
              style={{ ...inputStyle, resize: 'none', minHeight: 96, fontFamily: "'DM Mono',monospace", fontSize: 13 }} />
          </FormItem>
          <FormItem label="询盘详细信息">
            <textarea value={inquiry} onChange={e => setInquiry(e.target.value)}
              placeholder="粘贴询盘邮件内容、买家联系方式等..."
              style={{ ...inputStyle, resize: 'none', minHeight: 96, fontSize: 13 }} />
          </FormItem>
        </div>

        {error && (
          <div style={{ background: T.errorBg, border: `1px solid rgba(255,77,79,0.25)`, borderRadius: T.radiusMd, padding: '9px 14px', marginBottom: 14 }}>
            <span style={{ color: '#ff7875', fontSize: 13, fontWeight: 500 }}>⚠ </span>
            <span style={{ color: '#ffb8b8', fontSize: 13 }}>{error}</span>
          </div>
        )}

        <button onClick={analyze} disabled={loading} style={{ width: '100%', padding: '9px', border: 'none', borderRadius: T.radiusMd, cursor: loading ? 'wait' : 'pointer', background: loading ? 'rgba(22,119,255,0.5)' : T.primary, color: '#fff', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {loading
            ? <><Spinner color="#fff" />AI 分析中...</>
            : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>开始背调分析</>
          }
        </button>
      </div>

      {/* Result card */}
      {(result || streaming) && (
        <div style={{ background: T.bgSider, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, overflow: 'hidden' }}>
          {/* Result header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: `1px solid ${T.borderSecond}`, background: 'rgba(255,255,255,0.02)' }}>
            <span style={{ color: T.textSecondary, fontSize: 13, fontWeight: 500 }}>分析结果</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {streaming && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.primary, fontSize: 12 }}><Spinner color={T.primary} size={13} />生成中</div>}
              {result && !streaming && <ScoreBadge score={score} size="md" />}
            </div>
          </div>
          {/* Result body */}
          <div ref={resultRef} style={{ padding: '20px 28px', maxHeight: 600, overflowY: 'auto' }}>
            <MarkdownRenderer content={result} />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !streaming && !loading && (
        <div style={{ background: T.bgSider, border: `1px dashed ${T.borderSecond}`, borderRadius: T.radiusLg, padding: '40px 24px', textAlign: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ color: T.textDisabled, margin: '0 auto 10px', display: 'block' }}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <div style={{ color: T.textTertiary, fontSize: 13 }}>填写上方信息后点击开始分析</div>
        </div>
      )}
    </div>
  )
}

// ─── HISTORY PAGE ─────────────────────────────────────────────────────────────
function HistoryPage({ user }) {
  const [queries, setQueries] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/queries').then(r => r.json()).then(d => { setQueries(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  const clientHint = (q) => {
    if (!q.inquiry) return null
    const lines = q.inquiry.split('\n')
    for (const line of lines) {
      if (line.includes('@') && line.includes('.')) {
        const parts = line.trim().split(/\s+/)
        for (const p of parts) { if (p.includes('@')) return p.replace(/[,;]+$/, '') }
      }
    }
    for (const line of lines) {
      if (line.includes('www.') || /[a-z0-9-]+\.(com|net|org|io|co)/i.test(line)) {
        const m = line.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.(?:com|net|org|io|co)[a-z.]*)/i)
        if (m) return m[0]
      }
    }
    return null
  }

  const visible = queries.filter(q => !search ||
    q.url?.toLowerCase().includes(search.toLowerCase()) ||
    q.inquiry?.toLowerCase().includes(search.toLowerCase()) ||
    q.userEmail?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ color: T.textPrimary, fontSize: 22, fontWeight: 600, margin: 0 }}>查询历史</h1>
          <p style={{ color: T.textTertiary, fontSize: 13, marginTop: 4 }}>共 {visible.length} 条记录</p>
        </div>
        <div style={{ position: 'relative' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textTertiary, pointerEvents: 'none' }}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索..."
            style={{ ...inputStyle, width: 220, paddingLeft: 32, fontSize: 13 }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: T.bgSider, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr 100px', gap: 0, borderBottom: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.02)', padding: '10px 20px' }}>
          {['评分', '公司网址', '客户信息', '时间'].map(h => (
            <div key={h} style={{ color: T.textTertiary, fontSize: 12, fontWeight: 500 }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={24} color={T.textTertiary} /></div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: T.textTertiary, fontSize: 13 }}>暂无查询记录</div>
        ) : (
          visible.map((q, i) => {
            const score = extractScore(q.result)
            const hint = clientHint(q)
            const isOpen = selected === i
            return (
              <div key={q.createdAt || i}>
                {/* Table row */}
                <div onClick={() => setSelected(isOpen ? null : i)}
                  style={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr 100px', gap: 0, padding: '13px 20px', cursor: 'pointer', borderBottom: `1px solid ${T.borderSecond}`, background: isOpen ? T.primaryBg : 'transparent', transition: 'background 0.15s' }}
                  onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                  onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <ScoreBadge score={score} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                    <span style={{ color: q.url ? '#79c0ff' : T.textTertiary, fontSize: 13, fontFamily: q.url ? "'DM Mono',monospace" : 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 16 }}>
                      {q.url || '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                    <span style={{ color: T.textSecondary, fontSize: 12.5, fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 16 }}>
                      {hint || <span style={{ color: T.textDisabled }}>—</span>}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                    <span style={{ color: T.textTertiary, fontSize: 11.5 }}>
                      {new Date(q.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {user.role === 'admin' && <span style={{ color: T.textDisabled, fontSize: 10.5 }}>{q.userEmail}</span>}
                  </div>
                </div>

                {/* Expanded row */}
                {isOpen && (
                  <div onClick={e => e.stopPropagation()} style={{ borderBottom: `1px solid ${T.borderSecond}`, background: 'rgba(22,119,255,0.04)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {q.url && (
                        <div>
                          <div style={{ color: T.textTertiary, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>公司网址 / 信息</div>
                          <div style={{ color: '#79c0ff', fontSize: 12.5, fontFamily: 'monospace', background: T.bgContainer, borderRadius: T.radiusMd, padding: '8px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{q.url}</div>
                        </div>
                      )}
                      {q.inquiry && (
                        <div>
                          <div style={{ color: T.textTertiary, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>询盘信息</div>
                          <div style={{ color: T.textSecondary, fontSize: 12.5, background: T.bgContainer, borderRadius: T.radiusMd, padding: '8px 12px', maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{q.inquiry}</div>
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ color: T.textTertiary, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>分析结果</div>
                      <div style={{ background: T.bgContainer, borderRadius: T.radiusMd, padding: '16px 20px', maxHeight: 400, overflowY: 'auto' }}>
                        <SafeMarkdown text={q.result} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
function SettingsPage({ user }) {
  const [form, setForm] = useState({ baseUrl: '', systemPrompt: '', apiKey: '', modelName: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => { setForm(f => ({ ...f, ...d })); setLoading(false) })
  }, [])

  const save = async () => {
    setSaving(true)
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={28} color={T.textTertiary} /></div>

  const isAdmin = user.role === 'admin'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ color: T.textPrimary, fontSize: 22, fontWeight: 600, margin: 0 }}>设置</h1>
        <p style={{ color: T.textTertiary, fontSize: 13, marginTop: 4 }}>
          {isAdmin ? '配置全局 API 地址、系统 Prompt 及您自己的 API Key' : '配置您的 API Key 和模型名称'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '360px 1fr' : '360px', gap: 20 }}>
        {/* My API config */}
        <div style={{ background: T.bgSider, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, padding: '24px 28px' }}>
          <div style={{ color: T.textSecondary, fontSize: 13, fontWeight: 600, marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${T.borderSecond}` }}>我的 API 配置</div>

          <FormItem label="API Key" hint="仅对您本人生效">
            <div style={{ position: 'relative' }}>
              <input type={showKey ? 'text' : 'password'} value={form.apiKey || ''} onChange={e => setForm({ ...form, apiKey: e.target.value })}
                placeholder="sk-..." style={{ ...inputStyle, paddingRight: 40, fontFamily: "'DM Mono',monospace", fontSize: 12.5 }} />
              <button onClick={() => setShowKey(!showKey)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: T.textTertiary, cursor: 'pointer', padding: 3, display: 'flex' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  {showKey
                    ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></>
                    : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" /></>
                  }
                </svg>
              </button>
            </div>
          </FormItem>

          <FormItem label="Model Name">
            <input value={form.modelName || ''} onChange={e => setForm({ ...form, modelName: e.target.value })}
              placeholder="gpt-4o / gemini-2.0-flash" style={{ ...inputStyle, fontFamily: "'DM Mono',monospace", fontSize: 12.5 }} />
          </FormItem>

          <div style={{ background: T.primaryBg, border: `1px solid ${T.primaryBorder}`, borderRadius: T.radiusMd, padding: '9px 12px' }}>
            <div style={{ color: '#79c0ff', fontSize: 12, lineHeight: 1.6 }}>支持所有 OpenAI 兼容接口（Gemini、DeepSeek 等）</div>
          </div>
        </div>

        {/* Admin global config */}
        {isAdmin && (
          <div style={{ background: T.bgSider, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${T.borderSecond}` }}>
              <span style={{ color: T.textSecondary, fontSize: 13, fontWeight: 600 }}>全局配置</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 4, background: 'rgba(250,173,20,0.12)', color: '#faad14', border: '1px solid rgba(250,173,20,0.25)' }}>Admin</span>
            </div>

            <FormItem label="Base URL">
              <input value={form.baseUrl || ''} onChange={e => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="https://ai.example.com/v1" style={{ ...inputStyle, fontFamily: "'DM Mono',monospace", fontSize: 12.5 }} />
            </FormItem>

            <FormItem label="System Prompt" hint="对用户隐藏">
              <textarea value={form.systemPrompt || ''} onChange={e => setForm({ ...form, systemPrompt: e.target.value })}
                rows={14} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7, fontSize: 13 }} />
            </FormItem>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={save} disabled={saving} style={{ padding: '8px 24px', border: 'none', borderRadius: T.radiusMd, cursor: saving ? 'wait' : 'pointer', background: saving ? 'rgba(22,119,255,0.5)' : T.primary, color: '#fff', fontSize: 13.5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 7 }}>
          {saving ? <><Spinner color="#fff" />保存中...</> : '保存设置'}
        </button>
        {saved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.success, fontSize: 13 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            已保存
          </div>
        )}
      </div>
    </div>
  )
}

// ─── LAYOUT ───────────────────────────────────────────────────────────────────
function Layout({ user, onLogout, page, setPage, children }) {
  const nav = [
    { id: 'query', label: '背调查询', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    { id: 'history', label: '查询历史', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    { id: 'settings', label: '设置', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  ]
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bgLayout, fontFamily: "'PingFang SC','Microsoft YaHei',system-ui,sans-serif" }}>
      {/* Sider */}
      <aside style={{ width: 220, flexShrink: 0, background: T.bgSider, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', padding: '20px 12px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 20px', borderBottom: `1px solid ${T.borderSecond}`, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: T.radiusMd, background: T.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <div style={{ color: T.textPrimary, fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>外贸背调</div>
            <div style={{ color: T.textDisabled, fontSize: 10.5 }}>mmldigi.com</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingTop: 4 }}>
          {nav.map(item => {
            const active = page === item.id
            return (
              <button key={item.id} onClick={() => setPage(item.id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 12px', borderRadius: T.radiusMd, marginBottom: 2,
                background: active ? T.primaryBg : 'transparent',
                border: `1px solid ${active ? T.primaryBorder : 'transparent'}`,
                color: active ? T.primary : T.textSecondary,
                fontSize: 13.5, fontWeight: active ? 500 : 400,
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}>
                {item.icon}
                {item.label}
                {active && <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: T.primary }} />}
              </button>
            )
          })}
        </nav>

        {/* User */}
        <div style={{ borderTop: `1px solid ${T.borderSecond}`, paddingTop: 12, marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 8px', marginBottom: 8, borderRadius: T.radiusMd, background: T.bgContainer }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.primaryBg, border: `1px solid ${T.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.primary, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
              {user.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: T.textPrimary, fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
              <div style={{ fontSize: 10.5, color: user.role === 'admin' ? T.warning : T.textTertiary }}>{user.role === 'admin' ? '管理员' : '用户'}</div>
            </div>
          </div>
          <button onClick={onLogout} style={{ width: '100%', padding: '7px 12px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: T.radiusMd, color: T.textTertiary, fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.15s' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            退出登录
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', maxWidth: 1100 }}>{children}</main>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [page, setPage] = useState('query')

  useEffect(() => {
    fetch('/api/me').then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.email) setUser(d) })
      .finally(() => setChecking(false))
  }, [])

  const logout = async () => { await fetch('/api/auth', { method: 'DELETE' }); setUser(null); setPage('query') }

  if (checking) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bgLayout }}><Spinner size={32} color={T.textTertiary} /></div>
  if (!user) return <LoginPage onLogin={setUser} />

  const content = page === 'history' ? <HistoryPage user={user} />
    : page === 'settings' ? <SettingsPage user={user} />
    : <QueryPage user={user} />

  return <Layout user={user} onLogout={logout} page={page} setPage={setPage}>{content}</Layout>
}

'use client'
import { useState, useEffect, useRef } from 'react'

function Spinner({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// ─── MARKDOWN RENDERER ────────────────────────────────────────────────────────
function MarkdownRenderer({ content }) {
  if (!content) return null

  const lines = content.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // H3
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700, margin: '20px 0 8px', letterSpacing: '-0.2px' }}>{renderInline(line.slice(4))}</h3>)
    }
    // H2
    else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ color: '#f1f5f9', fontSize: 15.5, fontWeight: 700, margin: '24px 0 10px', letterSpacing: '-0.3px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>{renderInline(line.slice(3))}</h2>)
    }
    // H1
    else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ color: '#f8fafc', fontSize: 17, fontWeight: 700, margin: '0 0 14px', letterSpacing: '-0.4px' }}>{renderInline(line.slice(2))}</h1>)
    }
    // HR
    else if (line.trim() === '---') {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '18px 0' }} />)
    }
    // Bullet list
    else if (line.match(/^[\*\-] /)) {
      const items = []
      while (i < lines.length && lines[i].match(/^[\*\-] /)) {
        items.push(<li key={i} style={{ marginBottom: 5, lineHeight: 1.75 }}>{renderInline(lines[i].slice(2))}</li>)
        i++
      }
      elements.push(<ul key={`ul-${i}`} style={{ paddingLeft: 18, margin: '6px 0 10px', color: 'rgba(255,255,255,0.8)' }}>{items}</ul>)
      continue
    }
    // Numbered list
    else if (line.match(/^\d+\. /)) {
      const items = []
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(<li key={i} style={{ marginBottom: 5, lineHeight: 1.75 }}>{renderInline(lines[i].replace(/^\d+\. /, ''))}</li>)
        i++
      }
      elements.push(<ol key={`ol-${i}`} style={{ paddingLeft: 20, margin: '6px 0 10px', color: 'rgba(255,255,255,0.8)' }}>{items}</ol>)
      continue
    }
    // Blockquote
    else if (line.startsWith('> ')) {
      elements.push(<blockquote key={i} style={{ borderLeft: '3px solid rgba(96,165,250,0.5)', margin: '10px 0', paddingLeft: 12, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', fontSize: 13 }}>{renderInline(line.slice(2))}</blockquote>)
    }
    // Empty line
    else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: 6 }} />)
    }
    // Normal paragraph
    else {
      elements.push(<p key={i} style={{ margin: '2px 0 8px', lineHeight: 1.8, color: 'rgba(255,255,255,0.82)' }}>{renderInline(line)}</p>)
    }
    i++
  }

  return <div style={{ fontSize: 13.5 }}>{elements}</div>
}

function renderInline(text) {
  // Parse bold, italic, code, colored text inline
  const parts = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold+italic ***text***
    const boldItalic = remaining.match(/^\*\*\*(.*?)\*\*\*/)
    if (boldItalic) {
      parts.push(<strong key={key++} style={{ fontWeight: 700, fontStyle: 'italic', color: '#f1f5f9' }}>{boldItalic[1]}</strong>)
      remaining = remaining.slice(boldItalic[0].length)
      continue
    }
    // Bold **text**
    const bold = remaining.match(/^\*\*(.*?)\*\*/)
    if (bold) {
      parts.push(<strong key={key++} style={{ fontWeight: 700, color: '#e2e8f0' }}>{bold[1]}</strong>)
      remaining = remaining.slice(bold[0].length)
      continue
    }
    // Italic *text*
    const italic = remaining.match(/^\*(.*?)\*/)
    if (italic) {
      parts.push(<em key={key++} style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.7)' }}>{italic[1]}</em>)
      remaining = remaining.slice(italic[0].length)
      continue
    }
    // Inline code `text`
    const code = remaining.match(/^`(.*?)`/)
    if (code) {
      parts.push(<code key={key++} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace', fontSize: '0.9em', color: '#93c5fd' }}>{code[1]}</code>)
      remaining = remaining.slice(code[0].length)
      continue
    }
    // Next special char
    const next = remaining.search(/[\*`]/)
    if (next === -1) {
      parts.push(<span key={key++}>{remaining}</span>)
      break
    }
    parts.push(<span key={key++}>{remaining.slice(0, next)}</span>)
    remaining = remaining.slice(next)
  }

  return parts.length === 1 && typeof parts[0]?.props?.children === 'string' ? parts[0].props.children : parts
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) { setError('请填写邮箱和密码'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '登录失败'); return }
      onLogin(data)
    } catch { setError('网络错误，请重试') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />
      <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle,rgba(26,86,219,0.12) 0%,transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', width: 420, background: 'rgba(13,20,38,0.92)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '48px 44px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 54, height: 54, borderRadius: 16, background: 'linear-gradient(135deg,#1a56db,#0ea5e9)', marginBottom: 18 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div style={{ color: '#fff', fontSize: 21, fontWeight: 700, letterSpacing: '-0.4px' }}>外贸背景调查</div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12.5, marginTop: 5 }}>Trade Background Intelligence</div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>邮箱</label>
          <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="your@email.com"
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 16px', color: '#fff', fontSize: 15 }} />
        </div>
        <div style={{ marginBottom: 26 }}>
          <label style={{ display: 'block', color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>密码</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="••••••••"
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 16px', color: '#fff', fontSize: 15 }} />
        </div>
        {error && <div style={{ background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.28)', borderRadius: 8, padding: '10px 14px', marginBottom: 18, color: '#fc8181', fontSize: 13 }}>{error}</div>}
        <button onClick={handleLogin} disabled={loading}
          style={{ width: '100%', padding: 14, border: 'none', borderRadius: 10, cursor: loading ? 'wait' : 'pointer', background: loading ? 'rgba(26,86,219,0.45)' : 'linear-gradient(135deg,#1a56db,#0ea5e9)', color: '#fff', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {loading ? <><Spinner />验证中...</> : '登录'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 22, color: 'rgba(255,255,255,0.18)', fontSize: 11 }}>© 2025 mmldigi.com · 外贸背景调查系统</div>
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

  const riskColor = { high: '#fc8181', medium: '#f6ad55', low: '#68d391', unknown: '#718096' }
  const riskLabel = { high: '高风险', medium: '中风险', low: '低风险', unknown: '未知' }
  const extractRisk = t => /高风险/.test(t) ? 'high' : /中风险/.test(t) ? 'medium' : /低风险/.test(t) ? 'low' : 'unknown'

  // Extract numeric score — prioritise X/100 format, ignore X/5 ratings
  const extractScore = (t) => {
    // First: look for explicit X / 100 pattern (most reliable)
    const m100 = t.match(/(\d{1,3})\s*\/\s*100/)
    if (m100) {
      const n = parseInt(m100[1])
      if (n >= 0 && n <= 100) return n
    }
    // Second: look for "XX分" where XX is 2+ digits (avoid single digit like 5分)
    const mFen = t.match(/(\d{2,3})\s*分/)
    if (mFen) {
      const n = parseInt(mFen[1])
      if (n >= 0 && n <= 100) return n
    }
    return null
  }

  const scoreColor = (s) => {
    if (s === null) return { bg: 'rgba(113,128,150,0.15)', color: '#718096', border: 'rgba(113,128,150,0.3)' }
    if (s >= 80) return { bg: 'rgba(104,211,145,0.12)', color: '#68d391', border: 'rgba(104,211,145,0.3)' }
    if (s >= 60) return { bg: 'rgba(246,173,85,0.12)', color: '#f6ad55', border: 'rgba(246,173,85,0.3)' }
    return { bg: 'rgba(252,129,129,0.12)', color: '#fc8181', border: 'rgba(252,129,129,0.3)' }
  }

  const scoreLabel = (s) => {
    if (s === null) return null
    if (s >= 80) return `${s}分 · 低风险`
    if (s >= 60) return `${s}分 · 中风险`
    return `${s}分 · 高风险`
  }

  const analyze = async () => {
    if (!url.trim() && !inquiry.trim()) { setError('请至少填写公司网址或询盘信息'); return }
    setLoading(true); setError(''); setResult('')

    setStreaming(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, inquiry }),
      })

      // Pre-stream errors (4xx before body starts)
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
              setResult(prev => {
                const next = prev + msg.delta
                return next
              })
              if (resultRef.current) resultRef.current.scrollTop = resultRef.current.scrollHeight
            }
          } catch (e) { if (e.message !== 'Unexpected end of JSON input') throw e }
        }
      }

    } catch (e) {
      setError(e.message)
      setResult('')
    } finally {
      setLoading(false)
      setStreaming(false)
    }
  }

  const panel = { background: 'rgba(255,255,255,0.028)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 26 }
  const sLabel = { color: 'rgba(255,255,255,0.4)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.11em', textTransform: 'uppercase', marginBottom: 20 }
  const inputBase = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '11px 14px', color: '#fff', fontSize: 14, lineHeight: 1.6 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: 25, fontWeight: 700, letterSpacing: '-0.5px' }}>外贸背景调查</h1>
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13.5, marginTop: 5 }}>输入公司信息与询盘内容，AI 将为您进行专业背调分析</p>
        </div>
      </div>

      {/* Input area — compact horizontal layout */}
      <div style={{ ...panel, padding: '20px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* URL */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'rgba(255,255,255,0.6)', fontSize: 12.5, fontWeight: 500, marginBottom: 7 }}>
              <span style={{ width: 17, height: 17, borderRadius: 4, background: 'rgba(26,86,219,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, color: '#60a5fa', fontWeight: 700 }}>1</span>
              公司网址（或公司详细信息）
            </label>
            <textarea value={url} onChange={e => setUrl(e.target.value)}
              placeholder={"https://example.com\n\n或粘贴公司名称、地址、联系方式等信息..."}
              style={{ ...inputBase, padding: '9px 12px', fontSize: 13, flex: 1, resize: 'none', minHeight: 100 }} />
          </div>
          {/* Inquiry */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'rgba(255,255,255,0.6)', fontSize: 12.5, fontWeight: 500, marginBottom: 7 }}>
              <span style={{ width: 17, height: 17, borderRadius: 4, background: 'rgba(26,86,219,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, color: '#60a5fa', fontWeight: 700 }}>2</span>
              询盘详细信息
            </label>
            <textarea value={inquiry} onChange={e => setInquiry(e.target.value)}
              placeholder="粘贴询盘邮件内容、买家信息等..."
              style={{ ...inputBase, padding: '9px 12px', fontSize: 13, flex: 1, resize: 'none', minHeight: 100 }} />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
            <div style={{ color: '#fc8181', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>⚠ 请求失败</div>
            <div style={{ color: '#fca5a5', fontSize: 12.5, lineHeight: 1.6 }}>{error}</div>
          </div>
        )}

        {/* Button */}
        <button onClick={analyze} disabled={loading}
          style={{ width: '100%', padding: '11px', border: 'none', borderRadius: 10, cursor: loading ? 'wait' : 'pointer', background: loading ? 'rgba(26,86,219,0.38)' : 'linear-gradient(135deg,#1a56db,#0ea5e9)', color: '#fff', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {loading ? <><Spinner />AI 分析中...</> : <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            开始背调分析
          </>}
        </button>
      </div>

      {/* Output area — full width, expands naturally */}
      {(result || streaming) && (
        <div style={panel}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={sLabel}>分析结果</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {streaming && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#60a5fa', fontSize: 12 }}><Spinner size={12} />生成中...</div>
              )}
              {result && !streaming && (() => {
                const score = extractScore(result)
                const col = scoreColor(score)
                return score !== null ? (
                  <span style={{ fontSize: 13, fontWeight: 800, padding: '4px 14px', borderRadius: 20, background: col.bg, color: col.color, border: `1px solid ${col.border}`, letterSpacing: '0.02em' }}>
                    {score} <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.7 }}>/ 100</span>
                  </span>
                ) : null
              })()}
            </div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: '20px 24px' }}>
            <MarkdownRenderer content={result} />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !streaming && !loading && (
        <div style={{ ...panel, padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ color: 'rgba(255,255,255,0.12)', fontSize: 13.5 }}>填写上方信息后点击开始分析</div>
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

  // Extract score from saved result text
  const extractScore = (t) => {
    if (!t) return null
    const m100 = t.match(/(\d{1,3})\s*\/\s*100/)
    if (m100) { const n = parseInt(m100[1]); if (n >= 0 && n <= 100) return n }
    const mFen = t.match(/(\d{2,3})\s*分/)
    if (mFen) { const n = parseInt(mFen[1]); if (n >= 0 && n <= 100) return n }
    return null
  }
  const scoreColor = (s) => {
    if (s === null) return { bg: 'rgba(113,128,150,0.15)', color: '#718096', border: 'rgba(113,128,150,0.3)' }
    if (s >= 80) return { bg: 'rgba(104,211,145,0.12)', color: '#68d391', border: 'rgba(104,211,145,0.3)' }
    if (s >= 60) return { bg: 'rgba(246,173,85,0.12)', color: '#f6ad55', border: 'rgba(246,173,85,0.3)' }
    return { bg: 'rgba(252,129,129,0.12)', color: '#fc8181', border: 'rgba(252,129,129,0.3)' }
  }

  // Extract a short client summary from inquiry text (first non-empty line up to 40 chars)
  const clientSummary = (q) => {
    if (q.url && q.url.trim()) return q.url.trim()
    if (!q.inquiry) return '—'
    const firstLine = q.inquiry.split('\n').map(l => l.trim()).find(l => l.length > 2)
    return firstLine ? firstLine.slice(0, 50) + (firstLine.length > 50 ? '...' : '') : '—'
  }

  // Extract a hint from inquiry (email, domain, or company name clue)
  const clientHint = (q) => {
    if (!q.inquiry) return null
    const emailMatch = q.inquiry.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i)
    if (emailMatch) return emailMatch[0]
    const urlMatch = q.inquiry.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.[a-z]{2,})/i)
    if (urlMatch) return urlMatch[0]
    return null
  }

  const visible = queries.filter(q => !search || q.url?.includes(search) || q.inquiry?.includes(search) || q.userEmail?.includes(search))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: 25, fontWeight: 700, letterSpacing: '-0.5px' }}>查询历史</h1>
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13.5, marginTop: 5 }}>共 {visible.length} 条记录</p>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索网址、邮箱、客户信息..."
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '9px 15px', color: '#fff', fontSize: 13, width: 240 }} />
      </div>
      {loading
        ? <div style={{ textAlign: 'center', padding: 60, display: 'flex', justifyContent: 'center' }}><Spinner size={28} /></div>
        : visible.length === 0
          ? <div style={{ textAlign: 'center', padding: 80, color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>暂无查询记录</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visible.map((q, i) => {
              const score = extractScore(q.result)
              const col = scoreColor(score)
              const hint = clientHint(q)
              return (
                <div key={i} onClick={() => setSelected(selected === i ? null : i)}
                  style={{ background: selected === i ? 'rgba(26,86,219,0.09)' : 'rgba(255,255,255,0.028)', border: `1px solid ${selected === i ? 'rgba(26,86,219,0.28)' : 'rgba(255,255,255,0.065)'}`, borderRadius: 12, padding: '14px 18px', cursor: 'pointer', transition: 'all 0.18s' }}>

                  {/* Row 1: score badge + url + date */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Score badge */}
                    <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 10px', borderRadius: 20, flexShrink: 0, background: col.bg, color: col.color, border: `1px solid ${col.border}`, minWidth: 44, textAlign: 'center' }}>
                      {score !== null ? score : '—'}
                    </span>

                    {/* URL / primary identifier */}
                    <span style={{ flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: q.url ? "'DM Mono', monospace" : 'inherit' }}>
                      {q.url || '（无网址）'}
                    </span>

                    {/* Date + admin email */}
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11.5, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {user.role === 'admin' && <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 11 }}>{q.userEmail}</span>}
                      {new Date(q.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Row 2: client hint from inquiry */}
                  {hint && (
                    <div style={{ marginTop: 5, paddingLeft: 54, color: 'rgba(255,255,255,0.38)', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {hint}
                    </div>
                  )}

                  {/* Expanded detail */}
                  {selected === i && (
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                      {q.url && (
                        <div>
                          <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>公司网址 / 信息</div>
                          <div style={{ color: '#60a5fa', fontSize: 12.5, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{q.url}</div>
                        </div>
                      )}
                      {q.inquiry && (
                        <div>
                          <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>询盘信息</div>
                          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12.5, lineHeight: 1.65, background: 'rgba(0,0,0,0.18)', borderRadius: 8, padding: '9px 12px', maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>{q.inquiry}</div>
                        </div>
                      )}
                      <div>
                        <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>分析结果</div>
                        <div style={{ background: 'rgba(0,0,0,0.18)', borderRadius: 8, padding: '14px 16px', maxHeight: 360, overflowY: 'auto' }}>
                          <MarkdownRenderer content={q.result} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
      }
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

  const panel = { background: 'rgba(255,255,255,0.028)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 28 }
  const lbl = { display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }
  const inp = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '11px 14px', color: '#fff', fontSize: 13, marginBottom: 22 }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={28} /></div>

  const isAdmin = user.role === 'admin'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div>
        <h1 style={{ color: '#fff', fontSize: 25, fontWeight: 700, letterSpacing: '-0.5px' }}>设置</h1>
        <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13.5, marginTop: 5 }}>
          {isAdmin ? '管理员可配置全局 API 地址、Prompt，以及自己的 API Key 和模型' : '配置您的 API Key 和模型名称'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1.5fr' : '1fr', gap: 18, maxWidth: isAdmin ? '100%' : 540 }}>

        {/* Left panel: user's own apiKey + modelName (everyone sees this) */}
        <div style={panel}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 24 }}>我的 API 配置</div>

          <label style={lbl}>API Key</label>
          <div style={{ position: 'relative', marginBottom: 22 }}>
            <input type={showKey ? 'text' : 'password'} value={form.apiKey || ''} onChange={e => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk-..." style={{ ...inp, marginBottom: 0, paddingRight: 44, fontFamily: "'DM Mono',monospace", fontSize: 12 }} />
            <button onClick={() => setShowKey(!showKey)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: 2 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                {showKey
                  ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>
                  : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /></>
                }
              </svg>
            </button>
          </div>

          <label style={lbl}>Model Name</label>
          <input value={form.modelName || ''} onChange={e => setForm({ ...form, modelName: e.target.value })}
            placeholder="gemini-2.0-flash" style={{ ...inp, fontFamily: "'DM Mono',monospace", fontSize: 12 }} />

          <div style={{ background: 'rgba(26,86,219,0.08)', border: '1px solid rgba(26,86,219,0.18)', borderRadius: 8, padding: '10px 13px' }}>
            <div style={{ color: '#93c5fd', fontSize: 12, lineHeight: 1.6 }}>
              API Key 仅对您本人生效，管理员无法查看。
            </div>
          </div>
        </div>

        {/* Right panel: admin-only global settings */}
        {isAdmin && (
          <div style={panel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>全局配置（仅管理员）</div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(234,179,8,0.15)', color: '#fbbf24', border: '1px solid rgba(234,179,8,0.25)' }}>Admin</span>
            </div>

            <label style={lbl}>Base URL</label>
            <input value={form.baseUrl || ''} onChange={e => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://ai.example.com/v1" style={{ ...inp, fontFamily: "'DM Mono',monospace", fontSize: 12 }} />

            <label style={lbl}>System Prompt（对用户隐藏）</label>
            <textarea value={form.systemPrompt || ''} onChange={e => setForm({ ...form, systemPrompt: e.target.value })}
              rows={14} style={{ ...inp, marginBottom: 0, lineHeight: 1.75, fontSize: 12.5 }} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={save} disabled={saving}
          style={{ padding: '11px 30px', border: 'none', borderRadius: 10, cursor: saving ? 'wait' : 'pointer', background: 'linear-gradient(135deg,#1a56db,#0ea5e9)', color: '#fff', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving ? <><Spinner />保存中...</> : '保存设置'}
        </button>
        {saved && <div style={{ color: '#68d391', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>已保存</div>}
      </div>
    </div>
  )
}

// ─── LAYOUT ───────────────────────────────────────────────────────────────────
function Layout({ user, onLogout, page, setPage, children }) {
  const nav = [
    { id: 'query', label: '背调查询', d: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
    { id: 'history', label: '查询历史', d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'settings', label: '设置', d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ]
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 215, flexShrink: 0, background: 'rgba(255,255,255,0.018)', borderRight: '1px solid rgba(255,255,255,0.055)', display: 'flex', flexDirection: 'column', padding: '26px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 34, paddingLeft: 6 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#1a56db,#0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 12.5, fontWeight: 700 }}>外贸背调</div>
            <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10 }}>mmldigi.com</div>
          </div>
        </div>
        <nav style={{ flex: 1 }}>
          {nav.map(item => (
            <button key={item.id} onClick={() => setPage(item.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 9, marginBottom: 3, background: page === item.id ? 'rgba(26,86,219,0.18)' : 'transparent', border: `1px solid ${page === item.id ? 'rgba(26,86,219,0.28)' : 'transparent'}`, color: page === item.id ? '#60a5fa' : 'rgba(255,255,255,0.45)', fontSize: 13.5, fontWeight: page === item.id ? 600 : 400, cursor: 'pointer', textAlign: 'left' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d={item.d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {item.label}
            </button>
          ))}
        </nav>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.055)', paddingTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 4px', marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(26,86,219,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>{user.name?.[0] || 'U'}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
              <div style={{ color: user.role === 'admin' ? '#fbbf24' : 'rgba(255,255,255,0.3)', fontSize: 10.5 }}>{user.role === 'admin' ? '管理员' : '用户'}</div>
            </div>
          </div>
          <button onClick={onLogout} style={{ width: '100%', padding: '7px 11px', background: 'transparent', border: '1px solid rgba(255,255,255,0.075)', borderRadius: 7, color: 'rgba(255,255,255,0.38)', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            退出登录
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, overflowY: 'auto', padding: '34px 38px' }}>{children}</main>
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

  if (checking) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={32} /></div>
  if (!user) return <LoginPage onLogin={setUser} />

  const content = page === 'history' ? <HistoryPage user={user} />
    : page === 'settings' ? <SettingsPage user={user} />
    : <QueryPage user={user} />

  return <Layout user={user} onLogout={logout} page={page} setPage={setPage}>{content}</Layout>
}

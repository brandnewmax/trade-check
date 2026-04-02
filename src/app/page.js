'use client'
import React, { useState, useEffect, useRef } from 'react'

// ─── DESIGN TOKENS (Claude light theme) ──────────────────────────────────────
const T = {
  // Accent — Claude's warm orange-brown
  primary:      '#b45309',
  primaryHover: '#92400e',
  primaryBg:    'rgba(180,83,9,0.08)',
  primaryBorder:'rgba(180,83,9,0.25)',
  success:      '#15803d',
  successBg:    'rgba(21,128,61,0.08)',
  warning:      '#b45309',
  warningBg:    'rgba(180,83,9,0.08)',
  error:        '#b91c1c',
  errorBg:      'rgba(185,28,28,0.06)',
  // Text — Claude's warm dark text on light background
  textPrimary:  '#1a1309',   // near-black warm
  textSecondary:'#5c4f3a',   // warm medium gray
  textTertiary: '#9c8a72',   // warm light gray
  textDisabled: '#c4b49e',
  // Surface — Claude's warm off-white / cream
  bgLayout:     '#f7f4ef',   // Claude's main background (warm cream)
  bgSider:      '#f0ece4',   // slightly darker cream for sidebar
  bgContainer:  'rgba(0,0,0,0.03)',
  bgElevated:   '#ffffff',   // card surfaces
  bgInput:      '#ffffff',
  // Border
  border:       'rgba(26,19,9,0.12)',
  borderSecond: 'rgba(26,19,9,0.07)',
  // Radius
  radiusSm: 6,
  radiusMd: 8,
  radiusLg: 12,
  // Shadow
  shadow: '0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(26,19,9,0.06)',
  shadowCard: '0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(26,19,9,0.06)',
  // Fonts — Instrument Sans (closest to Claude Sans) + system fallback
  fontUI:   "'Instrument Sans', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', system-ui, sans-serif",
  fontBody: "'Instrument Sans', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', system-ui, sans-serif",
  fontMono: "'SFMono-Regular', 'Consolas', 'Liberation Mono', monospace",
}

// ─── SPINNER ──────────────────────────────────────────────────────────────────
function Spinner({ size = 16, color }) {
  const c = color || T.textTertiary
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke={c} strokeWidth="2.5" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0110 10" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

// ─── MARKDOWN RENDERER ────────────────────────────────────────────────────────
// Subtle section accent colors — warm tones, low saturation
const MD_SECTION_COLORS = [
  { border: '#d97706', bg: 'rgba(217,119,6,0.06)',   dot: '#d97706' },  // amber
  { border: '#16a34a', bg: 'rgba(22,163,74,0.06)',   dot: '#16a34a' },  // green
  { border: '#7c3aed', bg: 'rgba(124,58,237,0.06)',  dot: '#7c3aed' },  // violet
  { border: '#0891b2', bg: 'rgba(8,145,178,0.06)',   dot: '#0891b2' },  // cyan
  { border: '#db2777', bg: 'rgba(219,39,119,0.06)',  dot: '#db2777' },  // pink
  { border: '#ea580c', bg: 'rgba(234,88,12,0.06)',   dot: '#ea580c' },  // orange
]

function MarkdownRenderer({ content }) {
  if (!content || typeof content !== 'string') return null
  try {
  const lines = content.split('\n')
  const elements = []
  let i = 0
  let h2Count = 0
  let safetyLoopCount = 0

  // Base text style — matches Claude's body text
  const base = { fontFamily: T.fontBody, fontSize: 15, lineHeight: 1.8, color: T.textPrimary }

  while (i < lines.length && safetyLoopCount++ < 5000) {
    const line = lines[i]

    // H1
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} style={{ ...base, color: T.textPrimary, fontSize: 17, fontWeight: 600, margin: '0 0 16px', lineHeight: 1.4 }}>
          {renderInline(line.slice(2))}
        </h1>
      )

    // H2 — section header with accent bar
    } else if (line.startsWith('## ')) {
      const col = MD_SECTION_COLORS[h2Count % MD_SECTION_COLORS.length]
      h2Count++
      elements.push(
        <div key={i} style={{ margin: '24px 0 10px', borderLeft: `3px solid ${col.border}`, paddingLeft: 12, background: col.bg, borderRadius: '0 6px 6px 0', padding: '8px 14px' }}>
          <h2 style={{ margin: 0, fontFamily: T.fontUI, color: T.textPrimary, fontSize: 14, fontWeight: 600 }}>
            {renderInline(line.slice(3))}
          </h2>
        </div>
      )

    // H3
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} style={{ ...base, color: T.textPrimary, fontSize: 14.5, fontWeight: 600, margin: '14px 0 5px' }}>
          {renderInline(line.slice(4))}
        </h3>
      )

    // HR
    } else if (line.trim() === '---') {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: `1px solid ${T.borderSecond}`, margin: '18px 0' }} />)

    // Bullet list
    } else if (/^[*-] /.test(line)) {
      const items = []
      while (i < lines.length && /^[*-] /.test(lines[i])) {
        items.push({ text: lines[i].slice(2), key: i })
        i++
      }
      elements.push(
        <div key={`ul-${i}`} style={{ margin: '6px 0 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {items.map(item => (
            <div key={item.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: T.primary, flexShrink: 0, fontSize: 12, marginTop: 4, opacity: 0.8 }}>•</span>
              <span style={{ ...base, flex: 1 }}>{renderInline(item.text)}</span>
            </div>
          ))}
        </div>
      )
      continue

    // Numbered list
    } else if (/^\d+\. /.test(line)) {
      const items = []
      let num = 1
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push({ num: num++, text: lines[i].replace(/^\d+\. /, ''), key: i })
        i++
      }
      elements.push(
        <div key={`ol-${i}`} style={{ margin: '6px 0 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map(item => (
            <div key={item.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: T.textTertiary, flexShrink: 0, fontSize: 13, fontWeight: 500, minWidth: 18, textAlign: 'right', marginTop: 2 }}>{item.num}.</span>
              <span style={{ ...base, flex: 1 }}>{renderInline(item.text)}</span>
            </div>
          ))}
        </div>
      )
      continue

    // Blockquote
    } else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} style={{ margin: '8px 0', padding: '8px 14px', background: T.bgContainer, borderLeft: `2px solid ${T.border}`, borderRadius: '0 6px 6px 0', color: T.textSecondary, fontSize: 14.5, fontStyle: 'italic', lineHeight: 1.7 }}>
          {renderInline(line.slice(2))}
        </blockquote>
      )

    // Empty line
    } else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: 4 }} />)

    // Paragraph
    } else {
      elements.push(
        <p key={i} style={{ ...base, margin: '2px 0 6px' }}>
          {renderInline(line)}
        </p>
      )
    }
    i++
  }

  return <div style={{ userSelect: 'text' }}>{elements}</div>
  } catch (err) { return <div style={{ color: T.textTertiary, fontSize: 13, padding: '8px 0' }}>内容渲染失败</div> }
}

function renderInline(text) {
  if (typeof text !== 'string') return String(text ?? '')
  try {
    const parts = []
    let remaining = text
    let key = 0
    let safety = 0
    while (remaining.length > 0 && safety++ < 2000) {
      const bi = remaining.match(/^\*\*\*(.*?)\*\*\*/)
      if (bi) { parts.push(<strong key={key++} style={{ fontWeight: 600, fontStyle: 'italic', color: T.textPrimary }}>{bi[1]}</strong>); remaining = remaining.slice(bi[0].length); continue }
      const b = remaining.match(/^\*\*(.*?)\*\*/)
      if (b) { parts.push(<strong key={key++} style={{ fontWeight: 600, color: T.textPrimary }}>{b[1]}</strong>); remaining = remaining.slice(b[0].length); continue }
      const it = remaining.match(/^\*(.*?)\*/)
      if (it) { parts.push(<em key={key++} style={{ fontStyle: 'italic', color: T.textSecondary }}>{it[1]}</em>); remaining = remaining.slice(it[0].length); continue }
      const co = remaining.match(/^`(.*?)`/)
      if (co) { parts.push(<code key={key++} style={{ background: 'rgba(0,0,0,0.05)', border: `1px solid ${T.border}`, borderRadius: 4, padding: '1px 6px', fontFamily: T.fontMono, fontSize: '0.88em', color: T.textPrimary }}>{co[1]}</code>); remaining = remaining.slice(co[0].length); continue }
      const next = remaining.search(/[\*`]/)
      if (next <= 0) { parts.push(<span key={key++}>{remaining}</span>); break }
      parts.push(<span key={key++}>{remaining.slice(0, next)}</span>)
      remaining = remaining.slice(next)
    }
    return parts
  } catch { return text }
}

// ─── SAFE MARKDOWN (error boundary) ──────────────────────────────────────────
class SafeMarkdown extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidUpdate(prevProps) {
    if (prevProps.text !== this.props.text && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: T.textTertiary, fontSize: 13, padding: '12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          此记录内容格式异常，无法显示
        </div>
      )
    }
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
  background: T.bgInput,
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusMd,
  padding: '8px 12px',
  color: T.textPrimary,
  fontSize: 15,
  lineHeight: 1.6,
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bgLayout, position: 'relative', overflow: 'hidden', fontFamily: T.fontUI }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${T.borderSecond} 1px,transparent 1px),linear-gradient(90deg,${T.borderSecond} 1px,transparent 1px)`, backgroundSize: '48px 48px' }} />

      <div style={{ position: 'relative', width: 400, background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, padding: '40px 36px', boxShadow: T.shadowCard }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: T.radiusMd, background: T.primary, marginBottom: 16 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div style={{ color: T.textPrimary, fontSize: 20, fontWeight: 600, letterSpacing: '-0.3px' }}>外贸背景调查</div>
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

        <button onClick={handleLogin} disabled={loading} style={{ width: '100%', padding: '10px', border: 'none', borderRadius: T.radiusMd, cursor: loading ? 'wait' : 'pointer', background: loading ? 'rgba(180,83,9,0.5)' : T.primary, color: '#fff', fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, letterSpacing: '0.01em' }}>
          {loading ? <><Spinner color="#fff" />登录中...</> : '登录'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 20, color: T.textTertiary, fontSize: 12 }}>© 2025 mmldigi.com</div>
      </div>
    </div>
  )
}

// ─── QUERY PAGE ───────────────────────────────────────────────────────────────
function QueryPage({ user }) {
  const [url, setUrl] = useState('')
  const [inquiry, setInquiry] = useState('')
  const [images, setImages] = useState([])       // [{name, base64, preview}]
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const resultRef = useRef(null)
  const fileInputRef = useRef(null)

  const processFiles = (files) => {
    setFieldErrors(p => ({...p, inquiry: null}))
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const valid = Array.from(files).filter(f => allowed.includes(f.type)).slice(0, 4)
    valid.forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target.result.split(',')[1]
        const preview = e.target.result
        setImages(prev => {
          if (prev.length >= 4) return prev
          if (prev.find(img => img.name === file.name && img.base64 === base64)) return prev
          return [...prev, { name: file.name, base64, preview, type: file.type }]
        })
      }
      reader.readAsDataURL(file)
    })
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    processFiles(e.dataTransfer.files)
  }

  const removeImage = (idx) => setImages(prev => prev.filter((_, i) => i !== idx))

  const abortCtrlRef = useRef(null)

  const stopAnalyze = () => {
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort()
      abortCtrlRef.current = null
    }
  }

  const analyze = async () => {
    // Per-field validation
    const errs = {}
    if (!url.trim()) errs.url = '请填写您的公司网址或公司信息'
    if (!inquiry.trim() && images.length === 0) errs.inquiry = '请填写询盘信息或上传名片图片'
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    setFieldErrors({})
    setLoading(true); setError(''); setResult(''); setStreaming(true)

    const abortCtrl = new AbortController()
    abortCtrlRef.current = abortCtrl
    // Safety timeout: abort if no real content received for 60s
    let lastContentAt = Date.now()
    const watchdog = setInterval(() => {
      if (Date.now() - lastContentAt > 60000) {
        abortCtrl.abort()
        clearInterval(watchdog)
      }
    }, 5000)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, inquiry, images: images.map(img => ({ base64: img.base64, type: img.type })) }),
        signal: abortCtrl.signal,
      })
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
        // lastContentAt is reset below only when actual delta arrives
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '') continue // heartbeat comment line
          try {
            const msg = JSON.parse(raw)
            if (msg.error) throw new Error(msg.error)
            if (msg.delta) {
              lastContentAt = Date.now() // reset watchdog on real content
              setResult(prev => prev + msg.delta)
              if (resultRef.current) resultRef.current.scrollTop = resultRef.current.scrollHeight
            }
          } catch (e) { if (e.message !== 'Unexpected end of JSON input') throw e }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        setError('连接超时：60秒内未收到 AI 响应，请重试。如持续出现，可能是模型响应过慢或 API 配置问题。')
      } else {
        setError(e.message)
      }
      setResult('')
    } finally {
      clearInterval(watchdog)
      abortCtrlRef.current = null
      setLoading(false)
      setStreaming(false)
    }
  }

  const score = extractScore(result)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'hidden' }}>
      {/* Input card */}
      <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, padding: '24px 28px', boxShadow: T.shadowCard }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: T.textSecondary, fontSize: 13, fontWeight: 500, marginBottom: 6 }}>您的公司网址（或公司详细信息）</div>
            <textarea value={url} onChange={e => { setUrl(e.target.value); if (e.target.value.trim()) setFieldErrors(p => ({...p, url: null})) }}
              placeholder={'https://example.com\n\n或提供企业的详细信息，包括但不限于企业定位，企业优势，核心目标客户等'}
              style={{ ...inputStyle, resize: 'none', flex: 1, fontFamily: "'DM Mono',monospace", fontSize: 13, borderColor: fieldErrors.url ? T.error : undefined }} />
            {fieldErrors.url && <div style={{ color: T.error, fontSize: 12, marginTop: 4 }}>⚠ {fieldErrors.url}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: T.textSecondary, fontSize: 13, fontWeight: 500, marginBottom: 6 }}>收到的询盘详细信息（或客户名片）</div>
            {/* Unified drop zone wrapping textarea + image strip */}
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false) }}
              onPaste={e => {
                const items = Array.from(e.clipboardData?.items || [])
                const imageItems = items.filter(item => item.type.startsWith('image/'))
                if (imageItems.length > 0) {
                  e.preventDefault()
                  processFiles(imageItems.map(item => item.getAsFile()).filter(Boolean))
                }
              }}
              style={{
                border: `1.5px solid ${dragOver ? T.primary : T.border}`,
                borderRadius: T.radiusMd,
                background: dragOver ? T.primaryBg : T.bgInput,
                transition: 'border-color 0.15s, background 0.15s',
                overflow: 'hidden',
              }}
            >
              <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={e => { processFiles(e.target.files); e.target.value = '' }} />

              {/* Textarea — no own border, lives inside the drop zone */}
              <textarea value={inquiry} onChange={e => { setInquiry(e.target.value); if (e.target.value.trim()) setFieldErrors(p => ({...p, inquiry: null})) }}
                placeholder="粘贴询盘邮件内容、买家联系方式等...（可直接粘贴截图）"
                onPaste={e => {
                  const items = Array.from(e.clipboardData?.items || [])
                  const imageItems = items.filter(item => item.type.startsWith('image/'))
                  if (imageItems.length > 0) {
                    e.preventDefault()
                    processFiles(imageItems.map(item => item.getAsFile()).filter(Boolean))
                  }
                }}
                style={{ ...inputStyle, border: 'none', borderRadius: 0, background: 'transparent',
                  resize: 'none', height: 110, fontSize: 13, boxShadow: 'none',
                  borderBottom: images.length > 0 ? `1px solid ${T.borderSecond}` : 'none' }} />

              {/* Image strip — shown when images uploaded */}
              {images.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 12px', alignItems: 'center' }}>
                  {images.map((img, idx) => (
                    <div key={idx} style={{ position: 'relative', flexShrink: 0 }}>
                      <img src={img.preview} alt={img.name}
                        style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, display: 'block' }} />
                      <button onClick={e => { e.stopPropagation(); removeImage(idx) }}
                        style={{ position: 'absolute', top: -5, right: -5, width: 17, height: 17, borderRadius: '50%', background: T.error, border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                        ×
                      </button>
                    </div>
                  ))}
                  {images.length < 4 && (
                    <div onClick={() => fileInputRef.current?.click()}
                      style={{ width: 60, height: 60, border: `1.5px dashed ${T.border}`, borderRadius: T.radiusSm, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textTertiary, fontSize: 20, cursor: 'pointer' }}>+</div>
                  )}
                </div>
              )}

              {/* Bottom hint bar */}
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px 8px',
                  color: dragOver ? T.primary : fieldErrors.inquiry ? T.error : T.textDisabled, fontSize: 12, cursor: 'pointer',
                  borderTop: `1px solid ${fieldErrors.inquiry ? T.error : T.borderSecond}`, transition: 'color 0.15s' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                  <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <span>{dragOver ? '松开即可上传' : '拖拽到此区域或点击上传名片/图片（最多4张，JPG、PNG）'}</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: T.errorBg, border: `1px solid rgba(255,77,79,0.25)`, borderRadius: T.radiusMd, padding: '9px 14px', marginBottom: 14 }}>
            <span style={{ color: '#ff7875', fontSize: 13, fontWeight: 500 }}>⚠ </span>
            <span style={{ color: '#ffb8b8', fontSize: 13 }}>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={loading ? undefined : analyze} disabled={loading} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: T.radiusMd, cursor: loading ? 'default' : 'pointer', background: loading ? 'rgba(180,83,9,0.35)' : T.primary, color: '#fff', fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, letterSpacing: '0.01em' }}>
            {loading
              ? <><Spinner color="#fff" />AI 分析中...</>
              : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>开始背调分析</>
            }
          </button>
          {loading && (
            <button onClick={stopAnalyze} style={{ padding: '10px 20px', border: `1px solid ${T.border}`, borderRadius: T.radiusMd, cursor: 'pointer', background: T.bgElevated, color: T.textSecondary, fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, transition: 'all 0.15s' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor"/></svg>
              停止
            </button>
          )}
        </div>
      </div>

      {/* Result card */}
      {(result || streaming) && (
        <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, overflow: 'hidden', boxShadow: T.shadowCard, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Result header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: `1px solid ${T.border}`, background: T.bgContainer }}>
            <span style={{ color: T.textSecondary, fontSize: 13, fontWeight: 500 }}>分析结果</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {streaming && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.primary, fontSize: 12 }}><Spinner color={T.primary} size={13} />生成中</div>}
              {result && !streaming && <ScoreBadge score={score} size="md" />}
            </div>
          </div>
          {/* Result body */}
          <div ref={resultRef} style={{ padding: '20px 28px', flex: 1, overflowY: 'auto' }}>
            <MarkdownRenderer content={result} />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !streaming && !loading && (
        <div style={{ background: T.bgElevated, border: `1px dashed ${T.border}`, borderRadius: T.radiusLg, padding: '40px 24px', textAlign: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ color: T.textDisabled, margin: '0 auto 10px', display: 'block' }}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <div style={{ color: T.textTertiary, fontSize: 13 }}>填写上方信息后点击开始分析</div>
        </div>
      )}
    </div>
  )
}

// ─── HISTORY PAGE ─────────────────────────────────────────────────────────────
// Check if a record is valid/expandable
function isValidRecord(q) {
  if (!q || typeof q !== 'object') return false
  // Must have at least a createdAt timestamp
  if (!q.createdAt) return false
  // result must be a non-empty string if present
  if (q.result !== undefined && (typeof q.result !== 'string' || q.result.trim() === '')) return false
  return true
}

function HistoryPage({ user }) {
  const [queries, setQueries] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [expandError, setExpandError] = useState({})

  useEffect(() => {
    fetch('/api/queries').then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        // Auto-filter out invalid/broken records on load
        const valid = d.filter(isValidRecord)
        setQueries(valid)
      }
      setLoading(false)
    })
  }, [])

  // Safe expand: catch any error and mark that record as broken
  const handleExpand = (i, q) => {
    if (expandError[i]) return // already known broken, don't expand
    if (!isValidRecord(q)) {
      // Mark as broken silently
      setExpandError(prev => ({ ...prev, [i]: true }))
      return
    }
    setSelected(selected === i ? null : i)
  }

  // Returns { email, company } — both optional
  const clientInfo = (q) => {
    let email = null, company = null

    // From inquiry text
    if (q.inquiry && typeof q.inquiry === 'string') {
      const lines = q.inquiry.split('\n')
      for (const line of lines) {
        if (!email && line.includes('@') && line.includes('.')) {
          const parts = line.trim().split(/\s+/)
          for (const p of parts) {
            if (p.includes('@')) { email = p.replace(/[,;]+$/, ''); break }
          }
        }
        if (!company && (line.includes('www.') || /[a-z0-9-]+\.(com|net|org|io|co)/i.test(line))) {
          const m = line.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.(?:com|net|org|io|co)[a-z.]*)/i)
          if (m) company = m[0]
        }
      }
    }

    // From result text (image-only records or extra info)
    if (q.result && typeof q.result === 'string') {
      const r = q.result
      if (!company) {
        // Match "客户公司：PROSTYLE" / "公司名称：Beauty Nancy" / "Company: X"
        const cm = r.match(/(?:客户公司|公司名称|客户单位|Company(?:\s+Name)?)[：:\s]+([^\n，,。《》（(【\]]{2,40})/)
        if (cm) company = cm[1].trim().replace(/[)）】\s]+$/, '')
      }
      if (!email && !company) {
        // Person name fallback
        const nm = r.match(/(?:客户名称|联系人|姓名|Customer|Contact)[：:\s]+([^\n，,。（(]{2,30})/)
        if (nm) company = nm[1].trim()
      }
    }

    return { email, company }
  }

  // Keep clientHint for backward compat (used in visible row)
  const clientHint = (q) => {
    const { email, company } = clientInfo(q)
    return email || company || null
  }

  const visible = queries.filter(q => !search ||
    q.url?.toLowerCase().includes(search.toLowerCase()) ||
    q.inquiry?.toLowerCase().includes(search.toLowerCase()) ||
    q.userEmail?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ color: T.textTertiary, fontSize: 13 }}>共 {visible.length} 条记录</p>
        </div>
        <div style={{ position: 'relative' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textTertiary, pointerEvents: 'none' }}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索..."
            style={{ ...inputStyle, width: 220, paddingLeft: 32, fontSize: 13 }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, overflow: 'hidden', boxShadow: T.shadowCard }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr 100px', gap: 0, borderBottom: `1px solid ${T.border}`, background: T.bgContainer, padding: '10px 20px' }}>
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
            const isOpen = selected === i
            return (
              <div key={q.createdAt || i}>
                {/* Table row */}
                <div onClick={() => handleExpand(i, q)}
                  style={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr 100px', gap: 0, padding: '13px 20px', cursor: expandError[i] ? 'default' : 'pointer', borderBottom: `1px solid ${T.borderSecond}`, background: isOpen ? T.primaryBg : 'transparent', transition: 'background 0.15s', opacity: expandError[i] ? 0.4 : 1 }}
                  onMouseEnter={e => { if (!isOpen && !expandError[i]) e.currentTarget.style.background = 'rgba(0,0,0,0.02)' }}
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
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, gap: 2 }}>
                    {(() => {
                      const { email, company } = clientInfo(q)
                      return <>
                        {company && <span style={{ color: T.textSecondary, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 16 }}>{company}</span>}
                        {email && <span style={{ color: T.textTertiary, fontSize: 11.5, fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 16 }}>{email}</span>}
                        {!company && !email && <span style={{ color: T.textDisabled }}>—</span>}
                      </>
                    })()}
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
                  <div onClick={e => e.stopPropagation()} style={{ borderBottom: `1px solid ${T.border}`, background: T.bgContainer, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%', overflowY: 'auto' }}>
      <div>
        <p style={{ color: T.textTertiary, fontSize: 13 }}>
          {isAdmin ? '配置全局 API 地址、系统 Prompt 及您自己的 API Key' : '配置您的 API Key 和模型名称'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '360px 1fr' : '360px', gap: 20 }}>
        {/* My API config */}
        <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, padding: '24px 28px', boxShadow: T.shadowCard }}>
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
            <select value={form.modelName || ''} onChange={e => setForm({ ...form, modelName: e.target.value })}              style={{ ...inputStyle, fontFamily: "'DM Mono',monospace", fontSize: 12.5, cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M6 9l6 6 6-6' stroke='%239c8a72' strokeWidth='2' strokeLinecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32 }}>
              <option value="" disabled>选择模型...</option>
              <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
              <option value="gemini-3.1-pro-preview-vertex">gemini-3.1-pro-preview-vertex</option>
              <option value="gemini-3-pro-preview-thinking">gemini-3-pro-preview-thinking</option>
              <option value="gpt-5.4">gpt-5.4</option>
            </select>
          </FormItem>

          <div style={{ background: T.primaryBg, border: `1px solid ${T.primaryBorder}`, borderRadius: T.radiusMd, padding: '9px 12px' }}>
            <div style={{ color: '#79c0ff', fontSize: 12, lineHeight: 1.6 }}>支持所有 OpenAI 兼容接口（Gemini、DeepSeek 等）</div>
          </div>
        </div>

        {/* Admin global config */}
        {isAdmin && (
          <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, padding: '24px 28px', boxShadow: T.shadowCard }}>
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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: T.bgLayout, fontFamily: T.fontUI }}>
      {/* Sider */}
      <aside style={{ width: 220, flexShrink: 0, background: T.bgSider, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', padding: '20px 12px', boxShadow: 'inset -1px 0 0 rgba(26,19,9,0.07)', height: '100vh', overflowY: 'auto', overflowX: 'hidden' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 16px', borderBottom: `1px solid ${T.borderSecond}`, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: T.radiusMd, background: T.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <div style={{ color: T.textPrimary, fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>外贸背调</div>
            <div style={{ color: T.textDisabled, fontSize: 10.5 }}>mmldigi.com</div>
          </div>
        </div>

        {/* Page title — shown below logo */}
        {page === 'query' && (
          <div style={{ padding: '12px 8px 16px', borderBottom: `1px solid ${T.borderSecond}`, marginBottom: 8 }}>
            <div style={{ color: T.textPrimary, fontSize: 14, fontWeight: 600, marginBottom: 3 }}>外贸背景调查</div>
            <div style={{ color: T.textTertiary, fontSize: 11.5, lineHeight: 1.5 }}>输入目标公司信息与询盘内容，AI 将进行专业背调分析</div>
          </div>
        )}
        {page === 'history' && (
          <div style={{ padding: '12px 8px 16px', borderBottom: `1px solid ${T.borderSecond}`, marginBottom: 8 }}>
            <div style={{ color: T.textPrimary, fontSize: 14, fontWeight: 600 }}>查询历史</div>
          </div>
        )}
        {page === 'settings' && (
          <div style={{ padding: '12px 8px 16px', borderBottom: `1px solid ${T.borderSecond}`, marginBottom: 8 }}>
            <div style={{ color: T.textPrimary, fontSize: 14, fontWeight: 600 }}>设置</div>
          </div>
        )}

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
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.primaryBg, border: `1px solid ${T.primaryBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.primary, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
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

      {/* Main + optional right panel */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <main style={{ flex: 1, overflow: 'hidden', padding: '24px 32px', display: 'flex', flexDirection: 'column' }}>{children}</main>

        {/* Right feature panel — query page only */}
        {page === 'query' && (
          <aside style={{ width: 210, flexShrink: 0, borderLeft: `1px solid ${T.border}`, background: T.bgSider, overflowY: 'auto', padding: '24px 16px' }}>
            <div style={{ color: T.textTertiary, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>分析维度</div>
            {[
              { num: '01', color: T.primary, title: '客户身份穿透', desc: '还原询盘背后的真实企业，识别决策人层级与采购实力' },
              { num: '02', color: T.primary, title: '询盘质量评分', desc: '量化评估线索价值，拦截垃圾询盘，锁定高净值买家' },
              { num: '03', color: '#15803d', title: '供需匹配分析', desc: '比对客户需求与您的业务优势，判断是否"门当户对"' },
              { num: '04', color: '#1d4ed8', title: '破冰策略建议', desc: '针对不同评分等级，给出定制化的首次沟通切入点' },
              { num: '05', color: '#1d4ed8', title: '回复邮件草稿', desc: '生成符合老外采购逻辑的高转化初次回复，缩短响应时间' },
            ].map(({ num, color, title, desc }, idx, arr) => (
              <div key={num}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{num}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: T.textPrimary, fontSize: 12.5, fontWeight: 600, marginBottom: 3 }}>{title}</div>
                    <div style={{ color: T.textTertiary, fontSize: 11.5, lineHeight: 1.55 }}>{desc}</div>
                  </div>
                </div>
                {idx < arr.length - 1 && (
                  <div style={{ marginLeft: 12, width: 1, height: 14, background: T.borderSecond, marginBottom: 6 }} />
                )}
              </div>
            ))}
          </aside>
        )}
      </div>
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

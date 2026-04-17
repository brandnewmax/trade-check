'use client'
import React, { useState, useEffect, useRef } from 'react'

const INQUIRY_CHANNELS = [
  '官网 · SEO 自然流量询盘',
  '官网 · Google 搜索广告询盘',
  '官网 · Facebook / Instagram / 内容类广告',
  '直接邮件联系',
  '外贸开发信回复',
  'LinkedIn / 社交平台主动建联',
  '第三方转介绍 / 老客户回头',
  '展会现场名片 / 展后跟进询盘',
  '阿里巴巴 / Made-in-China — 产品页询盘',
  '阿里巴巴 / Made-in-China — RFQ 报价广场',
]

// ─── DESIGN TOKENS (Claude light theme) ──────────────────────────────────────

function SearchIcon({ className = '', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ClockIcon({ className = '', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7V12L15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function GearIcon({ className = '', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 005.2 15a1.65 1.65 0 00-1.51-1H3.6a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9.5a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9.5a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LogoutIcon({ className = '', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EyeIcon({ open = true, size = 18 }) {
  return open ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 8 11 8a18.45 18.45 0 01-2.16 3.19M1 1l22 22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function Logo({ variant = 'dark', size = 24 }) {
  const stroke = variant === 'light' ? '#ffffff' : '#533afd'
  const text = variant === 'light' ? 'text-white' : 'text-stripe-navy'
  return (
    <div className="flex items-center gap-2 select-none">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="13" stroke={stroke} strokeWidth="2.5" />
        <path d="M11 16L15 20L22 12" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`text-link font-normal tracking-tight ${text}`}>trade-check</span>
    </div>
  )
}

function NavItem({ icon, label, active, onClick, adminBadge }) {
  return (
    <button
      onClick={onClick}
      className={`w-full h-9 px-3 rounded-stripe-sm flex items-center gap-3 text-link font-normal transition-colors ${
        active
          ? 'bg-stripe-purpleLight/30 text-stripe-purple'
          : 'text-stripe-label hover:bg-stripe-purpleLight/20 hover:text-stripe-navy'
      }`}
    >
      <span className={active ? 'text-stripe-purple' : 'text-stripe-body'}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {adminBadge && (
        <span className="text-[10px] bg-stripe-brandDark text-white px-1.5 py-0.5 rounded">ADMIN</span>
      )}
    </button>
  )
}

function EmptyState({ icon, title, description }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-16">
      <div className="w-12 h-12 rounded-full bg-stripe-purpleLight/30 text-stripe-purple flex items-center justify-center mb-4">
        {icon}
      </div>
      <h4 className="text-subheading font-light text-stripe-navy mb-2">{title}</h4>
      <p className="text-body font-light text-stripe-body max-w-xs">{description}</p>
    </div>
  )
}

function AiDisclaimer() {
  return (
    <div className="mt-8 pt-4 border-t border-stripe-border/70 flex items-start gap-2 text-caption-sm text-stripe-body/80 leading-relaxed">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5 text-stripe-lemon">
        <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span>
        AI 分析可能包含错误或遗漏。重要决策前请点击左侧情报卡中的原始链接交叉核实,不要完全依赖单次分析结果。
      </span>
    </div>
  )
}

function ImageDropzone({ images, setImages, maxImages = 4 }) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  async function processFiles(files) {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'))
    const remaining = maxImages - images.length
    const toAdd = arr.slice(0, Math.max(0, remaining))
    const results = await Promise.all(
      toAdd.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = () => {
              const dataUrl = reader.result
              const base64 = typeof dataUrl === 'string' ? dataUrl.split(',')[1] || '' : ''
              resolve({ name: file.name, type: file.type, base64, preview: dataUrl })
            }
            reader.readAsDataURL(file)
          })
      )
    )
    setImages((prev) => [...prev, ...results])
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer?.files) processFiles(e.dataTransfer.files)
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    const files = []
    for (const it of items) {
      if (it.type && it.type.startsWith('image/')) {
        const f = it.getAsFile()
        if (f) files.push(f)
      }
    }
    if (files.length) processFiles(files)
  }

  function removeAt(i) {
    setImages((prev) => prev.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onPaste={handlePaste}
        onClick={() => inputRef.current?.click()}
        className={`w-full px-4 py-6 border border-dashed rounded-stripe-sm text-center transition-colors cursor-pointer ${
          dragOver
            ? 'border-stripe-purple bg-stripe-purpleLight/20'
            : 'border-stripe-border hover:border-stripe-purpleLight bg-white'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />
        <div className="text-caption-sm text-stripe-body">
          拖拽、粘贴或点击上传图片 · 最多 {maxImages} 张
        </div>
      </div>

      {images.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div
              key={i}
              className="relative w-16 h-16 rounded-stripe-sm overflow-hidden border border-stripe-border bg-white"
            >
              <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeAt(i)
                }}
                className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center bg-stripe-ruby text-white text-[11px] rounded-bl-stripe-sm"
                aria-label="删除"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ─── SPINNER ──────────────────────────────────────────────────────────────────
function Spinner({ size = 16, color = '#533afd' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke={color} strokeOpacity="0.2" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 01-10 10"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
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

  while (i < lines.length && safetyLoopCount++ < 5000) {
    const line = lines[i]

    // H1
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="text-heading font-light text-stripe-navy mt-8 first:mt-0 mb-4">
          {renderInline(line.slice(2))}
        </h1>
      )

    // H2 — section header with accent bar
    } else if (line.startsWith('## ')) {
      const col = MD_SECTION_COLORS[h2Count % MD_SECTION_COLORS.length]
      h2Count++
      elements.push(
        <h2 key={i} className="text-subheading font-light text-stripe-navy mt-6 mb-3">
          {renderInline(line.slice(3))}
        </h2>
      )

    // H3
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-body-lg font-normal text-stripe-label mt-5 mb-2">
          {renderInline(line.slice(4))}
        </h3>
      )

    // HR
    } else if (line.trim() === '---') {
      elements.push(<hr key={i} className="border-stripe-border my-6" />)

    // Bullet list
    } else if (/^[*-] /.test(line)) {
      const items = []
      while (i < lines.length && /^[*-] /.test(lines[i])) {
        items.push({ text: lines[i].slice(2), key: i })
        i++
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc ml-6 space-y-1.5 mb-4 marker:text-stripe-purple">
          {items.map(item => (
            <li key={item.key} className="text-body font-light text-stripe-navy">{renderInline(item.text)}</li>
          ))}
        </ul>
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
        <ol key={`ol-${i}`} className="list-decimal ml-6 space-y-1.5 mb-4 marker:text-stripe-purple">
          {items.map(item => (
            <li key={item.key} className="text-body font-light text-stripe-navy">{renderInline(item.text)}</li>
          ))}
        </ol>
      )
      continue

    // Table — detect | col | col | pattern
    } else if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      // Collect all table lines
      const tableLines = []
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      // Parse: first row = header, second row = separator, rest = body
      const parseRow = (r) => r.trim().slice(1, -1).split('|').map(c => c.trim())
      const header = parseRow(tableLines[0])
      const body = tableLines.slice(2).map(parseRow) // skip separator row
      elements.push(
        <div key={`table-${i}`} className="overflow-x-auto">
          <table className="w-full my-4 text-caption border-collapse">
            <thead>
              <tr>
                {header.map((h, ci) => (
                  <th key={ci} className="border-b border-stripe-border font-normal text-stripe-label text-left py-2 px-3">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border-b border-stripe-border/50 py-2 px-3 text-stripe-body">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue

    // Email block — lines starting with "Dear" or containing @, treat as email letter
    // Blockquote
    } else if (line.startsWith('> ')) {
      // Check if this is part of an email (contains greeting patterns)
      const emailGreeting = /^>\s*(Dear|Hi|Hello|To\s+Whom|Subject:)/i.test(line)
      if (emailGreeting) {
        // Collect full email blockquote
        const emailLines = []
        while (i < lines.length && lines[i].startsWith('> ')) {
          emailLines.push(lines[i].slice(2))
          i++
        }
        elements.push(
          <div key={`email-${i}`} className="my-3 mb-4 bg-stripe-border/20 border border-stripe-border rounded-stripe overflow-hidden">
            <div className="px-4 py-1.5 bg-black/[.03] border-b border-stripe-border/70 text-[11px] text-stripe-body font-semibold tracking-widest uppercase">
              参考回复邮件
            </div>
            <div className="px-5 py-4 text-stripe-navy text-sm leading-loose whitespace-pre-wrap" style={{ fontFamily: "'Georgia', serif" }}>
              {emailLines.join('\n')}
            </div>
          </div>
        )
        continue
      }
      elements.push(
        <blockquote key={i} className="border-l-2 border-stripe-purple pl-4 py-1 my-4 text-stripe-body italic">
          {renderInline(line.slice(2))}
        </blockquote>
      )

    // Empty line
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1" />)

    // Paragraph
    } else {
      elements.push(
        <p key={i} className="text-body font-light text-stripe-navy leading-relaxed mb-4">
          {renderInline(line)}
        </p>
      )
    }
    i++
  }

  return <div className="select-text">{elements}</div>
  } catch (err) { return <div className="text-caption text-stripe-body py-2">内容渲染失败</div> }
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
      if (bi) { parts.push(<strong key={key++} className="font-normal text-stripe-navy italic">{bi[1]}</strong>); remaining = remaining.slice(bi[0].length); continue }
      const b = remaining.match(/^\*\*(.*?)\*\*/)
      if (b) { parts.push(<strong key={key++} className="font-normal text-stripe-navy">{b[1]}</strong>); remaining = remaining.slice(b[0].length); continue }
      const it = remaining.match(/^\*(.*?)\*/)
      if (it) { parts.push(<em key={key++} className="italic">{it[1]}</em>); remaining = remaining.slice(it[0].length); continue }
      const co = remaining.match(/^`(.*?)`/)
      if (co) { parts.push(<code key={key++} className="font-mono text-caption-sm px-1.5 py-0.5 bg-stripe-border/50 rounded-stripe-sm text-stripe-navyDeep">{co[1]}</code>); remaining = remaining.slice(co[0].length); continue }
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
        <div className="text-stripe-body text-[13px] py-3 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          此记录内容格式异常，无法显示
        </div>
      )
    }
    const { text } = this.props
    if (!text || typeof text !== 'string') return <span className="text-stripe-body text-[13px]">无内容</span>
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

function IntelCard({ title, section, children }) {
  const status = section?.status
  const dotColor =
    status === 'ok' ? 'bg-stripe-success' :
    status === 'failed' ? 'bg-stripe-ruby' :
    status === 'skipped' ? 'bg-stripe-body' :
    'bg-stripe-border'
  const pulsing = !status
  const borderColor = status === 'failed' ? 'border-stripe-ruby/40' : 'border-stripe-border'

  return (
    <div className={`bg-white border ${borderColor} rounded-stripe-sm p-3 min-h-[88px] transition-colors hover:border-stripe-purpleLight`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${pulsing ? 'animate-pulse' : ''}`} />
        <span className="text-caption font-normal text-stripe-navy">{title}</span>
      </div>
      <div className="text-caption-sm font-light text-stripe-body leading-relaxed">
        {children}
      </div>
    </div>
  )
}

function IntelQueryLine({ label = '查询', value }) {
  if (!value) return null
  return (
    <div className="text-[11px] font-mono text-stripe-body/80 mb-1.5 break-all">
      <span className="text-stripe-body/60">{label}:</span> {value}
    </div>
  )
}

function IntelResultItem({ index, result, linkColor = 'text-stripe-purple' }) {
  const hover = linkColor === 'text-stripe-ruby' ? 'hover:text-stripe-ruby/80' : 'hover:text-stripe-purpleHover'
  return (
    <div className="mt-2 text-[11px] leading-relaxed">
      <a
        href={result.link}
        target="_blank"
        rel="noreferrer"
        className={`${linkColor} ${hover} hover:underline font-normal block truncate`}
        title={result.title}
      >
        {index + 1}. {result.title || '(无标题)'}
      </a>
      {result.snippet && (
        <div className="text-stripe-body/80 mt-0.5 line-clamp-2">{result.snippet}</div>
      )}
    </div>
  )
}

function IntelPanel({ intel }) {
  if (!intel) return null
  const e = intel.extracted || {}
  return (
    <div className="bg-white border border-stripe-border rounded-stripe shadow-stripe-ambient">
      <div className="px-5 py-4 border-b border-stripe-border flex items-center justify-between">
        <h3 className="text-subheading font-light text-stripe-navy">🔍 实时情报</h3>
        {intel.meta?.durationMs && (
          <span className="text-caption-sm font-mono text-stripe-body">
            {(intel.meta.durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>
      {intel.meta?.extractionStatus && intel.meta.extractionStatus !== 'ok' && (
        <div className="px-5 py-3 bg-stripe-ruby/10 border-b border-stripe-ruby/30 text-caption text-stripe-ruby">
          <b className="font-normal">⚠️ 实体抽取失败</b>
          <span className="ml-2 opacity-80">
            ({intel.meta.extractionModel || '?'}):{intel.meta.extractionError || '未知错误'}
          </span>
          <div className="mt-1 text-caption-sm text-stripe-ruby/80">
            没有抽到发件方实体,下游搜索无法进行。请检查控制台日志或换一个多模态模型。
          </div>
        </div>
      )}
      {(e.companyName || e.companyUrl || e.personName || e.email) && (
        <div className="px-5 py-3 bg-stripe-purpleLight/15 border-b border-stripe-border text-caption text-stripe-label space-y-1">
          {e.companyName && (
            <div>
              <b className="text-stripe-navy font-normal">公司:</b> {e.companyName}
            </div>
          )}
          {e.companyUrl && (
            <div>
              <b className="text-stripe-navy font-normal">网址:</b>{' '}
              <a href={e.companyUrl} target="_blank" rel="noreferrer" className="font-mono text-stripe-purple hover:underline break-all">
                {e.companyUrl}
              </a>
            </div>
          )}
          {e.personName && (
            <div>
              <b className="text-stripe-navy font-normal">联系人:</b> {e.personName}
              {e.personTitle && ` · ${e.personTitle}`}
            </div>
          )}
          {e.email && (
            <div>
              <b className="text-stripe-navy font-normal">邮箱:</b>{' '}
              <span className="font-mono">{e.email}</span>
            </div>
          )}
        </div>
      )}
      <div className="p-4 grid grid-cols-2 gap-3">
        <IntelCard title="发件方公司网站" section={intel.website}>
          {intel.website?.status === 'ok' ? (
            <>
              {intel.website.url && <IntelQueryLine label="URL" value={intel.website.url} />}
              <div className="font-normal text-stripe-navy line-clamp-2">{intel.website.title || '(无标题)'}</div>
              {intel.website.excerpt && (
                <div className="mt-1 line-clamp-3">{intel.website.excerpt}</div>
              )}
            </>
          ) : (
            intel.website?.error || '—'
          )}
        </IntelCard>

        <IntelCard title="LinkedIn" section={intel.linkedin}>
          {intel.linkedin?.status === 'ok' ? (
            <>
              <IntelQueryLine value={intel.linkedin.query} />
              <div>{intel.linkedin.found ? `✓ 找到 ${intel.linkedin.topResults.length} 条` : '✗ 未找到'}</div>
              {intel.linkedin.topResults?.map((r, i) => (
                <IntelResultItem key={i} index={i} result={r} />
              ))}
            </>
          ) : (
            intel.linkedin?.error || '—'
          )}
        </IntelCard>

        <IntelCard title="Facebook" section={intel.facebook}>
          {intel.facebook?.status === 'ok' ? (
            <>
              <IntelQueryLine value={intel.facebook.query} />
              <div>{intel.facebook.found ? `✓ 找到 ${intel.facebook.topResults.length} 条` : '✗ 未找到'}</div>
              {intel.facebook.topResults?.map((r, i) => (
                <IntelResultItem key={i} index={i} result={r} />
              ))}
            </>
          ) : (
            intel.facebook?.error || '—'
          )}
        </IntelCard>

        <IntelCard title="Panjiva 海关" section={intel.panjiva}>
          {intel.panjiva?.status === 'ok' ? (
            <>
              <IntelQueryLine value={intel.panjiva.query} />
              <div>{intel.panjiva.hasRecord ? `✓ 搜到 ${intel.panjiva.resultCount} 条` : '✗ 未发现'}</div>
              {intel.panjiva.topResults?.map((r, i) => (
                <IntelResultItem key={i} index={i} result={r} />
              ))}
            </>
          ) : (
            intel.panjiva?.error || '—'
          )}
        </IntelCard>

        <IntelCard title="负面搜索" section={intel.negative}>
          {intel.negative?.status === 'ok' ? (
            <>
              <IntelQueryLine value={intel.negative.query} />
              <div>{intel.negative.hitCount > 0 ? `⚠️ 发现 ${intel.negative.hitCount} 条` : '✓ 未发现负面'}</div>
              {intel.negative.hits?.map((r, i) => (
                <IntelResultItem key={i} index={i} result={r} linkColor="text-stripe-ruby" />
              ))}
            </>
          ) : (
            intel.negative?.error || '—'
          )}
        </IntelCard>

        <IntelCard title="发件方电话" section={intel.phone}>
          {intel.phone?.status === 'ok' ? (
            <>
              <IntelQueryLine value={intel.phone.query} />
              <div>{intel.phone.hitCount > 0 ? `✓ 找到 ${intel.phone.hitCount} 条公开记录` : '✗ 未发现公开记录'}</div>
              {intel.phone.hits?.map((r, i) => (
                <IntelResultItem key={i} index={i} result={r} />
              ))}
            </>
          ) : (
            intel.phone?.error || '—'
          )}
        </IntelCard>

        <IntelCard title="建站时间" section={intel.wayback}>
          {intel.wayback?.status === 'ok' ? (
            intel.wayback.firstSnapshot ? (
              <>
                <div>最早快照:<span className="font-mono text-stripe-navy">{intel.wayback.firstSnapshot}</span></div>
                <div className="mt-0.5">建站约 <span className="font-mono text-stripe-navy">{intel.wayback.ageYears}</span> 年{intel.wayback.ageYears != null && intel.wayback.ageYears < 2 && ' ⚠️'}</div>
              </>
            ) : '无快照记录'
          ) : (
            intel.wayback?.error || '—'
          )}
        </IntelCard>
      </div>
    </div>
  )
}

function ScoreBadge({ score, size = 'md' }) {
  const variants = {
    high:    { bg: 'bg-stripe-ruby/15',    text: 'text-stripe-ruby',        border: 'border-stripe-ruby/40',        label: '高风险', dot: 'bg-stripe-ruby' },
    medium:  { bg: 'bg-stripe-lemon/15',   text: 'text-stripe-lemon',       border: 'border-stripe-lemon/40',       label: '中风险', dot: 'bg-stripe-lemon' },
    low:     { bg: 'bg-stripe-success/15', text: 'text-stripe-successText', border: 'border-stripe-success/40',     label: '低风险', dot: 'bg-stripe-success' },
    unknown: { bg: 'bg-stripe-border',     text: 'text-stripe-body',        border: 'border-stripe-border',         label: '待定',   dot: 'bg-stripe-body' },
  }
  const v = variants[score] || variants.unknown
  const sizeCls = size === 'sm' ? 'text-caption-sm px-2 py-0.5' : 'text-caption px-3 py-1'
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-stripe-sm ${v.bg} ${v.text} ${v.border} ${sizeCls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
      {v.label}
    </span>
  )
}

// ─── FORM COMPONENTS ──────────────────────────────────────────────────────────
function FormItem({ label, hint, children, error }) {
  return (
    <div>
      {label && (
        <label className="text-caption text-stripe-label font-normal block mb-2">{label}</label>
      )}
      {children}
      {hint && !error && <div className="mt-1.5 text-caption-sm text-stripe-body">{hint}</div>}
      {error && <div className="mt-1.5 text-caption-sm text-stripe-ruby">{error}</div>}
    </div>
  )
}

function PasswordInput({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full h-10 px-3 pr-10 text-body font-light bg-white border border-stripe-border rounded-stripe-sm focus:outline-none focus:border-stripe-purple focus:ring-2 focus:ring-stripe-purple/20 transition"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-stripe-body hover:text-stripe-purple"
        aria-label={show ? '隐藏' : '显示'}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  )
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `登录失败 (${res.status})`)
      }
      const data = await res.json()
      onLogin(data)
    } catch (err) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* LEFT — dark brand */}
      <aside className="lg:w-1/2 bg-stripe-brandDark text-white relative overflow-hidden flex flex-col">
        {/* Mobile mini hero */}
        <div className="lg:hidden h-[180px] px-6 py-8 flex flex-col justify-center">
          <Logo variant="light" />
          <h1 className="mt-4 text-heading font-light text-white leading-tight">
            外贸背调 · 证据驱动
          </h1>
        </div>

        {/* Desktop full hero */}
        <div className="hidden lg:flex flex-col h-full px-16 py-20">
          <Logo variant="light" />
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <h1 className="text-display font-light tracking-[-1.4px] leading-[1.03] text-white">
              外贸背调
              <br />
              证据驱动的风险分析
            </h1>
            <p className="mt-8 text-body-lg font-light text-white/70 leading-relaxed">
              LinkedIn · Panjiva · 建站时间 · 公司网站 · 负面舆情 —— 所有判断都可追溯到原始来源。
            </p>
          </div>
          <div className="text-caption-sm text-white/40">© 2026 trade-check</div>
        </div>

        {/* Gradient decoration */}
        <div
          className="hidden lg:block absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-gradient-to-br from-stripe-ruby to-stripe-magenta opacity-40 blur-3xl pointer-events-none"
          aria-hidden
        />
      </aside>

      {/* RIGHT — form */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <h2 className="text-heading font-light tracking-[-0.64px] text-stripe-navy">欢迎回来</h2>
          <p className="mt-2 text-body font-light text-stripe-body">请使用管理员分配的账号登录</p>

          <div className="mt-10">
            <label className="text-caption text-stripe-label block mb-2">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full h-10 px-3 text-body font-light bg-white border border-stripe-border rounded-stripe-sm focus:outline-none focus:border-stripe-purple focus:ring-2 focus:ring-stripe-purple/20 transition"
            />
          </div>

          <div className="mt-5 relative">
            <label className="text-caption text-stripe-label block mb-2">密码</label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full h-10 px-3 pr-10 text-body font-light bg-white border border-stripe-border rounded-stripe-sm focus:outline-none focus:border-stripe-purple focus:ring-2 focus:ring-stripe-purple/20 transition"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3 top-[34px] text-stripe-body hover:text-stripe-purple"
              aria-label={showPwd ? '隐藏密码' : '显示密码'}
            >
              <EyeIcon open={showPwd} />
            </button>
          </div>

          {error && (
            <div className="mt-4 text-caption text-stripe-ruby animate-shake">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-8 w-full h-11 bg-stripe-purple hover:bg-stripe-purpleHover text-white text-btn rounded-stripe-sm transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? <Spinner size={16} color="#ffffff" /> : '登录'}
          </button>

          <div className="mt-6 text-center">
            <span className="text-link text-stripe-body">忘记密码?请联系管理员</span>
          </div>
        </form>
      </main>
    </div>
  )
}

// ─── QUERY PAGE ───────────────────────────────────────────────────────────────
function QueryPage({ user }) {
  const [url, setUrl] = useState('')
  const [channel, setChannel] = useState('')
  const [inquiry, setInquiry] = useState('')
  const [images, setImages] = useState([])       // [{name, base64, preview}]
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [inputCollapsed, setInputCollapsed] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [enableIntel, setEnableIntel] = useState(() => {
    if (typeof window === 'undefined') return true
    const v = window.localStorage.getItem('trade-check:enableIntel')
    return v === null ? true : v === 'true'
  })
  const [intel, setIntel] = useState(null)
  const [intelProgress, setIntelProgress] = useState({})
  const [intelWarning, setIntelWarning] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('trade-check:enableIntel', String(enableIntel))
    }
  }, [enableIntel])

  const resultRef = useRef(null)

  const abortCtrlRef = useRef(null)

  const stopAnalyze = () => {
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort()
      abortCtrlRef.current = null
    }
    setInputCollapsed(false)
  }

  const analyze = async () => {
    // Per-field validation
    const errs = {}
    if (!url.trim()) errs.url = '请填写我方公司网址'
    if (!channel) errs.channel = '请选择询盘渠道'
    if (!inquiry.trim() && images.length === 0) errs.inquiry = '请填写询盘信息或上传名片图片'
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    setFieldErrors({})
    setLoading(true); setError(''); setResult(''); setStreaming(true); setInputCollapsed(true)
    setIntel(null)
    setIntelProgress({})
    setIntelWarning('')

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
        body: JSON.stringify({
          url,
          channel,
          inquiry,
          images: images.map(img => ({ base64: img.base64, type: img.type })),
          enableIntel,
        }),
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
          if (raw === '') continue
          let msg
          try { msg = JSON.parse(raw) }
          catch (e) { if (e.message !== 'Unexpected end of JSON input') throw e; continue }

          const type = msg.type || (msg.delta ? 'delta' : msg.error ? 'error' : null)

          if (type === 'error') {
            throw new Error(msg.error || '未知错误')
          }
          if (type === 'intelError') {
            setIntelWarning(msg.error || '情报收集失败')
            continue
          }
          if (type === 'intel') {
            lastContentAt = Date.now()
            setIntelProgress(prev => ({ ...prev, ...msg.partial }))
            continue
          }
          if (type === 'intelDone') {
            lastContentAt = Date.now()
            setIntel(msg.intel)
            setIntelProgress(msg.intel || {})
            continue
          }
          if (type === 'delta' && msg.delta) {
            lastContentAt = Date.now()
            setResult(prev => prev + msg.delta)
            if (resultRef.current) resultRef.current.scrollTop = resultRef.current.scrollHeight
            continue
          }
          if (type === 'done') {
            lastContentAt = Date.now()
            if (msg.intel) setIntel(msg.intel)
            continue
          }
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
      // Keep collapsed after done so result is visible; user can re-expand by clicking
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    analyze()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-6 pb-8">
      {/* LEFT column — input + intel panel */}
      <div className="w-full lg:w-[420px] lg:shrink-0 space-y-4 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-2">
        {!inputCollapsed ? (
          <div className="bg-white border border-stripe-border rounded-stripe shadow-stripe-ambient overflow-hidden">
            <div className="px-5 py-4 border-b border-stripe-border flex items-center justify-between">
              <h3 className="text-subheading font-light text-stripe-navy">背调输入</h3>
              <button
                type="button"
                onClick={() => setInputCollapsed(true)}
                className="text-caption text-stripe-body hover:text-stripe-purple"
              >
                收起
              </button>
            </div>
            <div className="px-5 py-5 space-y-5">
              <FormItem label="我方公司网址" hint="您自己的公司官网,用于让 AI 理解您的业务,不会被当作调查目标" error={fieldErrors.url}>
                <textarea
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value)
                    if (e.target.value.trim()) setFieldErrors((p) => ({ ...p, url: null }))
                  }}
                  rows={2}
                  className="w-full px-3 py-2 text-body font-light border border-stripe-border rounded-stripe-sm resize-none focus:outline-none focus:border-stripe-purple focus:ring-2 focus:ring-stripe-purple/20 transition"
                />
              </FormItem>
              <FormItem label="询盘渠道" hint="客户是通过哪个渠道找到您的,用于 AI 结合来源判断可信度" error={fieldErrors.channel}>
                <select
                  value={channel}
                  onChange={(e) => {
                    setChannel(e.target.value)
                    if (e.target.value) setFieldErrors((p) => ({ ...p, channel: null }))
                  }}
                  className="w-full h-10 px-3 text-body font-light bg-white border border-stripe-border rounded-stripe-sm focus:outline-none focus:border-stripe-purple focus:ring-2 focus:ring-stripe-purple/20 transition"
                >
                  <option value="">— 请选择 —</option>
                  {INQUIRY_CHANNELS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </FormItem>
              <FormItem label="客户询盘内容" hint="收到的邮件、WhatsApp、微信聊天原文" error={fieldErrors.inquiry}>
                <textarea
                  value={inquiry}
                  onChange={(e) => {
                    setInquiry(e.target.value)
                    if (e.target.value.trim()) setFieldErrors((p) => ({ ...p, inquiry: null }))
                  }}
                  rows={5}
                  className="w-full px-3 py-2 text-body font-light border border-stripe-border rounded-stripe-sm resize-none focus:outline-none focus:border-stripe-purple focus:ring-2 focus:ring-stripe-purple/20 transition"
                />
              </FormItem>

              <FormItem label="客户名片 / 邮件截图(可选)" hint="上传后 AI 会 OCR 识别发件方信息 · 最多 4 张">
                <ImageDropzone images={images} setImages={setImages} maxImages={4} />
              </FormItem>

              <label className="flex items-center gap-2 text-caption text-stripe-label cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableIntel}
                  onChange={(e) => setEnableIntel(e.target.checked)}
                  className="accent-stripe-purple w-4 h-4"
                />
                启用实时情报检测+升级分析模型
              </label>
              {error && <div className="text-caption text-stripe-ruby">{error}</div>}
            </div>
            <div className="px-5 py-4 bg-stripe-border/30 border-t border-stripe-border">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-stripe-purple hover:bg-stripe-purpleHover text-white text-btn rounded-stripe-sm disabled:opacity-50 transition-colors flex items-center justify-center"
              >
                {loading ? <Spinner size={16} color="#ffffff" /> : '开始分析'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setInputCollapsed(false)}
            className="w-full h-14 px-5 bg-white border border-stripe-border rounded-stripe hover:border-stripe-purpleLight flex items-center gap-3 transition-colors text-left"
          >
            <SearchIcon className="text-stripe-body shrink-0" />
            <span className="flex-1 truncate font-mono text-caption-sm text-stripe-label">
              {url || '(未填写)'}
            </span>
            {images.length > 0 && (
              <span className="text-caption-sm text-stripe-purple">+{images.length}图</span>
            )}
            <span className="text-caption text-stripe-body">展开</span>
          </button>
        )}

        {(intel || Object.keys(intelProgress).length > 0) && (
          <IntelPanel intel={intel || intelProgress} />
        )}
      </div>

      {/* RIGHT column — result */}
      <div className="flex-1 min-w-0 bg-white border border-stripe-border rounded-stripe shadow-stripe-card flex flex-col lg:max-h-[calc(100vh-8rem)]">
        <div className="px-6 py-4 border-b border-stripe-border flex items-center justify-between">
          <h3 className="text-subheading font-light text-stripe-navy">风险分析报告</h3>
          <div className="flex items-center gap-3">
            {streaming && <Spinner size={14} />}
            {extractScore(result) && <ScoreBadge score={extractScore(result)} size="sm" />}
          </div>
        </div>

        {intelWarning && (
          <div className="mx-6 mt-4 px-4 py-3 bg-[#fff8c5] border border-[#d4a72c]/50 rounded-stripe-sm text-caption text-stripe-lemon">
            ⚠️ 实时情报收集失败(已降级到基础分析):{intelWarning}
          </div>
        )}

        <div ref={resultRef} className="flex-1 overflow-y-auto px-6 py-6">
          {!result && !streaming ? (
            <EmptyState
              icon={<SearchIcon size={20} />}
              title="等待分析"
              description="填写左侧表单后点击「开始分析」"
            />
          ) : (
            <article className="max-w-none">
              <MarkdownRenderer content={result} />
              {result && !streaming && <AiDisclaimer />}
            </article>
          )}
        </div>

        {result && !streaming && (
          <div className="px-6 py-3 border-t border-stripe-border bg-stripe-border/20 flex items-center justify-between text-caption text-stripe-body">
            <span>分析完成</span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(result)}
              className="text-stripe-purple hover:text-stripe-purpleHover font-normal"
            >
              复制报告
            </button>
          </div>
        )}
      </div>
    </form>
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

function ScoreChip({ label, value, color }) {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : parseInt(value)
  if (Number.isNaN(n)) return null
  return (
    <div className="flex items-center gap-1 min-w-0">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color}`} />
      <span className="text-caption-sm text-stripe-body truncate">{label}</span>
      <span className="text-caption-sm font-medium text-stripe-label tabular-nums">{n}</span>
    </div>
  )
}

function HistoryCard({ query, active, onClick }) {
  const hasIntel = query.intelEnabled === 'true' || query.intelEnabled === true
  const when = query.createdAt
    ? new Date(query.createdAt).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''
  const anyScore =
    query.scoreInquiry != null ||
    query.scoreCustomer != null ||
    query.scoreMatch != null ||
    query.scoreStrategy != null
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full p-4 rounded-stripe border text-left transition-colors ${
        active
          ? 'bg-stripe-purpleLight/20 border-stripe-purple'
          : 'bg-white border-stripe-border hover:border-stripe-purpleLight'
      }`}
    >
      <div className="mb-2 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] uppercase tracking-wide text-stripe-purple font-medium">客户</span>
          {query.customerCountry && (
            <span className="text-caption-sm text-stripe-body">· {query.customerCountry}</span>
          )}
        </div>
        <span className="block text-caption font-medium text-stripe-navy truncate">
          {query.customerName || query.customerUrl || query.customerEmail || '(未识别客户)'}
        </span>
        {(query.customerUrl || query.customerEmail) && query.customerName && (
          <span className="block text-caption-sm font-mono text-stripe-body truncate mt-0.5">
            {query.customerUrl || query.customerEmail}
          </span>
        )}
      </div>
      {anyScore && (
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 mb-2">
          <ScoreChip label="询盘质量" value={query.scoreInquiry}  color="bg-stripe-ruby" />
          <ScoreChip label="客户实力" value={query.scoreCustomer} color="bg-stripe-success" />
          <ScoreChip label="双方匹配" value={query.scoreMatch}    color="bg-stripe-purple" />
          <ScoreChip label="老板雷达" value={query.scoreStrategy} color="bg-stripe-lemon" />
        </div>
      )}
      <div className="flex items-center justify-between text-caption-sm text-stripe-body">
        <span>{when}</span>
        {hasIntel && <span className="text-stripe-purple">实时数据</span>}
      </div>
      {query.channel && (
        <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] uppercase tracking-wide text-stripe-purple font-medium shrink-0">渠道</span>
          <span className="text-caption-sm text-stripe-label truncate">{query.channel}</span>
        </div>
      )}
    </button>
  )
}

function HistoryPage({ user }) {
  const [queries, setQueries] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [expandError, setExpandError] = useState({})
  const [detailLoading, setDetailLoading] = useState(false)

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

  // Lazy-load the heavy `intel` blob only when a card is clicked.
  // List payload is intentionally lean (see lib/kv.js LIST_FIELDS).
  const handleSelect = async (q) => {
    if (selected === q) { setSelected(null); return }
    setSelected(q)
    // `result` is absent from the lean list payload; presence means we already hydrated.
    if (q.result !== undefined || !q.id) return
    setDetailLoading(true)
    try {
      const r = await fetch(`/api/queries/${encodeURIComponent(q.id)}`)
      if (r.ok) {
        const full = await r.json()
        setQueries(prev => prev.map(x => x.id === q.id ? { ...x, ...full } : x))
        setSelected(prev => prev && prev.id === q.id ? { ...prev, ...full } : prev)
      }
    } catch {
      // swallow — detail panel will just show what we have
    } finally {
      setDetailLoading(false)
    }
  }

  const visible = queries.filter(q =>
    !search ||
    q.url?.toLowerCase().includes(search.toLowerCase()) ||
    q.inquiry?.toLowerCase().includes(search.toLowerCase()) ||
    q.userEmail?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* LEFT: list */}
      <div className="w-full lg:w-[380px] lg:shrink-0 space-y-2">
        <div className="relative mb-3">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-stripe-body" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索 URL 或询盘内容..."
            className="w-full h-10 pl-10 pr-3 text-body font-light bg-white border border-stripe-border rounded-stripe-sm focus:outline-none focus:border-stripe-purple focus:ring-2 focus:ring-stripe-purple/20 transition"
          />
        </div>

        {loading ? (
          <div className="py-8 flex justify-center">
            <Spinner />
          </div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-caption text-stripe-body">暂无历史记录</div>
        ) : (
          <div className="space-y-2 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:pr-2">
            {visible.map((q, i) => (
              <HistoryCard
                key={q.id || q.createdAt || i}
                query={q}
                active={selected === q}
                onClick={() => handleSelect(q)}
              />
            ))}
          </div>
        )}
      </div>

      {/* RIGHT: detail */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="h-full min-h-[320px] bg-white border border-stripe-border rounded-stripe">
            <EmptyState
              icon={<ClockIcon size={20} />}
              title="选择一条历史记录"
              description="左侧列表中点击任意条目查看完整分析"
            />
          </div>
        ) : (
          (() => {
            const parsedIntel = (() => {
              if (!selected?.intel) return null
              if (typeof selected.intel === 'string') {
                try {
                  return JSON.parse(selected.intel)
                } catch {
                  return null
                }
              }
              return selected.intel
            })()
            const historyIntelEnabled =
              parsedIntel &&
              selected?.intelEnabled !== 'false' &&
              selected?.intelEnabled !== false
            return (
              <div className="space-y-4">
                <div className="bg-white border border-stripe-border rounded-stripe p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-caption-sm text-stripe-body">
                      {new Date(selected.createdAt).toLocaleString('zh-CN')}
                    </span>
                    {(selected.riskLevel || extractScore(selected.result)) && (
                      <ScoreBadge score={selected.riskLevel || extractScore(selected.result)} />
                    )}
                  </div>
                  <div className="text-caption font-mono text-stripe-label break-all">
                    {selected.url || '(无URL)'}
                  </div>
                  {selected.inquiry && (
                    <div className="mt-3 text-caption text-stripe-body line-clamp-2">
                      {selected.inquiry}
                    </div>
                  )}
                </div>

                {historyIntelEnabled && <IntelPanel intel={parsedIntel} />}
                {!parsedIntel && detailLoading && (selected?.intelEnabled === 'true' || selected?.intelEnabled === true) && (
                  <div className="bg-white border border-stripe-border rounded-stripe p-6 flex items-center justify-center gap-3 text-caption text-stripe-body">
                    <Spinner />
                    <span>加载情报数据…</span>
                  </div>
                )}

                <div className="bg-white border border-stripe-border rounded-stripe shadow-stripe-card p-6">
                  {selected.result ? (
                    <article className="max-w-none">
                      <MarkdownRenderer content={selected.result} />
                      <AiDisclaimer />
                    </article>
                  ) : (
                    <div className="py-10 flex items-center justify-center gap-3 text-caption text-stripe-body">
                      <Spinner />
                      <span>加载分析报告…</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })()
        )}
      </div>
    </div>
  )
}

// ─── SETTINGS CARD ────────────────────────────────────────────────────────────
function SettingsCard({ title, description, adminBadge, children }) {
  return (
    <div className="bg-white border border-stripe-border rounded-stripe shadow-stripe-ambient overflow-hidden">
      <div className="px-6 py-5 border-b border-stripe-border flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-subheading font-light text-stripe-navy">{title}</h3>
          {description && (
            <p className="mt-1 text-caption text-stripe-body">{description}</p>
          )}
        </div>
        {adminBadge && (
          <span className="text-[10px] bg-stripe-brandDark text-white px-2 py-1 rounded-stripe-sm shrink-0">
            ADMIN
          </span>
        )}
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </div>
  )
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
function SettingsPage({ user }) {
  const [form, setForm] = useState({
    baseUrl: '',
    systemPrompt: '',
    fallbackSystemPrompt: '',
    serpApiKey: '',
    extractionModel: 'gemini-2.5-flash',
    extractionPrompt: '',
    apiKey: '',
    modelName: 'gemini-3.1-pro-preview-vertex',
  })
  const [serpUsage, setSerpUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      setForm(f => ({
        ...f,
        baseUrl: d.baseUrl ?? '',
        systemPrompt: d.systemPrompt ?? '',
        fallbackSystemPrompt: d.fallbackSystemPrompt ?? '',
        serpApiKey: d.serpApiKey ?? '',
        extractionModel: d.extractionModel ?? 'gemini-2.5-flash',
        extractionPrompt: d.extractionPrompt ?? '',
        apiKey: d.apiKey ?? '',
        modelName: d.modelName ?? f.modelName,
      }))
      if (d.serpUsage) setSerpUsage(d.serpUsage)
      setLoading(false)
    })
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      baseUrl: form.baseUrl,
      systemPrompt: form.systemPrompt,
      fallbackSystemPrompt: form.fallbackSystemPrompt,
      serpApiKey: form.serpApiKey,
      extractionModel: form.extractionModel,
      extractionPrompt: form.extractionPrompt,
      apiKey: form.apiKey,
      modelName: form.modelName,
    }) })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const isAdmin = user?.role === 'admin'
  const inputCls =
    'w-full h-10 px-3 text-body font-light bg-white border border-stripe-border rounded-stripe-sm focus:outline-none focus:border-stripe-purple focus:ring-2 focus:ring-stripe-purple/20 transition'
  const textareaCls =
    'w-full px-3 py-2 text-body font-light bg-white border border-stripe-border rounded-stripe-sm resize-y focus:outline-none focus:border-stripe-purple focus:ring-2 focus:ring-stripe-purple/20 transition'

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSave}
      className="max-w-[680px] mx-auto space-y-6 pb-28"
    >
      <SettingsCard title="模型配置" description="API 接入与主分析模型">
        {isAdmin && (
          <FormItem label="Base URL" hint="OpenAI 兼容端点">
            <input
              className={inputCls}
              value={form.baseUrl || ''}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            />
          </FormItem>
        )}
        <FormItem label="API Key" hint="你的个人密钥,不与他人共享">
          <PasswordInput
            value={form.apiKey || ''}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
          />
        </FormItem>
        <FormItem label="主分析模型" hint="例:gemini-3.1-pro-preview-vertex">
          {(() => {
            const DEFAULT_MODELS = ['claude-sonnet-4-6','gemini-3.1-pro-preview-vertex','gemini-3-pro-preview-thinking','gpt-5.4']
            const cur = form.modelName || ''
            const customModels = (form._customModels || []).filter(m => !DEFAULT_MODELS.includes(m))
            const allModels = [...DEFAULT_MODELS, ...customModels]
            const isAdding = form._addingModel
            return (
              <div className="flex gap-2 items-center">
                {isAdding ? (
                  <input
                    autoFocus
                    placeholder="输入模型名称，回车确认"
                    className={`${inputCls} font-mono text-caption-sm flex-1`}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        e.preventDefault()
                        const name = e.target.value.trim()
                        const updated = [...new Set([...(form._customModels || []), name])]
                        setForm({ ...form, modelName: name, _customModels: updated, _addingModel: false })
                      } else if (e.key === 'Escape') {
                        setForm({ ...form, _addingModel: false })
                      }
                    }}
                    onBlur={e => {
                      if (e.target.value.trim()) {
                        const name = e.target.value.trim()
                        const updated = [...new Set([...(form._customModels || []), name])]
                        setForm({ ...form, modelName: name, _customModels: updated, _addingModel: false })
                      } else {
                        setForm({ ...form, _addingModel: false })
                      }
                    }}
                  />
                ) : (
                  <>
                    <select
                      value={cur}
                      onChange={e => setForm({ ...form, modelName: e.target.value })}
                      className={`${inputCls} font-mono text-caption-sm cursor-pointer flex-1`}
                    >
                      {!allModels.includes(cur) && cur && <option value={cur}>{cur}</option>}
                      {allModels.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, _addingModel: true })}
                      className="w-10 h-10 rounded-stripe-sm border border-stripe-border bg-white text-stripe-purple hover:bg-stripe-purpleLight/20 flex items-center justify-center text-lg leading-none shrink-0 transition-colors"
                      title="添加自定义模型"
                    >+</button>
                  </>
                )}
              </div>
            )
          })()}
        </FormItem>
      </SettingsCard>

      {isAdmin && (
        <SettingsCard
          title="实时情报"
          description="SerpAPI 密钥与结构化抽取配置"
          adminBadge
        >
          <FormItem label="SerpAPI Key">
            <PasswordInput
              value={form.serpApiKey || ''}
              onChange={(e) => setForm({ ...form, serpApiKey: e.target.value })}
            />
            {serpUsage && (
              <div className="mt-2 text-caption-sm text-stripe-body font-mono">
                本月已调用{' '}
                <span className="text-stripe-purple font-normal">{serpUsage.count}</span> 次
                ({serpUsage.month})
              </div>
            )}
          </FormItem>
          <FormItem label="结构化抽取模型" hint="用便宜快速模型,如 gemini-2.5-flash">
            <input
              className={inputCls}
              value={form.extractionModel || ''}
              onChange={(e) => setForm({ ...form, extractionModel: e.target.value })}
            />
          </FormItem>
          <FormItem label="抽取 Prompt">
            <textarea
              className={`${textareaCls} font-mono text-caption-sm`}
              rows={8}
              value={form.extractionPrompt || ''}
              onChange={(e) => setForm({ ...form, extractionPrompt: e.target.value })}
            />
          </FormItem>
        </SettingsCard>
      )}

      {isAdmin && (
        <SettingsCard title="Prompt 模板" description="主分析与降级模板" adminBadge>
          <FormItem
            label="主 System Prompt(启用情报时使用)"
            hint="强制绑定情报简报的证据驱动模板"
          >
            <textarea
              className={`${textareaCls} font-mono text-caption-sm`}
              rows={12}
              value={form.systemPrompt || ''}
              onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            />
          </FormItem>
          <FormItem
            label="Fallback System Prompt(关闭情报或情报失败时使用)"
            hint="传统 5 维度模板"
          >
            <textarea
              className={`${textareaCls} font-mono text-caption-sm`}
              rows={8}
              value={form.fallbackSystemPrompt || ''}
              onChange={(e) => setForm({ ...form, fallbackSystemPrompt: e.target.value })}
            />
          </FormItem>
        </SettingsCard>
      )}

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-60 bg-white/95 backdrop-blur border-t border-stripe-border py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-end gap-3 z-20">
        {saved && <span className="text-caption text-stripe-successText">✓ 已保存</span>}
        <button
          type="submit"
          disabled={saving}
          className="h-10 px-6 text-btn text-white bg-stripe-purple hover:bg-stripe-purpleHover rounded-stripe-sm disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {saving && <Spinner size={14} color="#ffffff" />}
          保存更改
        </button>
      </div>
    </form>
  )
}

// ─── LAYOUT ───────────────────────────────────────────────────────────────────
function Layout({ user, onLogout, page, setPage, serpUsage, children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pageTitles = { query: '分析', history: '历史', settings: '设置' }
  const isAdmin = user?.role === 'admin'

  return (
    <div className="h-screen flex bg-white text-stripe-navy">
      {/* Mobile header (lg: hidden) */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-white border-b border-stripe-border flex items-center px-4 z-30">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-stripe-sm hover:bg-stripe-purpleLight/20 text-stripe-navy"
          aria-label="打开菜单"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div className="ml-3">
          <Logo />
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-30"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={`w-60 shrink-0 border-r border-stripe-border bg-white flex flex-col lg:static fixed inset-y-0 left-0 z-40 transition-transform ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-20 px-6 flex items-center">
          <Logo />
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          <NavItem
            icon={<SearchIcon />}
            label="分析"
            active={page === 'query'}
            onClick={() => {
              setPage('query')
              setMobileOpen(false)
            }}
          />
          <NavItem
            icon={<ClockIcon />}
            label="历史"
            active={page === 'history'}
            onClick={() => {
              setPage('history')
              setMobileOpen(false)
            }}
          />
          <NavItem
            icon={<GearIcon />}
            label="设置"
            active={page === 'settings'}
            onClick={() => {
              setPage('settings')
              setMobileOpen(false)
            }}
          />
        </nav>

        {isAdmin && serpUsage && (
          <div className="mx-3 mb-3 p-3 bg-stripe-purpleLight/15 border border-stripe-purpleLight/30 rounded-stripe text-caption-sm">
            <div className="text-stripe-label mb-1">SerpAPI 本月用量</div>
            <div className="font-mono text-stripe-purple text-body">{serpUsage.count} 次</div>
            <div className="text-stripe-body mt-0.5">{serpUsage.month}</div>
          </div>
        )}

        <div className="border-t border-stripe-border p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-stripe-purpleLight/30 text-stripe-purple flex items-center justify-center font-normal text-caption">
            {user?.email?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-caption text-stripe-navy truncate">{user?.name || user?.email}</div>
            <div className="text-caption-sm text-stripe-body truncate">{user?.email}</div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-8 h-8 flex items-center justify-center rounded-stripe-sm text-stripe-body hover:bg-stripe-purpleLight/20 hover:text-stripe-purple"
            title="登出"
            aria-label="登出"
          >
            <LogoutIcon />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden lg:pt-0 pt-14">
        <div className="sticky top-0 bg-white border-b border-stripe-border z-10 h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <h2 className="text-subheading font-light text-stripe-navy">{pageTitles[page] || ''}</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [page, setPage] = useState('query')
  const [serpUsage, setSerpUsage] = useState(null)

  useEffect(() => {
    fetch('/api/me').then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.email) setUser(d) })
      .finally(() => setChecking(false))
  }, [])

  useEffect(() => {
    if (!user) { setSerpUsage(null); return }
    fetch('/api/settings').then(r => r.ok ? r.json() : null).then(d => {
      if (d && d.serpUsage) setSerpUsage(d.serpUsage)
    }).catch(() => {})
  }, [user])

  const logout = async () => { await fetch('/api/auth', { method: 'DELETE' }); setUser(null); setPage('query') }

  if (checking) return <div className="min-h-screen bg-white flex items-center justify-center"><Spinner size={32} /></div>
  if (!user) return <LoginPage onLogin={setUser} />

  const content = page === 'history' ? <HistoryPage user={user} />
    : page === 'settings' ? <SettingsPage user={user} />
    : <QueryPage user={user} />

  return <Layout user={user} onLogout={logout} page={page} setPage={setPage} serpUsage={serpUsage}>{content}</Layout>
}

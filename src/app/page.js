'use client'
import React, { useState, useEffect, useRef } from 'react'

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

  // Base text style — matches Claude's body text
  const base = { fontFamily: T.fontBody, fontSize: 15, lineHeight: 1.8, color: T.textPrimary }

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
          <div key={`email-${i}`} style={{ margin: '12px 0 16px', background: '#fafaf8', border: `1px solid ${T.border}`, borderRadius: T.radiusMd, overflow: 'hidden' }}>
            <div style={{ padding: '6px 16px', background: T.bgContainer, borderBottom: `1px solid ${T.borderSecond}`, fontSize: 11, color: T.textTertiary, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              参考回复邮件
            </div>
            <div style={{ padding: '16px 20px', fontFamily: "'Georgia', serif", fontSize: 14, lineHeight: 2, color: T.textPrimary, whiteSpace: 'pre-wrap' }}>
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
      <div className="text-caption-sm font-light text-stripe-body leading-relaxed line-clamp-3">
        {children}
      </div>
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
      {(e.companyName || e.personName || e.email) && (
        <div className="px-5 py-3 bg-stripe-purpleLight/15 border-b border-stripe-border text-caption text-stripe-label space-y-1">
          {e.companyName && (
            <div>
              <b className="text-stripe-navy font-normal">公司:</b> {e.companyName}
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
        <IntelCard title="公司网站" section={intel.website}>
          {intel.website?.title || intel.website?.error || '—'}
        </IntelCard>
        <IntelCard title="建站时间" section={intel.wayback}>
          {intel.wayback?.firstSnapshot
            ? `${intel.wayback.firstSnapshot}(约 ${intel.wayback.ageYears}年)`
            : intel.wayback?.error || '无记录'}
        </IntelCard>
        <IntelCard title="LinkedIn" section={intel.linkedin}>
          {intel.linkedin?.status === 'ok'
            ? intel.linkedin.found
              ? `找到 ${intel.linkedin.topResults.length} 条`
              : '未找到'
            : intel.linkedin?.error || '—'}
          {intel.linkedin?.topResults?.slice(0, 2).map((r, i) => (
            <div key={i} className="mt-1">
              <a
                href={r.link}
                target="_blank"
                rel="noreferrer"
                className="text-stripe-purple hover:text-stripe-purpleHover underline decoration-stripe-purpleLight underline-offset-2"
              >
                {r.title}
              </a>
            </div>
          ))}
        </IntelCard>
        <IntelCard title="Facebook" section={intel.facebook}>
          {intel.facebook?.status === 'ok'
            ? intel.facebook.found
              ? `找到 ${intel.facebook.topResults.length} 条`
              : '未找到'
            : intel.facebook?.error || '—'}
        </IntelCard>
        <IntelCard title="Panjiva 海关" section={intel.panjiva}>
          {intel.panjiva?.status === 'ok'
            ? intel.panjiva.hasRecord
              ? `搜到 ${intel.panjiva.resultCount} 条`
              : '未发现'
            : intel.panjiva?.error || '—'}
        </IntelCard>
        <IntelCard title="负面搜索" section={intel.negative}>
          {intel.negative?.status === 'ok'
            ? intel.negative.hitCount > 0
              ? `⚠️ ${intel.negative.hitCount} 条`
              : '未发现'
            : intel.negative?.error || '—'}
          {intel.negative?.hits?.slice(0, 2).map((r, i) => (
            <div key={i} className="mt-1">
              <a
                href={r.link}
                target="_blank"
                rel="noreferrer"
                className="text-stripe-ruby hover:underline"
              >
                {r.title}
              </a>
            </div>
          ))}
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
  const [inquiry, setInquiry] = useState('')
  const [images, setImages] = useState([])       // [{name, base64, preview}]
  const [dragOver, setDragOver] = useState(false)
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
    setInputCollapsed(false)
  }

  const analyze = async () => {
    // Per-field validation
    const errs = {}
    if (!url.trim()) errs.url = '请填写您的公司网址或公司信息'
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
              <FormItem label="公司网址" hint="支持无 http:// 前缀" error={fieldErrors.url}>
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
              <FormItem label="询盘内容" hint="可贴原始邮件正文" error={fieldErrors.inquiry}>
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

              <FormItem label="附加图片(可选)" hint="拖拽、粘贴或点击 · 最多 4 张">
                {/* IMAGE_DROPZONE_PLACEHOLDER — R4.2 will replace this with <ImageDropzone/> */}
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
                    border: `1.5px solid ${dragOver ? '#635bff' : '#e0e0e0'}`,
                    borderRadius: 6,
                    background: dragOver ? '#f5f4ff' : '#fafafa',
                    transition: 'border-color 0.15s, background 0.15s',
                    overflow: 'hidden',
                  }}
                >
                  <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                    onChange={e => { processFiles(e.target.files); e.target.value = '' }} />

                  {/* Image strip — shown when images uploaded */}
                  {images.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 12px', alignItems: 'center' }}>
                      {images.map((img, idx) => (
                        <div key={idx} style={{ position: 'relative', flexShrink: 0 }}>
                          <img src={img.preview} alt={img.name}
                            style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid #e0e0e0', display: 'block' }} />
                          <button type="button" onClick={e => { e.stopPropagation(); removeImage(idx) }}
                            style={{ position: 'absolute', top: -5, right: -5, width: 17, height: 17, borderRadius: '50%', background: '#ff4d4f', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                            ×
                          </button>
                        </div>
                      ))}
                      {images.length < 4 && (
                        <div onClick={() => fileInputRef.current?.click()}
                          style={{ width: 60, height: 60, border: '1.5px dashed #e0e0e0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 20, cursor: 'pointer' }}>+</div>
                      )}
                    </div>
                  )}

                  {/* Bottom hint bar */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px 8px',
                      color: dragOver ? '#635bff' : '#ccc', fontSize: 12, cursor: 'pointer',
                      borderTop: images.length > 0 ? '1px solid #f0f0f0' : 'none', transition: 'color 0.15s' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                      <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.8"/>
                      <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                    <span>{dragOver ? '松开即可上传' : '拖拽到此区域或点击上传名片/图片（最多4张，JPG、PNG）'}</span>
                  </div>
                </div>
              </FormItem>

              <label className="flex items-center gap-2 text-caption text-stripe-label cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableIntel}
                  onChange={(e) => setEnableIntel(e.target.checked)}
                  className="accent-stripe-purple w-4 h-4"
                />
                启用实时情报检索
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
            </article>
          )}
        </div>

        {result && !streaming && (
          <div className="px-6 py-3 border-t border-stripe-border bg-stripe-border/20 flex items-center justify-between text-caption text-stripe-body">
            <span>分析完成 · 可在左侧情报面板交叉验证来源</span>
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
                    {(() => {
                      const parsedIntel = (() => {
                        if (!q.intel) return null
                        if (typeof q.intel === 'string') {
                          try { return JSON.parse(q.intel) } catch { return null }
                        }
                        return q.intel
                      })()
                      const historyIntelEnabled = parsedIntel && q.intelEnabled !== 'false' && q.intelEnabled !== false
                      return historyIntelEnabled && parsedIntel ? <IntelPanel intel={parsedIntel} /> : null
                    })()}
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
  const [showKey, setShowKey] = useState(false)

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

  const save = async () => {
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
            {(() => {
              const DEFAULT_MODELS = ['claude-sonnet-4-6','gemini-3.1-pro-preview-vertex','gemini-3-pro-preview-thinking','gpt-5.4']
              const cur = form.modelName || ''
              const customModels = (form._customModels || []).filter(m => !DEFAULT_MODELS.includes(m))
              const allModels = [...DEFAULT_MODELS, ...customModels]
              const isAdding = form._addingModel
              return (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {isAdding ? (
                    <input
                      autoFocus
                      placeholder="输入模型名称，回车确认"
                      style={{ ...inputStyle, fontFamily: "'DM Mono',monospace", fontSize: 12.5, flex: 1 }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && e.target.value.trim()) {
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
                      <select value={cur} onChange={e => setForm({ ...form, modelName: e.target.value })}
                        style={{ ...inputStyle, fontFamily: "'DM Mono',monospace", fontSize: 12.5, cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M6 9l6 6 6-6' stroke='%239c8a72' strokeWidth='2' strokeLinecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32, flex: 1 }}>
                        {!allModels.includes(cur) && cur && <option value={cur}>{cur}</option>}
                        {allModels.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <button
                        onClick={() => setForm({ ...form, _addingModel: true })}
                        style={{ width: 32, height: 32, borderRadius: T.radiusMd, border: `1px solid ${T.border}`, background: T.bgElevated, color: T.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1, flexShrink: 0 }}
                        title="添加自定义模型"
                      >+</button>
                    </>
                  )}
                </div>
              )
            })()}
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

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, color: T.textSecondary }}>SerpAPI Key(仅管理员)</label>
              <input
                type="password"
                value={form.serpApiKey || ''}
                onChange={e => setForm({ ...form, serpApiKey: e.target.value })}
                placeholder="sk-serp-..."
                style={{ width: '100%', padding: 8, marginTop: 4 }}
              />
              {serpUsage && (
                <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 4 }}>
                  本月已调用 {serpUsage.count} 次 ({serpUsage.month})
                </div>
              )}
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, color: T.textSecondary }}>结构化抽取模型</label>
              <input
                value={form.extractionModel || ''}
                onChange={e => setForm({ ...form, extractionModel: e.target.value })}
                placeholder="gemini-2.5-flash"
                style={{ width: '100%', padding: 8, marginTop: 4 }}
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, color: T.textSecondary }}>抽取 Prompt</label>
              <textarea
                value={form.extractionPrompt || ''}
                onChange={e => setForm({ ...form, extractionPrompt: e.target.value })}
                rows={6}
                style={{ width: '100%', padding: 8, marginTop: 4, fontFamily: T.fontMono }}
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, color: T.textSecondary }}>降级 System Prompt(用户关闭检索或情报失败时使用)</label>
              <textarea
                value={form.fallbackSystemPrompt || ''}
                onChange={e => setForm({ ...form, fallbackSystemPrompt: e.target.value })}
                rows={6}
                style={{ width: '100%', padding: 8, marginTop: 4, fontFamily: T.fontMono }}
              />
            </div>
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

  return <Layout user={user} onLogout={logout} page={page} setPage={setPage} serpUsage={null}>{content}</Layout>
}

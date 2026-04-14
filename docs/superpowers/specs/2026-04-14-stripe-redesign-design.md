# Stripe 风格前端重构 — 设计文档

**日期:** 2026-04-14
**状态:** 设计已确认,待实施
**影响范围:** `src/app/page.js`、`src/app/layout.js`、`src/app/globals.css`、新增 `tailwind.config.js` / `postcss.config.js`、新增依赖(tailwind、geist)

## 1. 目标

把 `trade-check` 的前端从"内联样式 + 主题对象 `T`"的内部工具形态,彻底重构为 Stripe 设计语言驱动的生产级界面,同时引入 Tailwind CSS + Geist 字体作为设计系统底座。

**要兑现的价值**:
- **品牌感跃迁**:用户从"又一个 GPT 包装工具"直接升级到"像 Stripe Dashboard 一样的专业工具"
- **UX 核心价值兑现**:让情报面板和 AI 报告同屏可见,用户读结论时能立刻点原始链接交叉验证(§5 的两栏分裂)
- **设计系统化**:所有颜色/字体/阴影/间距/圆角都 token 化,未来改一次 config 就能全站生效

**参考**:`DESIGN.md`(仓库根目录,通过 `npx getdesign add stripe` 安装的完整 Stripe 设计规范,322 行)

## 2. 六大设计决定(brainstorming 阶段锁定)

| # | 决定 | 值 |
|---|---|---|
| 1 | 重构规模 | 彻底重构(全部 11 个组件 + `T` 对象删除) |
| 2 | 字体 | Geist Sans + Geist Mono(替代 Stripe 专有的 sohne-var) |
| 3 | 配色模式 | 仅浅色 + 局部深色品牌区块(不做完整 dark mode) |
| 4 | 应用骨架 | 左侧栏 Sidebar(240px 固定)+ 右侧主内容 |
| 5 | 分析页布局 | 两栏分裂(左 420px 输入+情报 sticky,右 flex AI 报告) |
| 6 | 登录页 | Stripe 式左右分裂(左 50% 深蓝品牌区 + 右 50% 浅色表单) |

## 3. 技术路线:Tailwind CSS

### 新增依赖
```bash
npm i -D tailwindcss postcss autoprefixer
npm i geist
npx tailwindcss init -p
```

### `tailwind.config.js` — 设计 token

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        stripe: {
          purple:      '#533afd',
          purpleHover: '#4434d4',
          purpleDeep:  '#2e2b8c',
          purpleLight: '#b9b9f9',
          purpleSoft:  '#d6d9fc',
          navy:        '#061b31',
          navyDeep:    '#0d253d',
          brandDark:   '#1c1e54',
          label:       '#273951',
          body:        '#64748d',
          border:      '#e5edf5',
          ruby:        '#ea2261',
          magenta:     '#f96bee',
          magentaLight:'#ffd7ef',
          success:     '#15be53',
          successText: '#108c3d',
          lemon:       '#9b6829',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      boxShadow: {
        'stripe-ambient':  '0 3px 6px rgba(23,23,23,0.06)',
        'stripe-card':     '0 15px 35px rgba(23,23,23,0.08)',
        'stripe-elevated': '0 30px 45px -30px rgba(50,50,93,0.25), 0 18px 36px -18px rgba(0,0,0,0.1)',
        'stripe-deep':     '0 14px 21px -14px rgba(3,3,39,0.25), 0 8px 17px -8px rgba(0,0,0,0.1)',
      },
      borderRadius: {
        'stripe-sm': '4px',
        'stripe':    '6px',
        'stripe-lg': '8px',
      },
      fontSize: {
        'display':    ['56px', { lineHeight: '1.03', letterSpacing: '-1.4px',  fontWeight: '300' }],
        'display-lg': ['48px', { lineHeight: '1.15', letterSpacing: '-0.96px', fontWeight: '300' }],
        'heading':    ['32px', { lineHeight: '1.10', letterSpacing: '-0.64px', fontWeight: '300' }],
        'subheading': ['22px', { lineHeight: '1.10', letterSpacing: '-0.22px', fontWeight: '300' }],
        'body-lg':    ['18px', { lineHeight: '1.40', letterSpacing: '0',       fontWeight: '300' }],
        'body':       ['16px', { lineHeight: '1.40', letterSpacing: '0',       fontWeight: '300' }],
        'btn':        ['16px', { lineHeight: '1.00', letterSpacing: '0',       fontWeight: '400' }],
        'link':       ['14px', { lineHeight: '1.00', letterSpacing: '0',       fontWeight: '400' }],
        'caption':    ['13px', { lineHeight: '1.40', letterSpacing: '0',       fontWeight: '400' }],
        'caption-sm': ['12px', { lineHeight: '1.33', letterSpacing: '0',       fontWeight: '400' }],
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-4px)' },
          '40%, 80%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        shake: 'shake 0.3s ease-in-out',
      },
    },
  },
  plugins: [],
}
```

### `globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html, body {
    @apply antialiased;
  }
}
```

### `layout.js`(Geist 字体接入)

```js
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans text-stripe-navy bg-white">{children}</body>
    </html>
  )
}
```

### `T` 主题对象的命运
**完全删除**。所有引用迁移到 Tailwind 类或直接内联值。

## 4. 语义 Token 映射

### 颜色 · 角色对照

| UI 角色 | Token | 说明 |
|---|---|---|
| 页面背景 | `bg-white` | 所有页 |
| 深色品牌区块 | `bg-stripe-brandDark` | 登录页左半屏、管理员徽章 |
| 一级标题 | `text-stripe-navy` | 页面 H1、侧栏 logo |
| 表单 label | `text-stripe-label` | FormItem label、小标题 |
| 正文 | `text-stripe-body` | 描述、次要文本 |
| CTA 主色 | `bg-stripe-purple` / `text-stripe-purple` | 所有主按钮、链接、选中态 |
| CTA hover | `hover:bg-stripe-purpleHover` | |
| Ghost 按钮边 | `border-stripe-purpleLight` | |
| 边框 / 分隔 | `border-stripe-border` | 所有 Card、Input、Table |
| focus 环 | `focus:ring-2 ring-stripe-purple/20 focus:border-stripe-purple` | |
| 风险=低 | `bg-stripe-success/15 text-stripe-successText border-stripe-success/40` | |
| 风险=中 | `bg-stripe-lemon/15 text-stripe-lemon border-stripe-lemon/40` | |
| 风险=高 | `bg-stripe-ruby/15 text-stripe-ruby border-stripe-ruby/40` | |
| 情报卡 ok | `border-stripe-border` + 绿点 | |
| 情报卡 failed | `border-stripe-ruby/40` + 红点 | |
| 情报卡 skipped | `border-stripe-border` + 灰点 | |
| 情报卡 加载 | `animate-pulse` 边框 + 无状态点 | |
| intelError 警告条 | `bg-[#fff8c5] border-[#d4a72c]/50 text-stripe-lemon` | |

### 字体 · 角色对照

| 角色 | 类 | 说明 |
|---|---|---|
| 登录大标题 | `text-display font-light` | 56px/weight 300/-1.4px |
| 页面 H1 | `text-display-lg font-light` | 48px |
| 卡片/面板标题 | `text-heading font-light` | 32px |
| 子标题 | `text-subheading font-light` | 22px |
| 正文大号 | `text-body-lg font-light` | 18px(登录副标) |
| 正文默认 | `text-body font-light` | 16px |
| 按钮文字 | `text-btn font-normal` | 16px weight 400 |
| 导航链接 | `text-link font-normal` | 14px |
| 小标签 | `text-caption font-normal` | 13px |
| 监控数字 | `font-mono text-caption-sm` | SerpAPI 计数、邮箱 |

### 阴影 · 层级

| 层级 | Token | 用途 |
|---|---|---|
| 0 | 无 | 页面背景 |
| 1 | `shadow-stripe-ambient` | 默认卡片 |
| 2 | `shadow-stripe-card` | AI 报告容器、设置卡片 |
| 3 | `shadow-stripe-elevated` | 下拉菜单、用户菜单 |
| 4 | `shadow-stripe-deep` | Modal、弹出层 |

### 圆角 · 语义

| 元素 | Token |
|---|---|
| 按钮/input/徽章 | `rounded-stripe-sm` (4px) |
| 卡片/面板 | `rounded-stripe` (6px) |
| 登录卡/Hero | `rounded-stripe-lg` (8px) |
| 头像 | `rounded-full`(唯一允许) |

## 5. 布局骨架(Sidebar + Main)

### 桌面(≥ 1024px)

```
┌───────────┬─────────────────────────────┐
│ Sidebar   │ Main                        │
│ w-60      │ flex-1                      │
│ border-r  │   PageHeader (sticky h-16)  │
│           │   Content (overflow-y-auto) │
└───────────┴─────────────────────────────┘
```

### Sidebar 结构

```jsx
<aside className="w-60 shrink-0 border-r border-stripe-border bg-white flex flex-col lg:static fixed inset-y-0 left-0 z-40 transition-transform">
  {/* Logo 80px */}
  <div className="h-20 px-6 flex items-center">
    <Logo /> <span className="ml-3 text-link font-normal text-stripe-navy">trade-check</span>
  </div>

  {/* Nav flex-1 */}
  <nav className="flex-1 px-3 py-2 space-y-1">
    <NavItem icon={<SearchIcon/>} label="分析" active={page==='query'} onClick={() => setPage('query')} />
    <NavItem icon={<ClockIcon/>} label="历史" active={page==='history'} />
    <NavItem icon={<GearIcon/>} label="设置" active={page==='settings'} />
  </nav>

  {/* SerpAPI usage (admin only) */}
  {user.role === 'admin' && <SerpUsageCard usage={serpUsage} />}

  {/* User menu 64px */}
  <div className="border-t border-stripe-border p-3">
    <UserMenu user={user} onLogout={onLogout} />
  </div>
</aside>
```

### NavItem 组件

```jsx
function NavItem({ icon, label, active, onClick, adminBadge }) {
  return (
    <button onClick={onClick} className={`
      w-full h-9 px-3 rounded-stripe-sm flex items-center gap-3 text-link font-normal transition-colors
      ${active
        ? 'bg-stripe-purpleLight/30 text-stripe-purple'
        : 'text-stripe-label hover:bg-stripe-purpleLight/20 hover:text-stripe-navy'}
    `}>
      <span className={active ? 'text-stripe-purple' : 'text-stripe-body'}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {adminBadge && <span className="text-[10px] bg-stripe-brandDark text-white px-1.5 py-0.5 rounded">ADMIN</span>}
    </button>
  )
}
```

### Main 结构

```jsx
<main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden lg:pt-0 pt-14">
  <PageHeader page={page} riskBadge={streaming ? score : null} />
  <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
    {children}
  </div>
</main>
```

### PageHeader

```jsx
function PageHeader({ page, riskBadge }) {
  const titles = { query: '分析', history: '历史', settings: '设置' }
  return (
    <div className="sticky top-0 bg-white border-b border-stripe-border z-10 h-16 px-8 flex items-center justify-between">
      <h2 className="text-subheading font-light text-stripe-navy">{titles[page]}</h2>
      <div className="flex items-center gap-3">
        {riskBadge && <ScoreBadge score={riskBadge} size="sm" />}
      </div>
    </div>
  )
}
```

### 响应式

| 断点 | Sidebar | Main |
|---|---|---|
| ≥1024 | 可见 240px | `px-8` |
| 640-1023 | 塌成 hamburger + overlay | `px-6` |
| <640 | 同上,覆盖层宽 288px | `px-4`,header `h-14` |

## 6. 登录页(Stripe 左右分裂)

见 §6 §4 原文(上文已完整列出 JSX 骨架,不再重复)。关键要点:

- 左半屏 `bg-stripe-brandDark` 50% 宽,logo + display 大标题 + body-lg 副标 + 装饰渐变圆环
- 右半屏 50% 白色,`max-w-sm` 表单卡片(无阴影),紫色 CTA
- 主标题文案:`外贸背调 / 证据驱动的风险分析`
- 副标题文案:`LinkedIn · Panjiva · 建站时间 · 公司网站 · 负面舆情 —— 所有判断都可追溯到原始来源`
- 装饰:右下角 `bg-gradient-to-br from-stripe-ruby to-stripe-magenta blur-3xl` 径向渐变
- 错误态:shake 动画 + ruby 红色文字
- 移动端:左半屏塌成 180px 顶部 mini hero

## 7. 分析页(QueryPage · 两栏分裂)

### 桌面布局

```
Main > Content:
  flex gap-6 pb-8
  ├─ LEFT  w-full lg:w-[420px] lg:shrink-0 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto space-y-4 pr-2
  │   ├─ InputCard (展开/收起两态)
  │   └─ IntelPanel (bg-white border rounded-stripe)
  │       ├─ Header (title + duration)
  │       ├─ Entity bar (recognized entities,bg-purpleLight/15)
  │       └─ 6 IntelCards in grid-cols-2 gap-3
  │
  └─ RIGHT flex-1 min-w-0 bg-white border rounded-stripe shadow-stripe-card flex flex-col
      ├─ Header sticky (title + spinner + ScoreBadge)
      ├─ IntelWarning banner (if intelWarning)
      ├─ Streaming markdown (flex-1 overflow-y-auto px-6 py-6)
      │   ├─ EmptyState (if !result && !streaming)
      │   └─ <article class="prose-stripe"><MarkdownRenderer /></article>
      └─ Footer (if result && !streaming)
```

### InputCard 展开态(完整)

```jsx
<div className="bg-white border border-stripe-border rounded-stripe shadow-stripe-ambient overflow-hidden">
  <div className="px-5 py-4 border-b border-stripe-border flex items-center justify-between">
    <h3 className="text-subheading font-light text-stripe-navy">背调输入</h3>
    <button onClick={() => setCollapsed(true)} className="text-caption text-stripe-body hover:text-stripe-purple">
      收起
    </button>
  </div>
  <div className="px-5 py-5 space-y-5">
    <FormItem label="公司网址" hint="支持无 http:// 前缀">
      <textarea
        value={url}
        onChange={e => setUrl(e.target.value)}
        rows={2}
        className="w-full px-3 py-2 text-body font-light border border-stripe-border rounded-stripe-sm resize-none focus:outline-none focus:border-stripe-purple focus:ring-2 focus:ring-stripe-purple/20 transition"
      />
    </FormItem>
    <FormItem label="询盘内容" hint="可贴原始邮件正文">
      <textarea
        value={inquiry}
        onChange={e => setInquiry(e.target.value)}
        rows={5}
        className="w-full px-3 py-2 text-body font-light border border-stripe-border rounded-stripe-sm resize-none focus:outline-none focus:border-stripe-purple focus:ring-2 focus:ring-stripe-purple/20 transition"
      />
    </FormItem>
    <FormItem label="附加图片(可选)" hint="拖拽或点击 · 最多 4 张">
      <ImageDropzone images={images} onChange={setImages} />
    </FormItem>
    <label className="flex items-center gap-2 text-caption text-stripe-label cursor-pointer select-none">
      <input
        type="checkbox"
        checked={enableIntel}
        onChange={e => setEnableIntel(e.target.checked)}
        className="accent-stripe-purple w-4 h-4"
      />
      启用实时情报检索
    </label>
  </div>
  <div className="px-5 py-4 bg-stripe-border/30 border-t border-stripe-border">
    <button
      type="submit"
      disabled={loading}
      className="w-full h-11 bg-stripe-purple hover:bg-stripe-purpleHover text-white text-btn rounded-stripe-sm disabled:opacity-50 transition-colors flex items-center justify-center"
    >
      {loading ? <Spinner color="#fff" size={16} /> : '开始分析'}
    </button>
  </div>
</div>
```

### InputCard 收起态

```jsx
<button
  onClick={() => setCollapsed(false)}
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
```

### IntelCard 紧凑版

```jsx
function IntelCard({ title, section, children }) {
  const status = section?.status
  const dotColor =
    status === 'ok'      ? 'bg-stripe-success' :
    status === 'failed'  ? 'bg-stripe-ruby' :
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
```

### IntelPanel 容器

```jsx
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
          {e.companyName && <div><b className="text-stripe-navy font-normal">公司:</b> {e.companyName}</div>}
          {e.personName && <div><b className="text-stripe-navy font-normal">联系人:</b> {e.personName}{e.personTitle && ` · ${e.personTitle}`}</div>}
          {e.email && <div><b className="text-stripe-navy font-normal">邮箱:</b> <span className="font-mono">{e.email}</span></div>}
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
              <a href={r.link} target="_blank" rel="noreferrer" className="text-stripe-purple hover:text-stripe-purpleHover underline decoration-stripe-purpleLight underline-offset-2">
                {r.title}
              </a>
            </div>
          ))}
        </IntelCard>
        <IntelCard title="Facebook" section={intel.facebook}>
          {intel.facebook?.status === 'ok'
            ? intel.facebook.found ? `找到 ${intel.facebook.topResults.length} 条` : '未找到'
            : intel.facebook?.error || '—'}
        </IntelCard>
        <IntelCard title="Panjiva 海关" section={intel.panjiva}>
          {intel.panjiva?.status === 'ok'
            ? intel.panjiva.hasRecord ? `搜到 ${intel.panjiva.resultCount} 条` : '未发现'
            : intel.panjiva?.error || '—'}
        </IntelCard>
        <IntelCard title="负面搜索" section={intel.negative}>
          {intel.negative?.status === 'ok'
            ? intel.negative.hitCount > 0 ? `⚠️ ${intel.negative.hitCount} 条` : '未发现'
            : intel.negative?.error || '—'}
          {intel.negative?.hits?.slice(0, 2).map((r, i) => (
            <div key={i} className="mt-1">
              <a href={r.link} target="_blank" rel="noreferrer" className="text-stripe-ruby hover:underline">
                {r.title}
              </a>
            </div>
          ))}
        </IntelCard>
      </div>
    </div>
  )
}
```

### AI 报告容器

```jsx
<div className="flex-1 min-w-0 bg-white border border-stripe-border rounded-stripe shadow-stripe-card flex flex-col max-h-[calc(100vh-7rem)]">
  <div className="px-6 py-4 border-b border-stripe-border flex items-center justify-between sticky top-0 bg-white rounded-t-stripe">
    <h3 className="text-subheading font-light text-stripe-navy">风险分析报告</h3>
    <div className="flex items-center gap-3">
      {streaming && <Spinner size={14} color="#533afd" />}
      {score && <ScoreBadge score={score} size="sm" />}
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
      <article className="prose-stripe max-w-none">
        <MarkdownRenderer content={result} />
      </article>
    )}
  </div>

  {result && !streaming && (
    <div className="px-6 py-3 border-t border-stripe-border bg-stripe-border/20 flex items-center justify-between text-caption text-stripe-body">
      <span>分析完成 · 可在左侧情报面板交叉验证来源</span>
      <button className="text-stripe-purple hover:text-stripe-purpleHover font-normal" onClick={() => navigator.clipboard.writeText(result)}>
        复制报告
      </button>
    </div>
  )}
</div>
```

### MarkdownRenderer Stripe 化

保留现有的 `MarkdownRenderer` 和 `renderInline` 的解析逻辑,**只替换输出元素的 className**:

| MD 元素 | Tailwind class |
|---|---|
| `# h1` | `text-heading font-light text-stripe-navy mt-8 first:mt-0 mb-4` |
| `## h2` | `text-subheading font-light text-stripe-navy mt-6 mb-3` |
| `### h3` | `text-body-lg font-normal text-stripe-label mt-5 mb-2` |
| `p` | `text-body font-light text-stripe-navy leading-relaxed mb-4` |
| `ul` | `list-disc ml-6 space-y-1.5 mb-4 marker:text-stripe-purple` |
| `ol` | `list-decimal ml-6 space-y-1.5 mb-4 marker:text-stripe-purple` |
| `li` | `text-body font-light text-stripe-navy` |
| `strong` | `font-normal text-stripe-navy` |
| `em` | `italic` |
| `code` (inline) | `font-mono text-caption-sm px-1.5 py-0.5 bg-stripe-border/50 rounded-stripe-sm text-stripe-navyDeep` |
| `pre` | `font-mono text-caption-sm bg-stripe-navyDeep text-white p-4 rounded-stripe mb-4 overflow-x-auto` |
| `blockquote` | `border-l-2 border-stripe-purple pl-4 py-1 my-4 text-stripe-body italic` |
| `a` | `text-stripe-purple hover:text-stripe-purpleHover underline decoration-stripe-purpleLight underline-offset-2` |
| `hr` | `border-stripe-border my-6` |
| `table` | `w-full my-4 text-caption border-collapse` |
| `th` | `border-b border-stripe-border font-normal text-stripe-label text-left py-2 px-3` |
| `td` | `border-b border-stripe-border/50 py-2 px-3 text-stripe-body` |

### 响应式

< 1024px 布局塌成单列 stack:InputCard → IntelPanel → AI 报告。左列的 sticky 失效,内容自然滚动。

## 8. 历史页(HistoryPage)

### 布局

```
Content:
  flex gap-6
  ├─ LEFT  w-full lg:w-[380px] lg:shrink-0 space-y-2
  │   ├─ Search bar (input with icon)
  │   └─ List of history cards (cursor-pointer, active state)
  │
  └─ RIGHT flex-1 min-w-0
      ├─ (empty state if no selection)
      └─ (selected: IntelPanel + MarkdownRenderer result)
```

### 历史条目卡片

```jsx
function HistoryCard({ query, active, onClick }) {
  const score = extractScore(query.result)
  const hasIntel = query.intelEnabled === 'true' || query.intelEnabled === true
  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-stripe border text-left transition-colors ${
        active
          ? 'bg-stripe-purpleLight/20 border-stripe-purple'
          : 'bg-white border-stripe-border hover:border-stripe-purpleLight'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-caption font-mono text-stripe-label truncate flex-1">
          {query.url || '(无URL)'}
        </span>
        {score && <ScoreBadge score={score} size="sm" />}
      </div>
      <div className="flex items-center justify-between text-caption-sm text-stripe-body">
        <span>{formatRelativeTime(query.createdAt)}</span>
        {hasIntel && <span className="text-stripe-purple">🔍 含情报</span>}
      </div>
    </button>
  )
}
```

### 右列详情

复用 §7 的 `IntelPanel` 组件 + Stripe 化的 `MarkdownRenderer`。结构:

```jsx
{selected ? (
  <div className="space-y-4">
    <div className="bg-white border border-stripe-border rounded-stripe p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-caption-sm text-stripe-body">{new Date(selected.createdAt).toLocaleString('zh-CN')}</span>
        <ScoreBadge score={extractScore(selected.result)} />
      </div>
      <div className="text-caption font-mono text-stripe-label break-all">{selected.url}</div>
      {selected.inquiry && (
        <div className="mt-3 text-caption text-stripe-body line-clamp-2">{selected.inquiry}</div>
      )}
    </div>

    {parsedIntel && hasIntel && <IntelPanel intel={parsedIntel} />}

    <div className="bg-white border border-stripe-border rounded-stripe shadow-stripe-card p-6">
      <article className="prose-stripe max-w-none">
        <MarkdownRenderer content={selected.result} />
      </article>
    </div>
  </div>
) : (
  <EmptyState
    icon={<ClockIcon size={20} />}
    title="选择一条历史记录"
    description="左侧列表中点击任意条目查看完整分析"
  />
)}
```

### 搜索栏

```jsx
<div className="relative mb-2">
  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stripe-body" />
  <input
    value={search}
    onChange={e => setSearch(e.target.value)}
    placeholder="搜索 URL 或询盘内容..."
    className="w-full h-10 pl-10 pr-3 text-body font-light bg-white border border-stripe-border rounded-stripe-sm focus:outline-none focus:border-stripe-purple focus:ring-2 focus:ring-stripe-purple/20 transition"
  />
</div>
```

## 9. 设置页(SettingsPage)

### 布局

```
Content:
  max-w-[680px] mx-auto space-y-6 pb-24  (pb-24 给底部固定保存条留位)
  ├─ Card "模型配置"
  ├─ Card "实时情报" (admin only)
  ├─ Card "Prompt 模板" (admin only)
  └─ Sticky footer bar (保存)
```

### 设置卡片通用模板

```jsx
function SettingsCard({ title, description, adminOnly, children }) {
  return (
    <div className="bg-white border border-stripe-border rounded-stripe shadow-stripe-ambient overflow-hidden">
      <div className="px-6 py-5 border-b border-stripe-border flex items-start justify-between">
        <div>
          <h3 className="text-subheading font-light text-stripe-navy">{title}</h3>
          {description && (
            <p className="mt-1 text-caption text-stripe-body">{description}</p>
          )}
        </div>
        {adminOnly && (
          <span className="text-[10px] bg-stripe-brandDark text-white px-2 py-1 rounded-stripe-sm">ADMIN</span>
        )}
      </div>
      <div className="px-6 py-5 space-y-5">
        {children}
      </div>
    </div>
  )
}
```

### 模型配置卡片(所有用户)

```jsx
<SettingsCard title="模型配置" description="API 接入与主分析模型">
  {user.role === 'admin' && (
    <FormItem label="Base URL" hint="OpenAI 兼容端点">
      <input className={inputCls} value={form.baseUrl} onChange={...} />
    </FormItem>
  )}
  <FormItem label="API Key" hint="你的个人密钥,不与他人共享">
    <PasswordInput value={form.apiKey} onChange={...} />
  </FormItem>
  <FormItem label="主分析模型" hint="例:gemini-3.1-pro-preview-vertex">
    <ModelNameInput value={form.modelName} onChange={...} />
  </FormItem>
</SettingsCard>
```

### 实时情报卡片(admin only)

```jsx
{user.role === 'admin' && (
  <SettingsCard title="实时情报" description="SerpAPI 密钥与结构化抽取配置" adminOnly>
    <FormItem label="SerpAPI Key">
      <PasswordInput value={form.serpApiKey} onChange={...} />
      {serpUsage && (
        <div className="mt-2 text-caption-sm text-stripe-body font-mono">
          本月已调用 <span className="text-stripe-purple font-normal">{serpUsage.count}</span> 次 ({serpUsage.month})
        </div>
      )}
    </FormItem>
    <FormItem label="结构化抽取模型" hint="用便宜快速模型,如 gemini-2.5-flash">
      <input className={inputCls} value={form.extractionModel} onChange={...} />
    </FormItem>
    <FormItem label="抽取 Prompt">
      <textarea
        className={`${textareaCls} font-mono text-caption-sm`}
        rows={8}
        value={form.extractionPrompt}
        onChange={...}
      />
    </FormItem>
  </SettingsCard>
)}
```

### Prompt 模板卡片(admin only)

```jsx
{user.role === 'admin' && (
  <SettingsCard title="Prompt 模板" description="主分析与降级模板" adminOnly>
    <FormItem label="主 System Prompt(启用情报时使用)" hint="强制绑定情报简报的证据驱动模板">
      <textarea className={`${textareaCls} font-mono text-caption-sm`} rows={12} value={form.systemPrompt} onChange={...} />
    </FormItem>
    <FormItem label="Fallback System Prompt(关闭情报或情报失败时使用)" hint="传统 5 维度模板">
      <textarea className={`${textareaCls} font-mono text-caption-sm`} rows={8} value={form.fallbackSystemPrompt} onChange={...} />
    </FormItem>
  </SettingsCard>
)}
```

### 底部保存条

```jsx
<div className="fixed bottom-0 left-60 right-0 bg-white/95 backdrop-blur border-t border-stripe-border py-4 px-8 flex items-center justify-end gap-3 z-20">
  {saved && <span className="text-caption text-stripe-successText">✓ 已保存</span>}
  <button
    type="button"
    onClick={handleReset}
    className="h-10 px-4 text-btn text-stripe-purple border border-stripe-purpleLight hover:bg-stripe-purpleLight/10 rounded-stripe-sm transition-colors"
  >
    撤销
  </button>
  <button
    type="submit"
    disabled={saving}
    className="h-10 px-6 text-btn text-white bg-stripe-purple hover:bg-stripe-purpleHover rounded-stripe-sm disabled:opacity-50 transition-colors flex items-center gap-2"
  >
    {saving && <Spinner size={14} color="#fff" />}
    保存更改
  </button>
</div>
```

(移动端 sticky 条的 `left-60` 要改成 `left-0`,走媒体查询)

## 10. 新增组件清单

| 组件 | 位置 | 说明 |
|---|---|---|
| `EmptyState` | `src/app/page.js` | 空状态通用组件 |
| `NavItem` | `src/app/page.js` | 侧栏菜单项 |
| `SettingsCard` | `src/app/page.js` | 设置页分组卡片 |
| `HistoryCard` | `src/app/page.js` | 历史列表卡片 |
| `SerpUsageCard` | `src/app/page.js` | 侧栏底部 admin 用量卡 |
| `UserMenu` | `src/app/page.js` | 侧栏底部用户菜单 |
| `Logo` | `src/app/page.js` | 可切换 light/dark 变体 |
| `PasswordInput` | `src/app/page.js` | 带"显示/隐藏"切换 |
| `ModelNameInput` | `src/app/page.js` | 带自定义 + 快捷按钮(当前已有,样式重写) |
| `ImageDropzone` | `src/app/page.js` | 图片上传拖拽区(当前零散,抽成组件) |

## 11. 删除清单

| 要删的东西 | 原因 |
|---|---|
| 主题对象 `const T = { ... }` | Tailwind token 完全替代 |
| `FormItem` 内部的 `style={...}` | 全部改成 className |
| 所有 `style={{ ... }}` inline 样式(除了少量动态值) | 改成 Tailwind 类 |
| 任何依赖 `T.*` 的颜色引用 | 迁移到 `stripe-*` token |

## 12. 实施顺序建议

1. 安装依赖 + 配置 Tailwind + 接入 Geist + 重写 `layout.js` / `globals.css`
2. 定义 `tailwind.config.js` 完整 Stripe token
3. 重写 `Layout` 组件骨架(Sidebar + Main + PageHeader)—— 这一步会让页面暂时错位,先保证导航能走通
4. 重写 `LoginPage`(独立,不影响其他页)
5. 重写 `QueryPage`:先做整体 flex 布局 + InputCard + 情报面板,最后做 AI 报告容器 + MarkdownRenderer Stripe 化
6. 重写 `HistoryPage`
7. 重写 `SettingsPage` + 新 `SettingsCard` / `PasswordInput` 组件
8. 删除 `T` 对象 + 清理所有 `style={...}` 残留
9. 跑 `npm run build` 确保零错误
10. 移动端测试(三个断点)

## 13. 测试策略

- **视觉回归**:手动对照 `DESIGN.md` 的色板、字体、阴影逐项检查
- **交互测试**:登录 → 分析(含情报开关)→ 历史 → 设置的完整流程,每步确认视觉符合预期
- **响应式**:Chrome DevTools 分别模拟 1440 / 1024 / 768 / 375 四个宽度,验证 Sidebar 折叠、Login 左右塌成上下、QueryPage 两栏塌成单列
- **情报功能回归**:确认现有情报流式 SSE + 历史回放功能在新 UI 下依然正常(所有业务逻辑零改动)

## 14. 风险与回退

- **Geist 字体加载失败**:`font-sans` fallback 链 `system-ui, sans-serif`,视觉打折但不破相
- **Tailwind build 体积**:JIT 按需编译,production 产物 ~20-30KB CSS,可接受
- **现有业务逻辑破坏**:本次只改视觉和 JSX className,**业务 state / SSE 处理 / API 调用零改动**——如果发现任何业务 bug,说明迁移时误删了 state 或 handler,回滚该次提交即可
- **回退预案**:每个页面一个独立 commit,任何一页回退只需 `git revert <sha>`

## 15. 开放问题

无。六大设计决定均已锁定。所有组件的视觉规格(颜色、字体、阴影、圆角、间距)均可从 §4 token 映射推导。

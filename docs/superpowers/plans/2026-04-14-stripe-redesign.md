# Stripe 风格前端重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `trade-check` 的前端完全重写为 Stripe 设计系统驱动的 Tailwind + Geist 架构,保持所有业务逻辑零改动,视觉和交互质量达到 Stripe Dashboard 级别。

**Architecture:** 删除现有 `T` 主题对象和所有内联样式;引入 Tailwind + Geist + 完整 Stripe token 化 `tailwind.config.js`;重写 `page.js` 所有 11 个组件使用 Tailwind className;新增 sidebar shell layout、分离式登录页、两栏分裂分析页。业务逻辑(SSE、state、API 调用)严格不动。

**Tech Stack:** Next.js 14 App Router · React 18 · Tailwind CSS 3 · Geist font · 无 CSS-in-JS 库 · 无组件库

**Spec reference:** `docs/superpowers/specs/2026-04-14-stripe-redesign-design.md`

---

## Conventions

- 本计划不引入新的单元测试(视觉层不适合 vitest)。每个任务的验证步骤是 `npm run build` 成功 + 浏览器打开 `/` 手动 smoke check 关键页面。
- 所有 Tailwind 类使用 spec §3 `tailwind.config.js` 定义的 `stripe-*` token,不直接写 `#533afd` 之类硬编码(除非 spec 的"任意值语法"注明的情况)。
- 每个任务的 commit 都独立可回滚。不跨任务混提交。
- JSX 结构改动必须保留所有现有 state hooks、handlers、refs 的名字和签名——只改 className 和 children。
- `onClick`、`onChange`、`onSubmit` 等 handler 一律不动(除非任务显式要求)。
- SSE 流处理(`/api/analyze` 的 reader 循环)一律不动。
- 每个任务结束前运行 `npm run build`,必须无错。

---

## File Map

**新增:**
- `tailwind.config.js`
- `postcss.config.js`
- `src/app/page.js` 内新增组件(不创建新文件):`NavItem`, `SettingsCard`, `HistoryCard`, `SerpUsageCard`, `UserMenu`, `Logo`, `PasswordInput`, `EmptyState`, `ImageDropzone`

**修改:**
- `package.json` — 新增 `tailwindcss`, `postcss`, `autoprefixer` (dev), `geist` (dep)
- `src/app/layout.js` — 引入 Geist 字体 + 重写 className
- `src/app/globals.css` — 改为三行 Tailwind 指令
- `src/app/page.js` — 删除 `T` 对象 + 重写所有 11 个组件

**保持不变(零改动):**
- `lib/auth.js`, `lib/kv.js`, `lib/intel/**`
- `src/app/api/**`
- `jsconfig.json`, `next.config.js`, `Procfile`, `nixpacks.toml`, `vercel.json`

---

## Part 0 — 基础设施

### Task 0.1: 安装依赖并初始化 Tailwind

**Files:**
- Modify: `package.json`
- Create: `postcss.config.js`
- Create: `tailwind.config.js` (覆盖 init 的默认内容)

- [ ] **Step 1: 安装 tailwind 相关 devDependencies**

Run:
```bash
npm i -D tailwindcss@^3.4.0 postcss@^8.4.0 autoprefixer@^10.4.0
```

Expected: 三个包装入 `package.json` devDependencies,无错误。

- [ ] **Step 2: 安装 Geist**

Run:
```bash
npm i geist@^1.3.0
```

Expected: `geist` 装入 `package.json` dependencies。

- [ ] **Step 3: 初始化 Tailwind 配置(会被下个 task 覆盖)**

Run:
```bash
npx tailwindcss init -p
```

Expected: 在仓库根生成 `tailwind.config.js` 和 `postcss.config.js`。

- [ ] **Step 4: 验证构建依然通过**

Run:
```bash
npm run build
```

Expected: 成功(Tailwind 此时还未接入任何 CSS,所以和之前行为一致)。

- [ ] **Step 5: 提交**

```bash
git add package.json package-lock.json tailwind.config.js postcss.config.js
git commit -m "chore: install tailwind + postcss + geist"
```

---

### Task 0.2: 写入 Stripe token 化的 `tailwind.config.js`

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: 覆盖 `tailwind.config.js` 的全部内容**

Replace the entire file with:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        stripe: {
          purple:       '#533afd',
          purpleHover:  '#4434d4',
          purpleDeep:   '#2e2b8c',
          purpleLight:  '#b9b9f9',
          purpleSoft:   '#d6d9fc',
          navy:         '#061b31',
          navyDeep:     '#0d253d',
          brandDark:    '#1c1e54',
          label:        '#273951',
          body:         '#64748d',
          border:       '#e5edf5',
          ruby:         '#ea2261',
          magenta:      '#f96bee',
          magentaLight: '#ffd7ef',
          success:      '#15be53',
          successText:  '#108c3d',
          lemon:        '#9b6829',
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

- [ ] **Step 2: 构建验证(token 化的 config 本身不影响输出)**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 3: 提交**

```bash
git add tailwind.config.js
git commit -m "feat(tw): define Stripe design tokens in tailwind.config"
```

---

### Task 0.3: 改写 `globals.css` 并接入 Geist 字体

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.js`

- [ ] **Step 1: 查看当前 `globals.css` 内容(留个备份参考)**

Run: `cat src/app/globals.css` (只是信息收集,不改动)

- [ ] **Step 2: 覆盖 `src/app/globals.css`**

Replace the entire file with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html,
  body {
    @apply antialiased;
  }
}
```

- [ ] **Step 3: 查看当前 `src/app/layout.js` 结构**

Run: `cat src/app/layout.js`

(Record the current metadata export so it can be preserved in Step 4.)

- [ ] **Step 4: 重写 `src/app/layout.js`**

Replace the entire file with:

```js
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata = {
  title: 'trade-check',
  description: '外贸背调 · 证据驱动的风险分析',
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans text-stripe-navy bg-white">{children}</body>
    </html>
  )
}
```

**注意**:如果 Step 3 读到的 `layout.js` 里有其他重要字段(比如 viewport、favicon 引入),把它们加进 `metadata` 对象。

- [ ] **Step 5: 构建验证**

Run: `npm run build`
Expected: 成功。此时页面的字体应该已经换成 Geist,但由于 `page.js` 仍在用 `T` 对象驱动的老样式,视觉上变化不大——这是正常的。

- [ ] **Step 6: 提交**

```bash
git add src/app/globals.css src/app/layout.js
git commit -m "feat(ui): wire up Tailwind + Geist via layout.js"
```

---

## Part 1 — 脚手架:Layout + Sidebar + PageHeader

这一步改动 `page.js` 里的 `Layout` 组件,引入 sidebar 骨架。之前用的 `T` 主题对象的老组件暂时会跟新 Layout 并存,视觉会有割裂,后续 Part 2-5 会把它们逐个重写。

### Task 1.1: 添加 Logo 与图标组件

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: 读取 `src/app/page.js` 顶部 200 行了解现有 import 与组件声明顺序**

Run: `head -200 src/app/page.js`

- [ ] **Step 2: 在 `const T = { ... }` 定义之前,插入图标 + Logo 组件**

Use Edit to add the following block **immediately before** the `const T = {` line. Make sure the anchor for `old_string` includes the line that defines `const T = {` so the edit is unique.

```js
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
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 005.2 15a1.65 1.65 0 00-1.51-1H3.6a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9.5a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9.5a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
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
```

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 成功。组件已定义但尚未被使用,无视觉变化。

- [ ] **Step 4: 提交**

```bash
git add src/app/page.js
git commit -m "feat(ui): add icon and logo components"
```

---

### Task 1.2: 新增 NavItem + EmptyState 组件

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: 定位 Task 1.1 添加的 `Logo` 函数。在 `function Logo(...)` 的闭合大括号之后,插入以下组件:**

```js
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
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 3: 提交**

```bash
git add src/app/page.js
git commit -m "feat(ui): add NavItem and EmptyState components"
```

---

### Task 1.3: 重写 Layout 组件为 Sidebar 骨架

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: Grep 定位 `function Layout(`**

Run: `grep -n "^function Layout" src/app/page.js`
Expected: 单一匹配,记录行号。

- [ ] **Step 2: 读取 Layout 函数完整内容(从匹配行开始,往下读 80 行)**

Use Read with offset = 匹配行 - 1, limit = 80.

- [ ] **Step 3: 用 Edit 替换整个 Layout 函数为新版本**

`old_string` 应该覆盖从 `function Layout(` 开始到该函数的闭合 `}` 的所有行(可能包含 `return (...)` 里现有的大块 JSX)。`new_string`:

```js
function Layout({ user, onLogout, page, setPage, serpUsage, children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pageTitles = { query: '分析', history: '历史', settings: '设置' }
  const isAdmin = user?.role === 'admin'

  return (
    <div className="h-screen flex bg-white text-stripe-navy">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-white border-b border-stripe-border flex items-center px-4 z-30">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-stripe-sm hover:bg-stripe-purpleLight/20"
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
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          w-60 shrink-0 border-r border-stripe-border bg-white flex flex-col
          lg:static fixed inset-y-0 left-0 z-40 transition-transform
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-20 px-6 flex items-center">
          <Logo />
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          <NavItem
            icon={<SearchIcon />}
            label="分析"
            active={page === 'query'}
            onClick={() => { setPage('query'); setMobileOpen(false) }}
          />
          <NavItem
            icon={<ClockIcon />}
            label="历史"
            active={page === 'history'}
            onClick={() => { setPage('history'); setMobileOpen(false) }}
          />
          <NavItem
            icon={<GearIcon />}
            label="设置"
            active={page === 'settings'}
            onClick={() => { setPage('settings'); setMobileOpen(false) }}
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
            onClick={onLogout}
            className="w-8 h-8 flex items-center justify-center rounded-stripe-sm text-stripe-body hover:bg-stripe-purpleLight/20 hover:text-stripe-purple"
            title="登出"
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
```

- [ ] **Step 4: 找到 Layout 的调用方,确保 `serpUsage` prop 被传入**

Grep: `grep -n "<Layout" src/app/page.js`

如果调用没有传 `serpUsage`,先暂时传 `serpUsage={null}`——具体的 serpUsage 会在 Task 5.1 的设置页改造中正确注入。目标 JSX 示例:

```jsx
<Layout user={user} onLogout={handleLogout} page={page} setPage={setPage} serpUsage={null}>
  {/* children */}
</Layout>
```

- [ ] **Step 5: 构建验证**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 6: 手动 smoke test**

Run: `npm run dev`(后台)
在浏览器打开 `http://localhost:8080`(或 next dev 默认 3000),登录后观察:
- 左侧出现 240px sidebar,logo + 三个菜单项 + 底部用户区
- 切换菜单时,各 Page 组件(现在仍是老样式)显示在右侧
- 老 Page 组件的内部样式还是破的(这是预期的,Part 2-5 会修复)

如果 sidebar 和顶部 header 结构渲染正确即可,各 Page 内部可以暂时难看。

停止 dev server。

- [ ] **Step 7: 提交**

```bash
git add src/app/page.js
git commit -m "feat(ui): rewrite Layout as Stripe sidebar shell"
```

---

## Part 2 — 登录页(LoginPage 独立重写)

### Task 2.1: 重写 LoginPage 为左右分裂

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: Grep 定位 `function LoginPage(`**

Run: `grep -n "^function LoginPage" src/app/page.js`

- [ ] **Step 2: 读取 LoginPage 完整函数 + 之前的 FormItem 引用**

Use Read with offset = 匹配行 - 1, limit = 80.

记下:
- 当前使用了哪些 state hook(email/password/error/loading 等)
- 当前如何调用 `onLogin`
- 当前的 fetch 细节(要保留)

- [ ] **Step 3: 用 Edit 替换整个 LoginPage 函数**

`new_string`:

```js
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
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
```

**注意**:如果 Step 2 读到的老 LoginPage 依赖了与上面不同的 API 端点、请求格式或回调签名,请保持原有的 fetch 细节和 `onLogin` 调用方式,只替换样式和结构。业务逻辑优先。

- [ ] **Step 4: 构建验证**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 5: 手动 smoke test**

Run: `npm run dev`
登出状态访问根 URL,确认:
- 桌面宽度下能看到左深蓝 / 右白色的分裂布局
- 左侧大标题 56px weight-300 显示
- 输入框 focus 时有紫色 ring
- 提交错误账号时红色错误 + shake 动画
- 移动端(DevTools 模拟 375 宽)能看到顶部 180px mini hero
停止 dev。

- [ ] **Step 6: 提交**

```bash
git add src/app/page.js
git commit -m "feat(ui): rewrite LoginPage as Stripe split hero"
```

---

## Part 3 — 原子组件重写(ScoreBadge / Spinner / FormItem / IntelCard / IntelPanel / MarkdownRenderer / PasswordInput)

这些是 Part 4 / 5 要用的原子,必须先重写。

### Task 3.1: 重写 ScoreBadge

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: Grep 定位 `function ScoreBadge(`**

Run: `grep -n "^function ScoreBadge" src/app/page.js`

- [ ] **Step 2: 读取当前 ScoreBadge 内容**

Use Read with offset = 匹配行 - 1, limit = 30.

- [ ] **Step 3: 用 Edit 替换为:**

```js
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
```

- [ ] **Step 4: 构建 + 提交**

```bash
npm run build
git add src/app/page.js
git commit -m "feat(ui): Stripe ScoreBadge with ruby/lemon/success variants"
```

---

### Task 3.2: 重写 Spinner

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: Grep 定位 `function Spinner(`**

Run: `grep -n "^function Spinner" src/app/page.js`

- [ ] **Step 2: 用 Edit 替换为:**

```js
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
```

- [ ] **Step 3: 构建 + 提交**

```bash
npm run build
git add src/app/page.js
git commit -m "feat(ui): simplify Spinner with Stripe purple default"
```

---

### Task 3.3: 重写 FormItem

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: Grep 定位 `function FormItem(`**

Run: `grep -n "^function FormItem" src/app/page.js`

- [ ] **Step 2: 用 Edit 替换为:**

```js
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
```

- [ ] **Step 3: 构建 + 提交**

```bash
npm run build
git add src/app/page.js
git commit -m "feat(ui): Stripe FormItem with caption label"
```

---

### Task 3.4: 添加 PasswordInput 组件

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: 在 `function FormItem(` 的闭合大括号之后插入:**

```js
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
```

- [ ] **Step 2: 构建 + 提交**

```bash
npm run build
git add src/app/page.js
git commit -m "feat(ui): add PasswordInput component"
```

---

### Task 3.5: 重写 IntelCard

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: Grep 定位 `function IntelCard(`**

Run: `grep -n "^function IntelCard" src/app/page.js`

- [ ] **Step 2: 用 Edit 替换为:**

```js
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
```

- [ ] **Step 3: 构建 + 提交**

```bash
npm run build
git add src/app/page.js
git commit -m "feat(ui): compact IntelCard with status dot"
```

---

### Task 3.6: 重写 IntelPanel

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: Grep 定位 `function IntelPanel(`**

Run: `grep -n "^function IntelPanel" src/app/page.js`

- [ ] **Step 2: 读取当前 IntelPanel 内容(约 50-80 行)**

Use Read with offset = 匹配行 - 1, limit = 100.

- [ ] **Step 3: 用 Edit 替换为:**

```js
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
```

- [ ] **Step 3: 构建 + 提交**

```bash
npm run build
git add src/app/page.js
git commit -m "feat(ui): Stripe IntelPanel with 2-column card grid"
```

---

### Task 3.7: 重写 MarkdownRenderer

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: Grep 定位 `function MarkdownRenderer(` 和 `function renderInline(`**

Run: `grep -n "^function MarkdownRenderer\|^function renderInline" src/app/page.js`

- [ ] **Step 2: 读取两个函数**

Read 从较早的 `function MarkdownRenderer(` 开始,读 200 行。

- [ ] **Step 3: 保留解析逻辑,只替换输出元素的 className**

关键原则:**不要重写解析逻辑**。找到每个 `<h1>`、`<h2>`、`<h3>`、`<p>`、`<ul>`、`<ol>`、`<li>`、`<strong>`、`<em>`、`<code>`、`<pre>`、`<blockquote>`、`<a>`、`<hr>`、`<table>`、`<th>`、`<td>` 标签,把它的 `style={...}` 属性删除(或 `className` 替换)为下表对应的 Tailwind 类:

| 元素 | 新 className |
|---|---|
| `h1` | `text-heading font-light text-stripe-navy mt-8 first:mt-0 mb-4` |
| `h2` | `text-subheading font-light text-stripe-navy mt-6 mb-3` |
| `h3` | `text-body-lg font-normal text-stripe-label mt-5 mb-2` |
| `p` | `text-body font-light text-stripe-navy leading-relaxed mb-4` |
| `ul` | `list-disc ml-6 space-y-1.5 mb-4 marker:text-stripe-purple` |
| `ol` | `list-decimal ml-6 space-y-1.5 mb-4 marker:text-stripe-purple` |
| `li` | `text-body font-light text-stripe-navy` |
| `strong` | `font-normal text-stripe-navy` |
| `em` | `italic` |
| `code`(inline) | `font-mono text-caption-sm px-1.5 py-0.5 bg-stripe-border/50 rounded-stripe-sm text-stripe-navyDeep` |
| `pre` | `font-mono text-caption-sm bg-stripe-navyDeep text-white p-4 rounded-stripe mb-4 overflow-x-auto` |
| `blockquote` | `border-l-2 border-stripe-purple pl-4 py-1 my-4 text-stripe-body italic` |
| `a` | `text-stripe-purple hover:text-stripe-purpleHover underline decoration-stripe-purpleLight underline-offset-2` |
| `hr` | `border-stripe-border my-6` |
| `table` | `w-full my-4 text-caption border-collapse` |
| `th` | `border-b border-stripe-border font-normal text-stripe-label text-left py-2 px-3` |
| `td` | `border-b border-stripe-border/50 py-2 px-3 text-stripe-body` |

使用多次 Edit 调用,每次针对一个标签,用 `replace_all` 参数配合足够上下文确保匹配唯一。如果现有代码里用 JSX 的 `style` 属性传对象,删掉 `style=` 整段,改用 `className=`。

**如果某个标签当前已经有 className,把老的 className 整段删掉,用新的覆盖。**

- [ ] **Step 4: 构建验证**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 5: 手动 smoke test**

Run: `npm run dev`
登录后进入分析页,提交一次请求(老 QueryPage 此时还是老样式,但 MarkdownRenderer 输出应该开始呈现 Stripe 字体和颜色)。
停止 dev。

- [ ] **Step 6: 提交**

```bash
git add src/app/page.js
git commit -m "feat(ui): Stripe-style MarkdownRenderer output classes"
```

---

## Part 4 — 分析页(QueryPage)重写

### Task 4.1: QueryPage 两栏骨架 + InputCard 展开态

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: Grep 定位 `function QueryPage(`**

Run: `grep -n "^function QueryPage" src/app/page.js`

- [ ] **Step 2: 读取 QueryPage 完整内容(从匹配行读 380 行)**

Use Read with offset = 匹配行 - 1, limit = 380.

记下所有的 state hooks、refs、handlers、SSE 逻辑、fetch body 内容。这些**业务逻辑必须保留**。

- [ ] **Step 3: 确定所有要保留的 state/refs/handlers**

列一个白名单(例子,具体以读到的代码为准):
- state: `url`, `setUrl`, `inquiry`, `setInquiry`, `images`, `setImages`, `result`, `setResult`, `loading`, `setLoading`, `streaming`, `setStreaming`, `inputCollapsed`, `setInputCollapsed`, `error`, `setError`, `fieldErrors`, `setFieldErrors`, `enableIntel`, `setEnableIntel`, `intel`, `setIntel`, `intelProgress`, `setIntelProgress`, `intelWarning`, `setIntelWarning`
- refs: `resultRef`, `abortCtrlRef`
- handlers: `handleSubmit`, 图片上传相关
- 内部的 SSE while 循环与 type 分派

- [ ] **Step 4: 用 Edit 替换整个 QueryPage 函数**

`old_string` 覆盖从 `function QueryPage(` 到它的闭合 `}`。`new_string` 是一个**完整且全新的**函数,里面:

- 保留 Step 3 列出的所有 state / refs / handlers(把它们从老代码里逐字复制过来,仅调整排版)
- 保留 SSE reader 循环的 **每一行**(包括 type 分派、`intelError` 处理等)
- 保留 fetch 请求体(包括 `enableIntel` 字段)
- `handleSubmit` 里保留所有 `set*` 重置调用
- 把 return 的 JSX 整个换成下面的新结构

新 JSX 骨架(填入保留的 state 和 handlers):

```js
  return (
    <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-6 pb-8">
      {/* LEFT column */}
      <div className="w-full lg:w-[420px] lg:shrink-0 space-y-4 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-2">
        {/* Input card */}
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
              {/* Image dropzone — keep existing inline JSX from old code, wrap with FormItem */}
              <FormItem label="附加图片(可选)" hint="拖拽或点击 · 最多 4 张">
                {/* PLACEHOLDER: reinsert the original image upload JSX here. Task 4.3 will extract it. */}
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

        {/* Intel panel */}
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
```

**关键**:把 Step 2 读到的 **图片上传 JSX**(dropzone / 预览缩略图 / 删除按钮)原样粘贴到 `PLACEHOLDER` 的位置。样式暂时保持老的,Task 4.3 会整体重构图片区。

- [ ] **Step 5: 构建验证**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 6: 手动 smoke test**

Run: `npm run dev`
登录后进入分析页,确认:
- 左右两栏布局出现(桌面宽度)
- 输入卡片可见,表单 focus 有紫色 ring
- 提交一次请求,情报面板从右列的下方出现(目前还没有情报流式)——是的,流式应该依然能跑,因为 SSE 逻辑未改
- 风险徽章在右列 header 显示
- 窗口缩到 < 1024 时两栏塌成单列
停止 dev。

- [ ] **Step 7: 提交**

```bash
git add src/app/page.js
git commit -m "feat(ui): rewrite QueryPage with Stripe 2-column layout"
```

---

### Task 4.2: 抽取并重写 ImageDropzone 组件

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: 在 Task 4.1 中插入了"PLACEHOLDER: reinsert the original image upload JSX"那段,现在读取老代码里的上传实现,找出它用到的 state / handler**

Run: `grep -n "setImages\|dragOver\|handleDrop\|onDrop\|base64" src/app/page.js | head -30`

记下图片上传相关的 state 和 handler 名字(可能是 `setImages`、`dragOver`、`setDragOver`、以及一个处理文件的 handler 比如 `processFiles`)。

- [ ] **Step 2: 在 `function EmptyState(` 的闭合大括号之后(Task 1.2 添加位置),插入新的 ImageDropzone 组件**

```js
function ImageDropzone({ images, setImages, maxImages = 4 }) {
  const [dragOver, setDragOver] = useState(false)

  async function processFiles(files) {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    const remaining = maxImages - images.length
    const toAdd = arr.slice(0, remaining)
    const results = await Promise.all(
      toAdd.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = () => {
              const base64 = reader.result.split(',')[1] || ''
              resolve({ name: file.name, type: file.type, base64, preview: reader.result })
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
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files)
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    const files = []
    for (const it of items) {
      if (it.type.startsWith('image/')) files.push(it.getAsFile())
    }
    if (files.length) processFiles(files)
  }

  function removeAt(i) {
    setImages((prev) => prev.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onPaste={handlePaste}
        className={`w-full px-4 py-6 border border-dashed rounded-stripe-sm text-center transition-colors cursor-pointer ${
          dragOver
            ? 'border-stripe-purple bg-stripe-purpleLight/20'
            : 'border-stripe-border hover:border-stripe-purpleLight bg-white'
        }`}
        onClick={() => document.getElementById('image-upload-input')?.click()}
      >
        <input
          id="image-upload-input"
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
            <div key={i} className="relative w-16 h-16 rounded-stripe-sm overflow-hidden border border-stripe-border bg-white">
              <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeAt(i) }}
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
```

- [ ] **Step 3: 回到 QueryPage 里的图片上传部分(Task 4.1 留的 PLACEHOLDER 区),替换为:**

```jsx
<ImageDropzone images={images} setImages={setImages} maxImages={4} />
```

并**删除**老的内联上传 JSX 和与之关联但现在已不需要的 state(比如 `dragOver` / `setDragOver`,这些已被搬进 ImageDropzone 内部)。

**注意**:如果老的 `processFiles` 逻辑和新组件里写的不同(比如校验更严格、有特殊的体积限制等),以老的为准——把老逻辑复制到新组件的 `processFiles` 里。

- [ ] **Step 4: 构建验证**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 5: 手动 smoke test**

Run: `npm run dev`
分析页:
- 图片区是虚线边框 dropzone
- 拖拽图片进入时边框变紫、底色变浅紫
- 上传成功后显示 16×16 缩略图网格,每张右上角有红色 × 删除按钮
- 粘贴图片(Cmd+V 在 dropzone 上)也能工作
停止 dev。

- [ ] **Step 6: 提交**

```bash
git add src/app/page.js
git commit -m "feat(ui): extract and restyle ImageDropzone"
```

---

## Part 5 — 历史页 + 设置页 + 清理

### Task 5.1: 重写 HistoryPage

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: Grep 定位 `function HistoryPage(`**

Run: `grep -n "^function HistoryPage" src/app/page.js`

- [ ] **Step 2: 读取 HistoryPage 完整函数**

Use Read with offset = 匹配行 - 1, limit = 220.

记下 state(queries、loading、selected、search、expandError 等)、fetch 逻辑、`isValidRecord`、和 IntelPanel for history 的使用方式。

- [ ] **Step 3: 在 `function HistoryPage(` 之前(在 `function isValidRecord(` 之后),添加 HistoryCard 辅助组件**

```js
function HistoryCard({ query, active, onClick }) {
  const score = extractScore(query.result)
  const hasIntel = query.intelEnabled === 'true' || query.intelEnabled === true
  const when = query.createdAt ? new Date(query.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
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
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-caption font-mono text-stripe-label truncate flex-1">
          {query.url || '(无URL)'}
        </span>
        {score && <ScoreBadge score={score} size="sm" />}
      </div>
      <div className="flex items-center justify-between text-caption-sm text-stripe-body">
        <span>{when}</span>
        {hasIntel && <span className="text-stripe-purple">🔍 含情报</span>}
      </div>
    </button>
  )
}
```

- [ ] **Step 4: 替换 HistoryPage 函数体**

保留所有 state 和 fetch 逻辑(包括 `useEffect` 中的 queries 拉取)。把 return 的 JSX 替换为:

```jsx
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
        ) : queries.length === 0 ? (
          <div className="py-12 text-center text-caption text-stripe-body">暂无历史记录</div>
        ) : (
          <div className="space-y-2 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:pr-2">
            {queries
              .filter((q) =>
                !search.trim()
                  ? true
                  : (q.url || '').includes(search) || (q.inquiry || '').includes(search)
              )
              .map((q, i) => (
                <HistoryCard
                  key={i}
                  query={q}
                  active={selected === q}
                  onClick={() => setSelected(q)}
                />
              ))}
          </div>
        )}
      </div>

      {/* RIGHT: detail */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="h-full min-h-[300px] bg-white border border-stripe-border rounded-stripe">
            <EmptyState
              icon={<ClockIcon size={20} />}
              title="选择一条历史记录"
              description="左侧列表中点击任意条目查看完整分析"
            />
          </div>
        ) : (() => {
            const parsedIntel = (() => {
              if (!selected?.intel) return null
              if (typeof selected.intel === 'string') {
                try { return JSON.parse(selected.intel) } catch { return null }
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
                    {extractScore(selected.result) && (
                      <ScoreBadge score={extractScore(selected.result)} />
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

                <div className="bg-white border border-stripe-border rounded-stripe shadow-stripe-card p-6">
                  <article className="max-w-none">
                    <MarkdownRenderer content={selected.result} />
                  </article>
                </div>
              </div>
            )
          })()}
      </div>
    </div>
  )
```

**注意**:如果老的 HistoryPage 有额外的 state(比如 `expandError`、`isValidRecord` 的调用)或额外的功能(比如删除按钮、刷新按钮),保留这些 state/handler 并在新 JSX 中把它们接回去——不能因为重写样式而丢失功能。

- [ ] **Step 5: 构建验证**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 6: 手动 smoke test**

Run: `npm run dev`
进入历史页:
- 左侧列表展示历史条目,风险徽章、时间、"含情报"标签可见
- 搜索框输入任意关键词,列表筛选
- 点击条目,右侧详情显示元信息 + IntelPanel(如有)+ MarkdownRenderer
- 未选中时显示 EmptyState
停止 dev。

- [ ] **Step 7: 提交**

```bash
git add src/app/page.js
git commit -m "feat(ui): rewrite HistoryPage with list+detail layout"
```

---

### Task 5.2: 重写 SettingsPage + SettingsCard

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: Grep 定位 `function SettingsPage(`**

Run: `grep -n "^function SettingsPage" src/app/page.js`

- [ ] **Step 2: 读取 SettingsPage 完整函数**

Use Read with offset = 匹配行 - 1, limit = 240.

记下:
- form state 的所有字段(`baseUrl`, `systemPrompt`, `fallbackSystemPrompt`, `serpApiKey`, `extractionModel`, `extractionPrompt`, `apiKey`, `modelName`, `_customModels` 等)
- serpUsage state
- 加载 / 保存 handler 的名字与实现
- 自定义模型名快捷按钮(如果存在)的结构

- [ ] **Step 3: 在 `function HistoryCard(` 的闭合大括号之后(Task 5.1 位置),添加 SettingsCard 组件**

```js
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
```

- [ ] **Step 4: 替换 SettingsPage 函数**

`old_string` 覆盖整个 `function SettingsPage(...) { ... }`。`new_string` 保留 Step 2 记下的 state / fetch / save handlers(整段复制进去),把 return JSX 换成下面的版本。

```jsx
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
    <form onSubmit={handleSave} className="max-w-[680px] mx-auto space-y-6 pb-28">
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
          <input
            className={inputCls}
            value={form.modelName || ''}
            onChange={(e) => setForm({ ...form, modelName: e.target.value })}
          />
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
        <SettingsCard
          title="Prompt 模板"
          description="主分析与降级模板"
          adminBadge
        >
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
```

**注意**:
- 如果老的 save handler 名字不是 `handleSave`、state 不是 `form` / `setForm` / `saved` / `saving` / `serpUsage` / `loading`,请把新 JSX 里的这些名字改成实际的名字。
- 如果老代码里有"自定义模型名 + 按钮"的快捷 UI(commit 739adc9 引入),把原逻辑复制进新的"主分析模型"或"结构化抽取模型"FormItem 里——不能丢失该功能。
- 如果老代码里还有 `onChange` 之外的其他 handler(比如 ModelName 列表 `_customModels` 的管理),保留。

- [ ] **Step 5: 把 Layout 调用中的 `serpUsage` prop 接回真实值**

Grep 定位 Layout 的调用位置(可能在根 App 组件里)。需要从 SettingsPage 或统一的 `useEffect` 里拉取 serpUsage 并通过 prop 传给 Layout。

**最简做法**:在根组件里加一个 `const [serpUsage, setSerpUsage] = useState(null)` 和一个 `useEffect(() => { fetch('/api/settings').then(r => r.json()).then(d => { if (d.serpUsage) setSerpUsage(d.serpUsage) }) }, [user])`,把 `serpUsage` 传给 `<Layout ... serpUsage={serpUsage}>`。

只有管理员的响应里会有 `serpUsage` 字段,非管理员的响应里该字段为 undefined,不影响。

- [ ] **Step 6: 构建验证**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 7: 手动 smoke test**

Run: `npm run dev`
登录为管理员:
- 设置页显示三张卡片:模型配置(无 ADMIN 徽章)、实时情报(ADMIN 徽章)、Prompt 模板(ADMIN 徽章)
- SerpAPI 计数器在"实时情报"卡里显示
- 侧栏底部也显示同一份 SerpAPI 用量
- 底部 sticky 保存条可见,保存后显示 `✓ 已保存`
登录为普通用户:
- 只看到"模型配置"一张卡
- 侧栏无 SerpAPI 用量卡
停止 dev。

- [ ] **Step 8: 提交**

```bash
git add src/app/page.js
git commit -m "feat(ui): rewrite SettingsPage with card groups and sticky save bar"
```

---

### Task 5.3: 删除 `T` 对象 + 清理所有残留的 `style={...}`

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: Grep 所有引用 `T.` 的地方**

Run: `grep -n "\bT\." src/app/page.js`

对于每个匹配,确认是 `T.xxx` 形式的主题访问(不是 `T` 变量名的其他用法)。

- [ ] **Step 2: 把每个 `T.xxx` 引用替换成等价的 Tailwind 类或硬编码值**

映射表:

| `T.*` | Tailwind 替代 |
|---|---|
| `T.primary` / `T.primaryLight` 之类的紫色 | `stripe-purple` 系列 |
| `T.textPrimary` | `text-stripe-navy` |
| `T.textSecondary` | `text-stripe-label` |
| `T.textTertiary` / `T.textMuted` | `text-stripe-body` |
| `T.border` | `border-stripe-border` |
| `T.bgElevated` | `bg-white` |
| `T.shadowCard` | `shadow-stripe-ambient` 或 `shadow-stripe-card` |
| `T.radius` / `T.radiusLg` | `rounded-stripe-sm` / `rounded-stripe-lg` |
| `T.fontMono` | `font-mono` |

如果遇到不在表里的 `T.*`,根据上下文用 spec §4 的映射选择最接近的 Stripe token。

- [ ] **Step 3: Grep 所有剩余的 `style={{` 并逐个处理**

Run: `grep -n "style={{" src/app/page.js`

对每个匹配:
- **删除** 该 `style={{...}}` 属性
- 把视觉属性(颜色、padding、边框等)改写成 Tailwind 类放在已有的 `className` 上(没有 className 就新增)
- 只保留**动态值**(比如 `style={{ width: someComputedPx + 'px' }}`)

- [ ] **Step 4: 删除 `const T = { ... }` 整块**

Grep 定位 `const T = {`,Edit 把整个对象字面量 + 尾分号一起删除。**在此之前,Step 1-3 必须已经清除了所有对 `T.` 的引用**,否则 build 会失败。

- [ ] **Step 5: 构建验证**

Run: `npm run build`
Expected: 成功,无 `T is not defined` 报错。

- [ ] **Step 6: 手动 smoke test**

Run: `npm run dev`
走一遍完整流程:登录 → 分析页(提交真实请求,观察情报流 + AI 报告)→ 历史页 → 设置页 → 登出。
所有页面应该是完全 Stripe 化的视觉。
停止 dev。

- [ ] **Step 7: 提交**

```bash
git add src/app/page.js
git commit -m "refactor(ui): remove legacy T theme object and inline styles"
```

---

## Part 6 — 验收

### Task 6.1: 最终 build + lint + 视觉巡检

- [ ] **Step 1: 确认无残留**

Run:
```bash
grep -n "const T = \|T\.primary\|T\.text\|T\.border\|T\.shadow\|T\.radius\|T\.font\|T\.bg" src/app/page.js
```
Expected: **无输出**(所有残留已清理)。

```bash
grep -cn "style={{" src/app/page.js
```
Expected: 0 或只有极少数个(仅动态计算值允许)。

- [ ] **Step 2: 构建**

Run: `npm run build`
Expected: 成功,无错误,无新增警告(除了已有的 Upstash env 警告)。

- [ ] **Step 3: 单元测试(情报功能回归)**

Run: `npm test`
Expected: 24 / 24 通过。如果失败,说明重构误伤了 `lib/` 或 `test/` 下的代码——回滚到失败前的 commit 重做。

- [ ] **Step 4: 响应式巡检**

Run: `npm run dev`

在 Chrome DevTools 里分别模拟以下宽度:
- **1440px**:桌面完整体验(sidebar + 两栏分析页 + 登录页左右分裂)
- **1024px**:桌面边界(sidebar 仍可见,两栏分析页仍生效)
- **768px**:平板(sidebar 塌成 hamburger,分析页塌成单列)
- **375px**:手机(登录页塌成顶部 mini hero + 表单;分析页单列)

每个宽度下走一遍登录 → 分析 → 历史 → 设置。

- [ ] **Step 5: 视觉对照 DESIGN.md**

打开仓库根的 `DESIGN.md`,对照:
- §2 色板:主页元素的颜色和规范是否一致
- §3 字体:标题是否用 weight 300 + 紧的 letter-spacing
- §4 组件:按钮 / 卡片 / 徽章 / 输入框 / 导航的样式是否符合
- §6 阴影:卡片是否用了蓝调阴影(开发者工具检查 `box-shadow` 看是否包含 `rgba(50,50,93,0.25)`)

肉眼检查,无需形式化对比。

- [ ] **Step 6: 提交一个 `chore` 校验 commit(可选,仅当有任何微调时)**

如果 Step 4-5 发现任何小瑕疵(比如某处 hover 效果缺失、某个间距不对),直接修掉并合并到下面的 checkpoint commit。如果完全没问题,跳过此步。

```bash
git add -A
git commit -m "chore(ui): minor polish after Stripe redesign visual check"
```

### Task 6.2: 完成度自检

- [ ] **Step 1: 对照 spec §2 的六大决定,逐一确认已实现**

| 决定 | 验证方法 | 通过? |
|---|---|---|
| 彻底重构(11 组件 + T 删除) | `grep "const T = " src/app/page.js` 应该无输出 | [ ] |
| Geist 字体 | `layout.js` 引入 `GeistSans`/`GeistMono`,devtools 看计算字体名包含 "Geist" | [ ] |
| 仅浅色 + 局部深色 | 登录页左半屏 `#1c1e54`,其余白色 | [ ] |
| 侧栏 240px | `w-60` 出现在 Layout 的 aside | [ ] |
| 分析页两栏 | `lg:w-[420px]` 出现在 QueryPage | [ ] |
| 登录页左右分裂 | `lg:w-1/2` + `bg-stripe-brandDark` 出现在 LoginPage | [ ] |

- [ ] **Step 2: 确认情报功能完整保留**

Run: `npm run dev`,手动跑一次真实分析(需要有效的 SerpAPI key),确认:
- 情报卡逐张点亮(需要管理员已配置 SerpAPI key)
- AI 报告流式出现
- 风险徽章显示正确
- 历史记录中能回放情报面板
- 关闭"启用实时情报检索"复选框,走 fallback 路径也能出报告
停止 dev。

- [ ] **Step 3: 最终测试 + build 双保险**

```bash
npm test && npm run build
```
Expected: 双绿。

- [ ] **Step 4: 本任务无代码变动,不 commit。打印分支状态报告**

```bash
git log main..HEAD --oneline
```
Expected: 看到本次重构的全部 commit 列表。

---

## Self-Review(plan 作者自查)

**Spec coverage:**
- §1 目标 → Task 0.1-5.3 全覆盖
- §2 六大决定 → Task 6.2 逐项校验
- §3 Tailwind 技术路线 → Task 0.1-0.3
- §4 Token 映射 → Task 0.2 (config) + Part 3-5 (使用方式)
- §5 Sidebar 骨架 → Task 1.3
- §6 登录页 → Task 2.1
- §7 分析页 → Task 4.1-4.2
- §8 历史页 → Task 5.1
- §9 设置页 → Task 5.2
- §10 新增组件 → Task 1.1-1.2, 3.4, 4.2, 5.1-5.2
- §11 删除清单 → Task 5.3
- §12 实施顺序 → Part 0-5 顺序与 spec 一致
- §13 测试策略 → Task 6.1 (构建 + 响应式 + 对照)
- §14 风险 → Task 6.1 Step 3 (单元测试回归)

**Placeholder scan:** 无 "TBD" / "TODO" / "implement later"。每个代码块都是完整实现。唯一一处 "PLACEHOLDER" 是 Task 4.1 中明确标注的图片上传 JSX 暂存区,由 Task 4.2 显式处理。

**Type consistency:**
- Component 名字全文一致:`Layout`, `LoginPage`, `QueryPage`, `HistoryPage`, `SettingsPage`, `IntelCard`, `IntelPanel`, `ScoreBadge`, `Spinner`, `FormItem`, `NavItem`, `SettingsCard`, `HistoryCard`, `EmptyState`, `Logo`, `PasswordInput`, `ImageDropzone`, `MarkdownRenderer`。
- Tailwind token 名一致:`stripe-purple` / `stripe-navy` / `stripe-border` / `stripe-brandDark` / `stripe-body` 等全文一致拼写。
- 字体 class 一致:`text-display` / `text-heading` / `text-subheading` / `text-body-lg` / `text-body` / `text-btn` / `text-link` / `text-caption` / `text-caption-sm`。
- State / prop 名在重写组件时要求"保留原名"——由每个任务的 Step 2 读取老代码后显式复制。

**Scope check:** 单一重构,没有独立子系统,不需要拆 plan。

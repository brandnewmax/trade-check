# Online Intel Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time retrieval (SerpAPI + Wayback + site fetch + LLM extraction) before the main analysis call, with a user toggle, an evidence-bound system prompt, and a cards-based intel panel on the frontend.

**Architecture:** `/api/analyze` becomes a 4-stage pipeline — parallel fetch (site + Wayback) → lightweight LLM extraction of entities → parallel SerpAPI searches → main LLM analysis with a markdown briefing injected into the user message. Results stream via SSE with typed events (`intel` / `intelDone` / `delta` / `done`). A per-request `enableIntel` flag lets users opt out and fall back to the current flow.

**Tech Stack:** Next.js 14 App Router (JS), Upstash Redis, SerpAPI HTTP API, Wayback Machine API, Vitest for unit tests.

**Spec reference:** `docs/superpowers/specs/2026-04-14-online-intel-retrieval-design.md`

---

## Conventions

- All new code is plain JS (match existing project). No TypeScript.
- Module paths use the existing `@/lib/...` alias (set in `jsconfig.json`).
- Network code uses global `fetch` with `AbortSignal.timeout(ms)`; no extra HTTP libraries.
- Pure utilities (query builders, format, parsers) are unit-tested with Vitest.
- Network-facing code (fetchWebsite, serpapi, extract) is validated with a manual smoke test documented in the task, not unit-tested.
- Commit after each task that leaves the repo in a working state.
- **Never** commit secrets. SerpAPI key is stored in Redis via the admin settings UI, not in git.

---

## File Map

**New files:**
- `vitest.config.js` — test runner config
- `lib/intel/index.js` — `gatherIntel()` orchestrator
- `lib/intel/fetchWebsite.js` — fetch URL, extract `<title>` / `og:site_name` / body text
- `lib/intel/wayback.js` — query archive.org, return first-snapshot year
- `lib/intel/extract.js` — call lightweight LLM, parse JSON with regex fallback
- `lib/intel/serpapi.js` — SerpAPI HTTP client with usage counter + error mapping
- `lib/intel/format.js` — `formatIntelAsBriefing(intel)` pure function
- `lib/intel/searches/linkedin.js`
- `lib/intel/searches/facebook.js`
- `lib/intel/searches/panjiva.js`
- `lib/intel/searches/negative.js`
- `lib/intel/searches/general.js`
- `test/intel/format.test.js`
- `test/intel/searches.test.js`
- `test/intel/extract.test.js`

**Modified files:**
- `package.json` — add devDependencies + `test` script
- `lib/kv.js` — new fields in `getGlobalSettings`, expanded allowlist in `saveGlobalSettings`, new `getSerpUsage` / `incrSerpUsage`, updated `saveQuery` signature to accept `intel` + `intelEnabled`
- `src/app/api/analyze/route.js` — pipeline rewrite, typed SSE events
- `src/app/api/settings/route.js` — expose/save new global fields + SerpAPI usage
- `src/app/page.js` — toggle checkbox, SSE type dispatcher, intel panel component, settings drawer new fields, history panel renders intel when present

---

## Part 0 — Test Infrastructure & Scaffolding

### Task 0.1: Install Vitest

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add devDependencies and test script**

Edit `package.json` so it reads:

```json
{
  "name": "trade-check",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start -p ${PORT:-8080} -H 0.0.0.0",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "14.2.35",
    "react": "^18",
    "react-dom": "^18",
    "jose": "^5.6.3",
    "@upstash/redis": "^1.34.0"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: installs vitest, exits 0.

- [ ] **Step 3: Create vitest config**

Create `vitest.config.js`:

```js
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 4: Smoke-run the test command**

Run: `npm test`
Expected: exits 0 with `No test files found` (no tests yet — that's fine).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.js
git commit -m "chore: add vitest test infrastructure"
```

---

### Task 0.2: Create `lib/intel/` directory skeleton

**Files:**
- Create: `lib/intel/.gitkeep` (temporary, removed in later tasks)

- [ ] **Step 1: Create empty directory tree**

Run:
```bash
mkdir -p lib/intel/searches test/intel
touch lib/intel/.gitkeep test/intel/.gitkeep
```

- [ ] **Step 2: Commit placeholder**

```bash
git add lib/intel test/intel
git commit -m "chore: scaffold lib/intel and test/intel directories"
```

(The `.gitkeep` files are removed implicitly when later tasks add real files to the same directories.)

---

## Part 1 — Data Layer (`lib/kv.js`)

### Task 1.1: Extend `getGlobalSettings` with new fields and new default prompts

**Files:**
- Modify: `lib/kv.js`

- [ ] **Step 1: Replace `getGlobalSettings` and move long default strings into constants**

Open `lib/kv.js`. Above the existing `getGlobalSettings`, insert:

```js
// ─── DEFAULT PROMPTS ─────────────────────────────────────────────────────────
const DEFAULT_SYSTEM_PROMPT = `你是一位专业的中国外贸背景调查分析师。
用户消息的开头会包含一份【实时情报简报】,这是系统自动从公开来源检索到的客观数据,
你必须把它作为判断的核心依据,不得忽略。

请严格按以下框架输出分析报告:

## 一、情报交叉核验
逐项引用简报中的发现,判断每项是"正面信号 / 负面信号 / 中性"并说明理由:
- 公司网站专业度(依据:简报第 2 节)
- 建站时间是否与自称规模匹配(依据:简报第 3 节,<2 年需警惕)
- LinkedIn 人员身份是否匹配自称职位(依据:简报第 4 节)
- Facebook 官方存在性(依据:简报第 5 节)
- Panjiva 海关足迹是否与产品/国家吻合(依据:简报第 6 节,无记录的"老牌贸易商"是强负面信号)
- 网络负面舆情(依据:简报第 7 节)

## 二、信号矛盾检查
列出简报中相互矛盾的地方(例:自称 10 年老厂但建站仅 1 年 / LinkedIn 职位与邮件签名不符 / 声称专营欧盟但 Panjiva 仅有非洲记录)。

## 三、询盘本身的分析
回到用户原始询盘文本,分析措辞、报价合理性、付款方式要求等常见诈骗特征。

## 四、综合风险等级
给出【低风险 / 中风险 / 高风险】三选一,必须在一行内用这几个固定词之一(系统靠关键词提取,不要改措辞)。

## 五、具体建议
针对该客户,下一步应做什么(例:要求视频验厂、索要 Bill of Lading 等)。

硬性规则:
- 如果某项简报标注 status: failed 或 skipped,必须明确说"该维度数据缺失,无法作为依据",不得编造
- 禁止引入简报之外的"事实"(不要说"根据我的了解该公司……")
- 所有结论必须能追溯到简报某一节或询盘原文`

const DEFAULT_FALLBACK_SYSTEM_PROMPT = `你是一位专业的中国外贸背景调查分析师。请根据用户提供的公司网址和询盘信息,从以下维度进行深度分析:

1. **公司可信度评估**:分析公司网站的专业程度、内容质量、联系方式完整性
2. **询盘真实性分析**:判断询盘内容是否符合正常外贸询价规律,是否存在欺诈风险
3. **风险等级判定**:综合评估,给出低/中/高风险评级
4. **具体风险点**:列出发现的具体问题或可疑信号
5. **建议处理方式**:根据分析结果给出专业建议

请用中文输出结构化的分析报告,语言专业简洁。`

const DEFAULT_EXTRACTION_PROMPT = `你是一个结构化信息抽取助手。用户会给你一段外贸询盘文本,以及(可能有的)目标公司网站首页正文。
请从中提取以下字段,严格返回一个 JSON 对象,不要任何额外文字:

{
  "companyName": 公司名或 null,
  "personName": 发件人姓名或 null,
  "personTitle": 发件人职位或 null,
  "email": 邮箱或 null,
  "phone": 电话或 null,
  "country": 国家(2位 ISO 代码或中文国名)或 null,
  "products": 涉及产品的字符串数组(可为空)
}

规则:
- 拿不准的字段填 null,绝不猜测
- 公司名优先取网站标题或签名落款中的正式名称
- 电话统一去掉空格和横杠
- 只输出 JSON,不要 markdown 代码块,不要解释`
```

- [ ] **Step 2: Replace the existing `getGlobalSettings` function**

Find the current:

```js
export async function getGlobalSettings() {
  const s = await kv.hgetall('global_settings')
  return s || {
    baseUrl: '',
    systemPrompt: `你是一位专业的中国外贸背景调查分析师...`,
  }
}
```

Replace with:

```js
export async function getGlobalSettings() {
  const s = (await kv.hgetall('global_settings')) || {}
  return {
    baseUrl: s.baseUrl || '',
    systemPrompt: s.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    fallbackSystemPrompt: s.fallbackSystemPrompt || DEFAULT_FALLBACK_SYSTEM_PROMPT,
    serpApiKey: s.serpApiKey || '',
    extractionModel: s.extractionModel || 'gemini-2.5-flash',
    extractionPrompt: s.extractionPrompt || DEFAULT_EXTRACTION_PROMPT,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/kv.js
git commit -m "feat(kv): extend global settings with intel-related fields"
```

---

### Task 1.2: Widen `saveGlobalSettings` allowlist

**Files:**
- Modify: `lib/kv.js`

- [ ] **Step 1: Replace `saveGlobalSettings`**

Find:

```js
export async function saveGlobalSettings(data) {
  const allowed = ['baseUrl', 'systemPrompt']
  ...
}
```

Replace with:

```js
export async function saveGlobalSettings(data) {
  const allowed = [
    'baseUrl',
    'systemPrompt',
    'fallbackSystemPrompt',
    'serpApiKey',
    'extractionModel',
    'extractionPrompt',
  ]
  const filtered = Object.fromEntries(
    Object.entries(data).filter(([k, v]) => allowed.includes(k) && v !== undefined)
  )
  if (Object.keys(filtered).length > 0) {
    await kv.hset('global_settings', filtered)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/kv.js
git commit -m "feat(kv): allow saving extended global settings"
```

---

### Task 1.3: Add SerpAPI usage counter helpers

**Files:**
- Modify: `lib/kv.js`

- [ ] **Step 1: Append helpers after the existing `saveQuery` function**

Append at the end of `lib/kv.js`:

```js
// ─── SERPAPI USAGE COUNTER ───────────────────────────────────────────────────
function currentYearMonth() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function getSerpUsage(ym = currentYearMonth()) {
  const v = await kv.get(`serpapi:usage:${ym}`)
  return { month: ym, count: Number(v || 0) }
}

export async function incrSerpUsage(ym = currentYearMonth()) {
  return await kv.incr(`serpapi:usage:${ym}`)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/kv.js
git commit -m "feat(kv): add monthly SerpAPI usage counter"
```

---

### Task 1.4: Extend `saveQuery` to persist intel

**Files:**
- Modify: `lib/kv.js`

- [ ] **Step 1: Replace `saveQuery`**

Find the current `saveQuery`. Replace with:

```js
export async function saveQuery(query) {
  const id = `query:${Date.now()}:${Math.random().toString(36).slice(2)}`
  const record = { ...query }
  if (record.intel && typeof record.intel !== 'string') {
    record.intel = JSON.stringify(record.intel)
  }
  if (record.intelEnabled !== undefined) {
    record.intelEnabled = record.intelEnabled ? 'true' : 'false'
  }
  await kv.hset(id, record)
  await kv.lpush('queries:all', id)
  await kv.lpush(`queries:user:${query.userEmail}`, id)
  return id
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/kv.js
git commit -m "feat(kv): persist intel payload and enable flag on queries"
```

---

## Part 2 — Intel Building Blocks

### Task 2.1: `fetchWebsite.js`

**Files:**
- Create: `lib/intel/fetchWebsite.js`

- [ ] **Step 1: Create the module**

Create `lib/intel/fetchWebsite.js`:

```js
// Fetches a user-supplied URL and extracts a coarse text excerpt.
// Returns { status, title, excerpt, siteName, error }.

const USER_AGENT = 'Mozilla/5.0 (compatible; TradeCheckBot/1.0; +https://trade-check.local)'
const TIMEOUT_MS = 8000
const MAX_HTML_BYTES = 500_000
const EXCERPT_CHARS = 3000

function normalizeUrl(input) {
  if (!input) return null
  let u = String(input).trim()
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  try {
    return new URL(u).toString()
  } catch {
    return null
  }
}

function extractTag(html, re) {
  const m = html.match(re)
  return m ? m[1].trim() : null
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function fetchWebsite(rawUrl) {
  const url = normalizeUrl(rawUrl)
  if (!url) return { status: 'skipped', error: 'no url' }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    })
    if (!res.ok) return { status: 'failed', error: `HTTP ${res.status}` }

    // Read up to MAX_HTML_BYTES
    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: false })
    let html = ''
    let received = 0
    while (received < MAX_HTML_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      html += decoder.decode(value, { stream: true })
    }
    try { reader.cancel() } catch {}

    const title = extractTag(html, /<title[^>]*>([^<]*)<\/title>/i)
    const siteName = extractTag(
      html,
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i
    )
    const body = stripHtml(html).slice(0, EXCERPT_CHARS)

    return {
      status: 'ok',
      url,
      title: title || null,
      siteName: siteName || null,
      excerpt: body,
    }
  } catch (e) {
    return { status: 'failed', error: e.message || String(e) }
  }
}
```

- [ ] **Step 2: Manual smoke test**

Run:
```bash
node -e "import('./lib/intel/fetchWebsite.js').then(({fetchWebsite}) => fetchWebsite('https://example.com').then(r => console.log(JSON.stringify(r, null, 2))))"
```
Expected: prints a JSON object with `status: 'ok'`, a `title` close to `Example Domain`, and a non-empty `excerpt`.

- [ ] **Step 3: Commit**

```bash
git add lib/intel/fetchWebsite.js
git commit -m "feat(intel): add fetchWebsite"
```

---

### Task 2.2: `wayback.js`

**Files:**
- Create: `lib/intel/wayback.js`

- [ ] **Step 1: Create module**

Create `lib/intel/wayback.js`:

```js
// Queries archive.org Wayback "available" API to find the earliest snapshot
// of the user-supplied URL. Returns { status, firstSnapshot, ageYears, error }.

const TIMEOUT_MS = 8000

function domainOf(rawUrl) {
  try {
    const u = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://' + rawUrl)
    return u.hostname
  } catch {
    return null
  }
}

// archive.org returns snapshots in timestamp format YYYYMMDDhhmmss.
function parseTimestamp(ts) {
  if (!ts || ts.length < 8) return null
  const y = ts.slice(0, 4), m = ts.slice(4, 6), d = ts.slice(6, 8)
  return `${y}-${m}-${d}`
}

export async function waybackFirstSnapshot(rawUrl) {
  const domain = domainOf(rawUrl)
  if (!domain) return { status: 'skipped', error: 'no url' }

  try {
    // Ask for the earliest snapshot near 1996-01-01. The API returns the closest one.
    const api = `https://archive.org/wayback/available?url=${encodeURIComponent(domain)}&timestamp=19960101`
    const res = await fetch(api, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return { status: 'failed', error: `HTTP ${res.status}` }

    const json = await res.json()
    const snap = json?.archived_snapshots?.closest
    if (!snap || !snap.timestamp) {
      return { status: 'ok', firstSnapshot: null, ageYears: null }
    }

    const iso = parseTimestamp(snap.timestamp)
    const snapDate = new Date(iso)
    const ageMs = Date.now() - snapDate.getTime()
    const ageYears = Math.round((ageMs / (365.25 * 24 * 3600 * 1000)) * 10) / 10

    return { status: 'ok', firstSnapshot: iso, ageYears }
  } catch (e) {
    return { status: 'failed', error: e.message || String(e) }
  }
}
```

- [ ] **Step 2: Manual smoke test**

Run:
```bash
node -e "import('./lib/intel/wayback.js').then(({waybackFirstSnapshot}) => waybackFirstSnapshot('example.com').then(r => console.log(r)))"
```
Expected: `{ status: 'ok', firstSnapshot: '1996-...', ageYears: <some number> }`.

- [ ] **Step 3: Commit**

```bash
git add lib/intel/wayback.js
git commit -m "feat(intel): add wayback first-snapshot lookup"
```

---

### Task 2.3: `extract.js` (LLM entity extraction) + unit tests for JSON parser

**Files:**
- Create: `lib/intel/extract.js`
- Create: `test/intel/extract.test.js`

- [ ] **Step 1: Write failing test for the JSON parser**

Create `test/intel/extract.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { parseExtractionJson } from '@/lib/intel/extract'

describe('parseExtractionJson', () => {
  it('parses a plain JSON object', () => {
    const out = parseExtractionJson('{"companyName":"ABC","email":null}')
    expect(out.companyName).toBe('ABC')
    expect(out.email).toBeNull()
  })

  it('unwraps a fenced code block', () => {
    const out = parseExtractionJson('```json\n{"companyName":"XYZ"}\n```')
    expect(out.companyName).toBe('XYZ')
  })

  it('recovers via regex when there is leading noise', () => {
    const raw = 'Sure! Here you go:\n{"companyName":"Noise Co","products":["led"]}\nEnd.'
    const out = parseExtractionJson(raw)
    expect(out.companyName).toBe('Noise Co')
    expect(out.products).toEqual(['led'])
  })

  it('returns null on totally unparseable input', () => {
    expect(parseExtractionJson('lol nope')).toBeNull()
  })

  it('normalizes missing fields to null / empty products', () => {
    const out = parseExtractionJson('{"companyName":"A"}')
    expect(out.personName).toBeNull()
    expect(out.products).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- test/intel/extract.test.js`
Expected: FAIL (module or export not found).

- [ ] **Step 3: Create `lib/intel/extract.js`**

```js
// Calls the lightweight extraction LLM and parses a structured JSON result.
// Pure parser (`parseExtractionJson`) is exported for testing.

const FIELDS = ['companyName', 'personName', 'personTitle', 'email', 'phone', 'country', 'products']

export function parseExtractionJson(raw) {
  if (!raw || typeof raw !== 'string') return null

  // Strip ```json fences if present
  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) text = fence[1].trim()

  // Try direct parse first
  let obj = null
  try { obj = JSON.parse(text) } catch {}

  // Fallback: greedy match of the outermost object
  if (!obj) {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      try { obj = JSON.parse(m[0]) } catch {}
    }
  }

  if (!obj || typeof obj !== 'object') return null

  // Normalize shape
  const out = {}
  for (const f of FIELDS) {
    if (f === 'products') out.products = Array.isArray(obj.products) ? obj.products.map(String) : []
    else out[f] = obj[f] ?? null
  }
  return out
}

export async function extractEntities({ inquiry, websiteText, baseUrl, apiKey, model, systemPrompt }) {
  if (!baseUrl || !apiKey) {
    return { status: 'skipped', error: 'missing baseUrl or apiKey', extracted: null }
  }

  const userContent =
    `【询盘文本】\n${inquiry || '(无)'}\n\n` +
    `【网站正文摘录】\n${websiteText || '(未抓取)'}`

  const endpoint = baseUrl.replace(/\/$/, '') + '/chat/completions'

  let res
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: false,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    })
  } catch (e) {
    return { status: 'failed', error: e.message || String(e), extracted: null }
  }

  if (!res.ok) {
    let detail = ''
    try { detail = await res.text() } catch {}
    return { status: 'failed', error: `HTTP ${res.status}: ${detail.slice(0, 200)}`, extracted: null }
  }

  let json
  try { json = await res.json() } catch (e) {
    return { status: 'failed', error: 'non-json response', extracted: null }
  }

  const content = json?.choices?.[0]?.message?.content ?? ''
  const extracted = parseExtractionJson(content)
  if (!extracted) return { status: 'failed', error: 'parse failed', extracted: null, raw: content }

  return { status: 'ok', extracted }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npm test -- test/intel/extract.test.js`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/intel/extract.js test/intel/extract.test.js
git commit -m "feat(intel): add LLM entity extraction with JSON parser"
```

---

### Task 2.4: `serpapi.js` (shared HTTP client + usage counter)

**Files:**
- Create: `lib/intel/serpapi.js`

- [ ] **Step 1: Create module**

Create `lib/intel/serpapi.js`:

```js
// Low-level SerpAPI client. One call = one search. Increments monthly usage
// counter on every call (successful or not; SerpAPI bills failed calls too
// only for invalid keys, and we err on the side of visibility).

import { incrSerpUsage } from '@/lib/kv'

const TIMEOUT_MS = 10_000
const ENDPOINT = 'https://serpapi.com/search.json'

export async function serpSearch({ query, apiKey, num = 5, engine = 'google', extra = {} }) {
  if (!apiKey) return { ok: false, error: 'missing serpApiKey' }
  if (!query) return { ok: false, error: 'empty query' }

  const params = new URLSearchParams({
    engine,
    q: query,
    api_key: apiKey,
    num: String(num),
    hl: 'en',
    ...extra,
  })

  try {
    // Counter is incremented even on failure so the dashboard reflects real attempts.
    incrSerpUsage().catch(() => {})

    const res = await fetch(`${ENDPOINT}?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      let detail = ''
      try { detail = await res.text() } catch {}
      return { ok: false, error: `HTTP ${res.status}: ${detail.slice(0, 200)}` }
    }

    const json = await res.json()
    if (json.error) return { ok: false, error: json.error }

    const organic = Array.isArray(json.organic_results) ? json.organic_results : []
    const results = organic.slice(0, num).map(r => ({
      title: r.title || '',
      link: r.link || '',
      snippet: r.snippet || '',
    }))
    const totalResults = Number(json.search_information?.total_results ?? results.length)

    return { ok: true, query, results, totalResults }
  } catch (e) {
    return { ok: false, error: e.message || String(e) }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/intel/serpapi.js
git commit -m "feat(intel): add SerpAPI client with usage counter"
```

---

### Task 2.5: Search — `linkedin.js` + unit tests for query builder

**Files:**
- Create: `lib/intel/searches/linkedin.js`
- Create: `test/intel/searches.test.js` (first use)

- [ ] **Step 1: Write failing test for the query builder**

Create `test/intel/searches.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildLinkedInQuery } from '@/lib/intel/searches/linkedin'

describe('buildLinkedInQuery', () => {
  it('uses person + company when both are present', () => {
    const q = buildLinkedInQuery({ personName: 'John Smith', companyName: 'ABC Ltd' })
    expect(q).toBe('site:linkedin.com/in "John Smith" "ABC Ltd"')
  })

  it('falls back to person only', () => {
    const q = buildLinkedInQuery({ personName: 'Jane Doe', companyName: null })
    expect(q).toBe('site:linkedin.com/in "Jane Doe"')
  })

  it('falls back to company only (no /in path)', () => {
    const q = buildLinkedInQuery({ personName: null, companyName: 'ABC Ltd' })
    expect(q).toBe('site:linkedin.com/company "ABC Ltd"')
  })

  it('returns null when nothing to search', () => {
    expect(buildLinkedInQuery({ personName: null, companyName: null })).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — expect failure**

Run: `npm test -- test/intel/searches.test.js`
Expected: FAIL.

- [ ] **Step 3: Create `lib/intel/searches/linkedin.js`**

```js
import { serpSearch } from '@/lib/intel/serpapi'

export function buildLinkedInQuery({ personName, companyName }) {
  if (personName && companyName) return `site:linkedin.com/in "${personName}" "${companyName}"`
  if (personName) return `site:linkedin.com/in "${personName}"`
  if (companyName) return `site:linkedin.com/company "${companyName}"`
  return null
}

export async function searchLinkedIn(extracted, apiKey) {
  const query = buildLinkedInQuery(extracted || {})
  if (!query) return { status: 'skipped', error: '缺少人名和公司名' }

  const r = await serpSearch({ query, apiKey, num: 5 })
  if (!r.ok) return { status: 'failed', query, error: r.error }

  return {
    status: 'ok',
    query,
    found: r.results.length > 0,
    topResults: r.results,
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- test/intel/searches.test.js`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/intel/searches/linkedin.js test/intel/searches.test.js
git commit -m "feat(intel): add LinkedIn search with person/company fallback"
```

---

### Task 2.6: Search — `facebook.js`

**Files:**
- Create: `lib/intel/searches/facebook.js`
- Modify: `test/intel/searches.test.js`

- [ ] **Step 1: Append tests to `test/intel/searches.test.js`**

Append inside the existing file:

```js
import { buildFacebookQuery } from '@/lib/intel/searches/facebook'

describe('buildFacebookQuery', () => {
  it('prefers company name', () => {
    expect(buildFacebookQuery({ companyName: 'ABC Ltd', personName: 'x' }))
      .toBe('site:facebook.com "ABC Ltd"')
  })
  it('falls back to person name', () => {
    expect(buildFacebookQuery({ companyName: null, personName: 'Jane Doe' }))
      .toBe('site:facebook.com "Jane Doe"')
  })
  it('returns null with neither', () => {
    expect(buildFacebookQuery({})).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test -- test/intel/searches.test.js`
Expected: FAIL (import error).

- [ ] **Step 3: Create `lib/intel/searches/facebook.js`**

```js
import { serpSearch } from '@/lib/intel/serpapi'

export function buildFacebookQuery({ companyName, personName }) {
  if (companyName) return `site:facebook.com "${companyName}"`
  if (personName) return `site:facebook.com "${personName}"`
  return null
}

export async function searchFacebook(extracted, apiKey) {
  const query = buildFacebookQuery(extracted || {})
  if (!query) return { status: 'skipped', error: '缺少人名和公司名' }

  const r = await serpSearch({ query, apiKey, num: 5 })
  if (!r.ok) return { status: 'failed', query, error: r.error }

  return {
    status: 'ok',
    query,
    found: r.results.length > 0,
    topResults: r.results,
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test -- test/intel/searches.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/intel/searches/facebook.js test/intel/searches.test.js
git commit -m "feat(intel): add Facebook search"
```

---

### Task 2.7: Search — `panjiva.js`

**Files:**
- Create: `lib/intel/searches/panjiva.js`
- Modify: `test/intel/searches.test.js`

- [ ] **Step 1: Append tests**

Append:

```js
import { buildPanjivaQuery } from '@/lib/intel/searches/panjiva'

describe('buildPanjivaQuery', () => {
  it('requires company name', () => {
    expect(buildPanjivaQuery({ companyName: 'ABC Ltd' }))
      .toBe('site:panjiva.com "ABC Ltd"')
  })
  it('returns null without company name', () => {
    expect(buildPanjivaQuery({ personName: 'John' })).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test -- test/intel/searches.test.js`
Expected: FAIL.

- [ ] **Step 3: Create `lib/intel/searches/panjiva.js`**

```js
import { serpSearch } from '@/lib/intel/serpapi'

export function buildPanjivaQuery({ companyName }) {
  if (!companyName) return null
  return `site:panjiva.com "${companyName}"`
}

export async function searchPanjiva(extracted, apiKey) {
  const query = buildPanjivaQuery(extracted || {})
  if (!query) return { status: 'skipped', error: '缺少公司名' }

  const r = await serpSearch({ query, apiKey, num: 10 })
  if (!r.ok) return { status: 'failed', query, error: r.error }

  const resultCount = r.results.length
  return {
    status: 'ok',
    query,
    hasRecord: resultCount > 0,
    resultCount,
    topResults: r.results.slice(0, 5),
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test -- test/intel/searches.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/intel/searches/panjiva.js test/intel/searches.test.js
git commit -m "feat(intel): add Panjiva presence search"
```

---

### Task 2.8: Search — `negative.js`

**Files:**
- Create: `lib/intel/searches/negative.js`
- Modify: `test/intel/searches.test.js`

- [ ] **Step 1: Append tests**

```js
import { buildNegativeQuery } from '@/lib/intel/searches/negative'

describe('buildNegativeQuery', () => {
  it('combines company name and fraud keywords', () => {
    expect(buildNegativeQuery({ companyName: 'ABC Ltd' }))
      .toBe('"ABC Ltd" (scam OR fraud OR 骗 OR complaint)')
  })
  it('falls back to email when company missing', () => {
    expect(buildNegativeQuery({ email: 'a@b.com' }))
      .toBe('"a@b.com" (scam OR fraud OR 骗 OR complaint)')
  })
  it('falls back to person name', () => {
    expect(buildNegativeQuery({ personName: 'John Doe' }))
      .toBe('"John Doe" (scam OR fraud OR 骗 OR complaint)')
  })
  it('returns null with no identifier', () => {
    expect(buildNegativeQuery({})).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test -- test/intel/searches.test.js`
Expected: FAIL.

- [ ] **Step 3: Create `lib/intel/searches/negative.js`**

```js
import { serpSearch } from '@/lib/intel/serpapi'

const KEYWORDS = '(scam OR fraud OR 骗 OR complaint)'

export function buildNegativeQuery({ companyName, email, personName }) {
  const target = companyName || email || personName
  if (!target) return null
  return `"${target}" ${KEYWORDS}`
}

export async function searchNegative(extracted, apiKey) {
  const query = buildNegativeQuery(extracted || {})
  if (!query) return { status: 'skipped', error: '缺少公司名/邮箱/人名' }

  const r = await serpSearch({ query, apiKey, num: 5 })
  if (!r.ok) return { status: 'failed', query, error: r.error }

  return {
    status: 'ok',
    query,
    hitCount: r.results.length,
    hits: r.results,
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test -- test/intel/searches.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/intel/searches/negative.js test/intel/searches.test.js
git commit -m "feat(intel): add negative/fraud search"
```

---

### Task 2.9: Search — `general.js`

**Files:**
- Create: `lib/intel/searches/general.js`
- Modify: `test/intel/searches.test.js`

- [ ] **Step 1: Append tests**

```js
import { buildGeneralQuery } from '@/lib/intel/searches/general'

describe('buildGeneralQuery', () => {
  it('uses company name when present', () => {
    expect(buildGeneralQuery({ companyName: 'ABC Ltd' })).toBe('"ABC Ltd"')
  })
  it('returns null without company name', () => {
    expect(buildGeneralQuery({ personName: 'X' })).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test -- test/intel/searches.test.js`
Expected: FAIL.

- [ ] **Step 3: Create `lib/intel/searches/general.js`**

```js
import { serpSearch } from '@/lib/intel/serpapi'

export function buildGeneralQuery({ companyName }) {
  if (!companyName) return null
  return `"${companyName}"`
}

export async function searchGeneral(extracted, apiKey) {
  const query = buildGeneralQuery(extracted || {})
  if (!query) return { status: 'skipped', error: '缺少公司名' }

  const r = await serpSearch({ query, apiKey, num: 5 })
  if (!r.ok) return { status: 'failed', query, error: r.error }

  return {
    status: 'ok',
    query,
    topResults: r.results,
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test -- test/intel/searches.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/intel/searches/general.js test/intel/searches.test.js
git commit -m "feat(intel): add general company name search"
```

---

### Task 2.10: `format.js` (markdown briefing) with tests

**Files:**
- Create: `lib/intel/format.js`
- Create: `test/intel/format.test.js`

- [ ] **Step 1: Write failing tests**

Create `test/intel/format.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { formatIntelAsBriefing } from '@/lib/intel/format'

const okIntel = {
  extracted: {
    companyName: 'ABC Ltd',
    personName: 'John Smith',
    personTitle: 'Buyer',
    email: 'john@abc.com',
    phone: '+12345',
    country: 'US',
    products: ['LED'],
  },
  website: { status: 'ok', title: 'ABC Home', excerpt: 'hello world' },
  wayback: { status: 'ok', firstSnapshot: '2018-03-12', ageYears: 7 },
  linkedin: {
    status: 'ok',
    query: 'site:linkedin.com/in "John Smith" "ABC Ltd"',
    found: true,
    topResults: [{ title: 'John Smith - Buyer', link: 'https://linkedin.com/in/x', snippet: '...' }],
  },
  facebook: { status: 'ok', query: 'site:facebook.com "ABC Ltd"', found: false, topResults: [] },
  panjiva: { status: 'ok', query: 'site:panjiva.com "ABC Ltd"', hasRecord: true, resultCount: 12, topResults: [] },
  negative: { status: 'ok', query: '"ABC Ltd" (scam)', hitCount: 0, hits: [] },
  generalSearch: { status: 'ok', query: '"ABC Ltd"', topResults: [] },
}

describe('formatIntelAsBriefing', () => {
  it('includes all 8 section headers in order', () => {
    const md = formatIntelAsBriefing(okIntel)
    const positions = [
      '## 1. 抽取到的实体',
      '## 2. 公司网站',
      '## 3. 建站时间',
      '## 4. LinkedIn',
      '## 5. Facebook',
      '## 6. Panjiva',
      '## 7. 负面',
      '## 8. 通用搜索',
    ].map(h => md.indexOf(h))
    expect(positions.every(p => p >= 0)).toBe(true)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1])
    }
  })

  it('renders failed status explicitly', () => {
    const broken = { ...okIntel, linkedin: { status: 'failed', error: 'HTTP 500' } }
    const md = formatIntelAsBriefing(broken)
    expect(md).toMatch(/LinkedIn[\s\S]*失败[\s\S]*HTTP 500/)
  })

  it('renders skipped status explicitly', () => {
    const skipped = { ...okIntel, panjiva: { status: 'skipped', error: '缺少公司名' } }
    const md = formatIntelAsBriefing(skipped)
    expect(md).toMatch(/Panjiva[\s\S]*跳过[\s\S]*缺少公司名/)
  })

  it('handles null extracted', () => {
    const md = formatIntelAsBriefing({ ...okIntel, extracted: null })
    expect(md).toContain('未能识别')
  })
})
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test -- test/intel/format.test.js`
Expected: FAIL.

- [ ] **Step 3: Create `lib/intel/format.js`**

```js
// Pure function: convert an intel object into a human-readable markdown briefing
// that will be injected as the first block of the main LLM's user message.

function statusLine(section) {
  if (!section) return '- 状态:跳过(无数据)'
  if (section.status === 'failed') return `- 状态:❌ 失败(${section.error || '未知错误'})`
  if (section.status === 'skipped') return `- 状态:⊘ 跳过(${section.error || '无数据'})`
  return '- 状态:✓ 成功'
}

function renderResults(list) {
  if (!Array.isArray(list) || list.length === 0) return '  (无)'
  return list
    .map((r, i) => `  ${i + 1}. ${r.title || '(无标题)'} — ${r.link || ''}\n     ${r.snippet || ''}`)
    .join('\n')
}

export function formatIntelAsBriefing(intel) {
  if (!intel) return '# 实时情报简报\n\n(无情报数据)'

  const e = intel.extracted
  const lines = []
  lines.push('# 实时情报简报(系统自动检索,请作为判断依据)')
  lines.push('')

  // 1. extracted entities
  lines.push('## 1. 抽取到的实体')
  if (!e) {
    lines.push('- 未能识别')
  } else {
    lines.push(`- 公司名:${e.companyName || '未能识别'}`)
    lines.push(`- 联系人:${e.personName || '未识别'}${e.personTitle ? `(${e.personTitle})` : ''}`)
    lines.push(`- 邮箱:${e.email || '未识别'}`)
    lines.push(`- 电话:${e.phone || '未识别'}`)
    lines.push(`- 国家:${e.country || '未识别'}`)
    lines.push(`- 涉及产品:${(e.products && e.products.length) ? e.products.join(', ') : '未识别'}`)
  }
  lines.push('')

  // 2. website
  const w = intel.website || {}
  lines.push('## 2. 公司网站')
  lines.push(statusLine(w))
  if (w.status === 'ok') {
    lines.push(`- 标题:${w.title || '(无)'}`)
    lines.push(`- 正文摘录(前 800 字):`)
    lines.push(`  ${(w.excerpt || '').slice(0, 800).replace(/\n/g, ' ')}`)
  }
  lines.push('')

  // 3. wayback
  const wb = intel.wayback || {}
  lines.push('## 3. 建站时间(Wayback Machine)')
  lines.push(statusLine(wb))
  if (wb.status === 'ok') {
    if (wb.firstSnapshot) {
      lines.push(`- 最早快照:${wb.firstSnapshot}`)
      lines.push(`- 建站约 ${wb.ageYears} 年${wb.ageYears != null && wb.ageYears < 2 ? ' ⚠️ 不足 2 年' : ''}`)
    } else {
      lines.push('- Wayback 无任何快照记录(可能是非常新的站点或从未被归档)')
    }
  }
  lines.push('')

  // 4. linkedin
  const li = intel.linkedin || {}
  lines.push('## 4. LinkedIn 核验')
  lines.push(statusLine(li))
  if (li.status === 'ok') {
    lines.push(`- 查询:\`${li.query}\``)
    lines.push(`- 结果:${li.found ? `✓ 找到 ${li.topResults.length} 条` : '✗ 未找到'}`)
    if (li.found) lines.push(renderResults(li.topResults))
  }
  lines.push('')

  // 5. facebook
  const fb = intel.facebook || {}
  lines.push('## 5. Facebook 核验')
  lines.push(statusLine(fb))
  if (fb.status === 'ok') {
    lines.push(`- 查询:\`${fb.query}\``)
    lines.push(`- 结果:${fb.found ? `✓ 找到 ${fb.topResults.length} 条` : '✗ 未找到'}`)
    if (fb.found) lines.push(renderResults(fb.topResults))
  }
  lines.push('')

  // 6. panjiva
  const pj = intel.panjiva || {}
  lines.push('## 6. Panjiva 海关足迹')
  lines.push(statusLine(pj))
  if (pj.status === 'ok') {
    lines.push(`- 查询:\`${pj.query}\``)
    lines.push(`- 结果:${pj.hasRecord ? `✓ 搜到 ${pj.resultCount} 条相关记录` : '✗ 未发现海关记录'}`)
  }
  lines.push('')

  // 7. negative
  const ng = intel.negative || {}
  lines.push('## 7. 负面 / 诈骗搜索')
  lines.push(statusLine(ng))
  if (ng.status === 'ok') {
    lines.push(`- 查询:\`${ng.query}\``)
    lines.push(`- 结果:${ng.hitCount > 0 ? `⚠️ 发现 ${ng.hitCount} 条负面信息` : '✓ 未发现负面信息'}`)
    if (ng.hitCount > 0) lines.push(renderResults(ng.hits))
  }
  lines.push('')

  // 8. general
  const gs = intel.generalSearch || {}
  lines.push('## 8. 通用搜索')
  lines.push(statusLine(gs))
  if (gs.status === 'ok') {
    lines.push(`- 查询:\`${gs.query}\``)
    lines.push(`- 前 ${gs.topResults.length} 条结果:`)
    lines.push(renderResults(gs.topResults))
  }

  return lines.join('\n')
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test -- test/intel/format.test.js`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/intel/format.js test/intel/format.test.js
git commit -m "feat(intel): add markdown briefing formatter"
```

---

### Task 2.11: `index.js` — `gatherIntel` orchestrator

**Files:**
- Create: `lib/intel/index.js`

- [ ] **Step 1: Create module**

Create `lib/intel/index.js`:

```js
import { fetchWebsite } from '@/lib/intel/fetchWebsite'
import { waybackFirstSnapshot } from '@/lib/intel/wayback'
import { extractEntities } from '@/lib/intel/extract'
import { searchLinkedIn } from '@/lib/intel/searches/linkedin'
import { searchFacebook } from '@/lib/intel/searches/facebook'
import { searchPanjiva } from '@/lib/intel/searches/panjiva'
import { searchNegative } from '@/lib/intel/searches/negative'
import { searchGeneral } from '@/lib/intel/searches/general'

export { formatIntelAsBriefing } from '@/lib/intel/format'

export async function gatherIntel({ url, inquiry, apiKey, globalSettings, onProgress }) {
  const start = Date.now()
  const report = (obj) => { try { onProgress && onProgress(obj) } catch {} }

  // Stage 1 — parallel, name-independent
  const [website, wayback] = await Promise.all([
    fetchWebsite(url),
    waybackFirstSnapshot(url),
  ])
  report({ website, wayback })

  // Stage 2 — entity extraction
  const extractResult = await extractEntities({
    inquiry,
    websiteText: website.status === 'ok' ? website.excerpt : '',
    baseUrl: globalSettings.baseUrl,
    apiKey,
    model: globalSettings.extractionModel,
    systemPrompt: globalSettings.extractionPrompt,
  })
  const extracted = extractResult.extracted  // may be null
  report({ extracted, extractionStatus: extractResult.status })

  // If website returned a siteName but extraction missed companyName, fill it.
  const enriched = extracted
    ? {
        ...extracted,
        companyName: extracted.companyName || website.siteName || null,
      }
    : website.siteName
      ? { companyName: website.siteName, personName: null, email: null, products: [] }
      : null

  // Stage 3 — SerpAPI searches in parallel
  const serpKey = globalSettings.serpApiKey
  const [linkedin, facebook, panjiva, negative, generalSearch] = await Promise.all([
    searchLinkedIn(enriched, serpKey),
    searchFacebook(enriched, serpKey),
    searchPanjiva(enriched, serpKey),
    searchNegative(enriched, serpKey),
    searchGeneral(enriched, serpKey),
  ])
  report({ linkedin, facebook, panjiva, negative, generalSearch })

  const skipped = []
  for (const [k, v] of Object.entries({ linkedin, facebook, panjiva, negative, generalSearch })) {
    if (v.status === 'skipped') skipped.push(`${k} (${v.error})`)
  }

  return {
    extracted: enriched,
    website,
    wayback,
    linkedin,
    facebook,
    panjiva,
    negative,
    generalSearch,
    meta: {
      durationMs: Date.now() - start,
      skipped,
    },
  }
}
```

- [ ] **Step 2: Manual smoke test (with mock-ish inputs)**

This orchestrator hits network APIs, so a full run needs real keys. Do a dry import check:

Run: `node -e "import('./lib/intel/index.js').then(m => console.log(Object.keys(m)))"`
Expected: prints `[ 'formatIntelAsBriefing', 'gatherIntel' ]` with no import errors.

- [ ] **Step 3: Commit**

```bash
git add lib/intel/index.js
git commit -m "feat(intel): add gatherIntel orchestrator"
```

---

## Part 3 — API Integration

### Task 3.1: Rewrite `/api/analyze` route with pipeline + typed SSE events

**Files:**
- Modify: `src/app/api/analyze/route.js`

- [ ] **Step 1: Replace the file with the new pipeline version**

Replace entire `src/app/api/analyze/route.js` with:

```js
export const dynamic = 'force-dynamic'

import { requireSession } from '@/lib/auth'
import { getGlobalSettings, getUserSettings, saveQuery } from '@/lib/kv'
import { gatherIntel, formatIntelAsBriefing } from '@/lib/intel'

export async function POST(req) {
  const { session, error, status } = await requireSession()
  if (error) return Response.json({ error }, { status })

  let body
  try { body = await req.json() }
  catch { return Response.json({ error: '请求格式错误' }, { status: 400 }) }

  const { url, inquiry, images = [], enableIntel = true } = body
  if (!url?.trim() && !inquiry?.trim() && images.length === 0) {
    return Response.json({ error: '请填写信息或上传图片' }, { status: 400 })
  }

  const [globalSettings, userSettings] = await Promise.all([
    getGlobalSettings(),
    getUserSettings(session.email),
  ])

  const baseUrl = globalSettings.baseUrl?.trim()
  const apiKey = userSettings.apiKey?.trim()
  const modelName = userSettings.modelName?.trim() || 'gemini-3.1-pro-preview-vertex'

  if (!baseUrl) return Response.json({ error: '管理员尚未配置 Base URL' }, { status: 503 })
  if (!apiKey) return Response.json({ error: '请先在【设置】中填写您的 API Key' }, { status: 400 })
  if (enableIntel && !globalSettings.serpApiKey?.trim()) {
    return Response.json({ error: '管理员尚未配置 SerpAPI Key,请关闭"实时情报检索"后重试' }, { status: 503 })
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const HEARTBEAT_INTERVAL = 8000

  const stream = new ReadableStream({
    async start(controller) {
      let heartbeatTimer = null
      const enqueue = (obj) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)) } catch {}
      }
      const enqueueRaw = (s) => {
        try { controller.enqueue(encoder.encode(s)) } catch {}
      }
      heartbeatTimer = setInterval(() => enqueueRaw(': ping\n\n'), HEARTBEAT_INTERVAL)

      // ── Stage 1-3: intel ─────────────────────────────────────────────────
      let intel = null
      if (enableIntel) {
        try {
          intel = await gatherIntel({
            url,
            inquiry,
            apiKey,
            globalSettings,
            onProgress: (partial) => enqueue({ type: 'intel', partial }),
          })
          enqueue({ type: 'intelDone', intel })
        } catch (e) {
          enqueue({ type: 'intelError', error: e.message || String(e) })
          intel = null
        }
      }

      // ── Stage 4: main LLM ────────────────────────────────────────────────
      const useBriefing = !!intel
      const systemPrompt = useBriefing
        ? globalSettings.systemPrompt
        : globalSettings.fallbackSystemPrompt

      const briefing = useBriefing ? formatIntelAsBriefing(intel) : ''
      const textPart =
        (briefing ? `${briefing}\n\n---\n\n` : '') +
        `**公司网址：** ${url || '未提供'}\n\n**询盘详细信息：**\n${inquiry || '未提供'}`

      let userContent
      if (images.length > 0) {
        userContent = [
          { type: 'text', text: textPart },
          ...images.map(img => ({
            type: 'image_url',
            image_url: {
              url: `data:${img.type || 'image/jpeg'};base64,${img.base64}`,
              detail: 'high',
            },
          })),
        ]
      } else {
        userContent = textPart
      }

      const endpoint = baseUrl.replace(/\/$/, '') + '/chat/completions'

      let upstreamRes
      try {
        upstreamRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            stream: true,
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              { role: 'user', content: userContent },
            ],
          }),
        })
      } catch (e) {
        enqueue({ type: 'error', error: `无法连接到 API：${e.message}` })
        clearInterval(heartbeatTimer)
        try { controller.close() } catch {}
        return
      }

      if (!upstreamRes.ok) {
        let detail = ''
        try { detail = await upstreamRes.text() } catch {}
        try { detail = JSON.parse(detail)?.error?.message || detail } catch {}
        enqueue({ type: 'error', error: `API 错误 ${upstreamRes.status}：${String(detail).slice(0, 300)}` })
        clearInterval(heartbeatTimer)
        try { controller.close() } catch {}
        return
      }

      const reader = upstreamRes.body.getReader()
      let fullText = ''
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content || ''
              if (delta) {
                fullText += delta
                enqueue({ type: 'delta', delta })
              }
            } catch {}
          }
        }
      } catch (e) {
        enqueue({ type: 'error', error: `流中断：${e.message}` })
      } finally {
        clearInterval(heartbeatTimer)

        if (fullText) {
          const riskLevel = fullText.includes('高风险') ? 'high'
            : fullText.includes('中风险') ? 'medium'
            : fullText.includes('低风险') ? 'low'
            : 'unknown'

          enqueue({ type: 'done', result: fullText, riskLevel, intel })

          saveQuery({
            userEmail: session.email,
            url: url?.trim() || '',
            inquiry: inquiry?.trim() || '',
            hasImages: images.length > 0,
            imageCount: images.length,
            result: fullText,
            riskLevel,
            createdAt: new Date().toISOString(),
            model: modelName,
            intel,
            intelEnabled: enableIntel,
          }).catch(() => {})
        } else {
          enqueue({ type: 'error', error: 'AI 返回空内容,请检查 Model Name 是否正确' })
        }
        try { controller.close() } catch {}
      }
    },
    cancel() {}
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: builds successfully (ignore warnings about missing env vars for Redis if present).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analyze/route.js
git commit -m "feat(api): rewrite /api/analyze as 4-stage intel pipeline with typed SSE"
```

---

### Task 3.2: Update `/api/settings` route to handle new fields + expose usage

**Files:**
- Modify: `src/app/api/settings/route.js`

- [ ] **Step 1: Replace the file**

```js
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import {
  getGlobalSettings,
  saveGlobalSettings,
  getUserSettings,
  saveUserSettings,
  getSerpUsage,
} from '@/lib/kv'

// GET: admin gets global + own; user gets their own apiKey/modelName
export async function GET() {
  const { session, error, status } = await requireSession()
  if (error) return NextResponse.json({ error }, { status })

  if (session.role === 'admin') {
    const [global, userOwn, serpUsage] = await Promise.all([
      getGlobalSettings(),
      getUserSettings(session.email),
      getSerpUsage(),
    ])
    return NextResponse.json({
      ...global,
      ...userOwn,
      serpUsage,
      role: 'admin',
    })
  } else {
    const userOwn = await getUserSettings(session.email)
    return NextResponse.json({ ...userOwn, role: 'user' })
  }
}

export async function POST(req) {
  const { session, error, status } = await requireSession()
  if (error) return NextResponse.json({ error }, { status })

  const data = await req.json()

  if (session.role === 'admin') {
    await saveGlobalSettings({
      baseUrl: data.baseUrl,
      systemPrompt: data.systemPrompt,
      fallbackSystemPrompt: data.fallbackSystemPrompt,
      serpApiKey: data.serpApiKey,
      extractionModel: data.extractionModel,
      extractionPrompt: data.extractionPrompt,
    })
    await saveUserSettings(session.email, { apiKey: data.apiKey, modelName: data.modelName })
  } else {
    await saveUserSettings(session.email, { apiKey: data.apiKey, modelName: data.modelName })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: builds successfully.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/settings/route.js
git commit -m "feat(api): expose and persist extended global settings + serp usage"
```

---

## Part 4 — Frontend

Each Part 4 task modifies `src/app/page.js`. The file is large; the plan gives exact locations by line-number range observed during design (may drift ±5 lines after earlier edits — use Grep to confirm).

### Task 4.1: Add `enableIntel` toggle state and UI

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: Add the state hook**

Find (around line 413):

```js
const [fieldErrors, setFieldErrors] = useState({})
```

Immediately after it, add:

```js
const [enableIntel, setEnableIntel] = useState(() => {
  if (typeof window === 'undefined') return true
  const v = window.localStorage.getItem('trade-check:enableIntel')
  return v === null ? true : v === 'true'
})
const [intel, setIntel] = useState(null)
const [intelProgress, setIntelProgress] = useState({}) // merged partials

useEffect(() => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('trade-check:enableIntel', String(enableIntel))
  }
}, [enableIntel])
```

If the file does not already import `useEffect`, update the React import at the top of the file to include it (use Grep to confirm the current import line first).

- [ ] **Step 2: Add the checkbox to the submit button row**

Find the submit button (Grep for `点击分析` or similar, confirm location). Immediately before the submit button, insert:

```jsx
<label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textSecondary, marginRight: 12, cursor: 'pointer', userSelect: 'none' }}>
  <input
    type="checkbox"
    checked={enableIntel}
    onChange={(e) => setEnableIntel(e.target.checked)}
    disabled={loading || streaming}
  />
  启用实时情报检索
</label>
```

- [ ] **Step 3: Include the flag in the analyze request body**

In the `fetch('/api/analyze', ...)` call (around line 474), change the body to:

```js
body: JSON.stringify({
  url,
  inquiry,
  images: images.map(img => ({ base64: img.base64, type: img.type })),
  enableIntel,
}),
```

- [ ] **Step 4: Reset intel state on new submission**

At the top of the submit handler (around line 460, next to `setResult('')`), add:

```js
setIntel(null)
setIntelProgress({})
```

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`, open the page, confirm:
- Checkbox appears, persists across reload (localStorage)
- Submitting with the checkbox off still works (current behavior)

- [ ] **Step 6: Commit**

```bash
git add src/app/page.js
git commit -m "feat(ui): add enableIntel toggle with localStorage persistence"
```

---

### Task 4.2: Update SSE reader to dispatch by `type`

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: Replace the inner stream loop**

Find the block that parses SSE (lines ~486-510). Replace the `for (const line of lines)` body with:

```js
for (const line of lines) {
  if (!line.startsWith('data: ')) continue
  const raw = line.slice(6).trim()
  if (raw === '') continue
  let msg
  try { msg = JSON.parse(raw) }
  catch (e) { if (e.message !== 'Unexpected end of JSON input') throw e; continue }

  // Back-compat: legacy messages that have `delta` but no `type`
  const type = msg.type || (msg.delta ? 'delta' : msg.error ? 'error' : null)

  if (type === 'error' || type === 'intelError') {
    throw new Error(msg.error || '未知错误')
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
```

- [ ] **Step 2: Smoke test**

Run: `npm run dev`; submit a request with intel enabled (requires SerpAPI + baseUrl + apiKey configured). Observe:
- Console shows no parse errors
- `intel` state becomes populated (add `console.log` temporarily if needed, remove before commit)
- Main analysis still streams after intel

- [ ] **Step 3: Commit**

```bash
git add src/app/page.js
git commit -m "feat(ui): dispatch SSE events by type with intel handlers"
```

---

### Task 4.3: Add intel panel component above the result

**Files:**
- Modify: `src/app/page.js`

- [ ] **Step 1: Add a helper component at module scope**

Near the top of `page.js` (after `function extractScore(...)` around line 292), add:

```js
function IntelCard({ title, section, children }) {
  const status = section?.status
  const color =
    status === 'ok' ? '#1a7f37' :
    status === 'failed' ? '#cf222e' :
    status === 'skipped' ? '#6e7781' :
    '#848d97'
  const label =
    status === 'ok' ? '✓ 已获取' :
    status === 'failed' ? '✗ 失败' :
    status === 'skipped' ? '⊘ 跳过' :
    '… 加载中'
  return (
    <div style={{
      border: '1px solid #d0d7de', borderRadius: 8, padding: 12,
      background: '#fff', fontSize: 13,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <strong>{title}</strong>
        <span style={{ color, fontSize: 12 }}>{label}</span>
      </div>
      <div style={{ color: '#57606a' }}>{children}</div>
    </div>
  )
}

function IntelPanel({ intel }) {
  if (!intel) return null
  const e = intel.extracted || {}
  return (
    <div style={{ border: '1px solid #d0d7de', borderRadius: 12, padding: 16, background: '#f6f8fa', marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: '#57606a', marginBottom: 10 }}>
        🔍 实时情报({intel.meta?.durationMs ? `${intel.meta.durationMs}ms` : '…'})
      </div>
      {e && (e.companyName || e.personName || e.email) && (
        <div style={{ fontSize: 12, color: '#24292f', marginBottom: 10 }}>
          <b>识别实体:</b>
          {e.companyName && <> 公司:{e.companyName}</>}
          {e.personName && <> · 人:{e.personName}{e.personTitle ? `(${e.personTitle})` : ''}</>}
          {e.email && <> · 邮箱:{e.email}</>}
          {e.country && <> · 国家:{e.country}</>}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
        <IntelCard title="公司网站" section={intel.website}>
          {intel.website?.title || intel.website?.error || '—'}
        </IntelCard>
        <IntelCard title="建站时间" section={intel.wayback}>
          {intel.wayback?.firstSnapshot
            ? `最早快照 ${intel.wayback.firstSnapshot} (约 ${intel.wayback.ageYears} 年)`
            : intel.wayback?.error || '无记录'}
        </IntelCard>
        <IntelCard title="LinkedIn" section={intel.linkedin}>
          {intel.linkedin?.status === 'ok'
            ? (intel.linkedin.found ? `找到 ${intel.linkedin.topResults.length} 条` : '未找到')
            : intel.linkedin?.error || '—'}
          {intel.linkedin?.topResults?.slice(0, 2).map((r, i) => (
            <div key={i} style={{ marginTop: 4 }}>
              <a href={r.link} target="_blank" rel="noreferrer">{r.title}</a>
            </div>
          ))}
        </IntelCard>
        <IntelCard title="Facebook" section={intel.facebook}>
          {intel.facebook?.status === 'ok'
            ? (intel.facebook.found ? `找到 ${intel.facebook.topResults.length} 条` : '未找到')
            : intel.facebook?.error || '—'}
        </IntelCard>
        <IntelCard title="Panjiva 海关足迹" section={intel.panjiva}>
          {intel.panjiva?.status === 'ok'
            ? (intel.panjiva.hasRecord ? `搜到 ${intel.panjiva.resultCount} 条` : '未发现')
            : intel.panjiva?.error || '—'}
        </IntelCard>
        <IntelCard title="负面 / 诈骗搜索" section={intel.negative}>
          {intel.negative?.status === 'ok'
            ? (intel.negative.hitCount > 0 ? `⚠️ 发现 ${intel.negative.hitCount} 条` : '未发现')
            : intel.negative?.error || '—'}
          {intel.negative?.hits?.slice(0, 2).map((r, i) => (
            <div key={i} style={{ marginTop: 4 }}>
              <a href={r.link} target="_blank" rel="noreferrer">{r.title}</a>
            </div>
          ))}
        </IntelCard>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Render the panel above the main result**

Find the JSX block that renders the analysis result (Grep for `resultRef` or the container that wraps `result`). Immediately before it, insert:

```jsx
{(intel || Object.keys(intelProgress).length > 0) && (
  <IntelPanel intel={intel || intelProgress} />
)}
```

- [ ] **Step 3: Smoke test**

Run: `npm run dev`, submit with intel enabled, confirm cards render and update progressively; confirm LinkedIn/Panjiva/etc links are clickable.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.js
git commit -m "feat(ui): render real-time intel panel above analysis result"
```

---

### Task 4.4: Settings drawer — new admin fields + SerpAPI usage display

**Files:**
- Modify: `src/app/page.js` (settings drawer section around line 879-1010)

- [ ] **Step 1: Extend the settings form state**

Find (around line 879):

```js
const [form, setForm] = useState({ baseUrl: '', systemPrompt: '', apiKey: '', modelName: 'gemini-3.1-pro-preview-vertex' })
```

Replace with:

```js
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
```

- [ ] **Step 2: Populate new fields when the GET response arrives**

Find the settings fetch (Grep for `/api/settings`). Where the form is hydrated from the response, change it to also copy the new fields and `serpUsage`. Example:

```js
const data = await res.json()
setForm(f => ({
  ...f,
  baseUrl: data.baseUrl ?? '',
  systemPrompt: data.systemPrompt ?? '',
  fallbackSystemPrompt: data.fallbackSystemPrompt ?? '',
  serpApiKey: data.serpApiKey ?? '',
  extractionModel: data.extractionModel ?? 'gemini-2.5-flash',
  extractionPrompt: data.extractionPrompt ?? '',
  apiKey: data.apiKey ?? '',
  modelName: data.modelName ?? f.modelName,
}))
if (data.serpUsage) setSerpUsage(data.serpUsage)
```

- [ ] **Step 3: Include new fields in the POST body**

Find the settings save handler. Ensure the POST body sends all the new fields:

```js
body: JSON.stringify({
  baseUrl: form.baseUrl,
  systemPrompt: form.systemPrompt,
  fallbackSystemPrompt: form.fallbackSystemPrompt,
  serpApiKey: form.serpApiKey,
  extractionModel: form.extractionModel,
  extractionPrompt: form.extractionPrompt,
  apiKey: form.apiKey,
  modelName: form.modelName,
}),
```

- [ ] **Step 4: Add admin-only fields to the drawer JSX**

Find the admin section (after the existing `systemPrompt` textarea, around line 998-1000). After it, insert:

```jsx
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
```

- [ ] **Step 5: Smoke test**

Run: `npm run dev`, log in as admin, open settings drawer:
- New fields appear
- SerpAPI Key saves and round-trips (reload drawer, field re-populates masked)
- Usage counter shows `本月已调用 0 次 (YYYY-MM)` before any analyze

- [ ] **Step 6: Commit**

```bash
git add src/app/page.js
git commit -m "feat(ui): add admin settings fields for intel retrieval + usage display"
```

---

### Task 4.5: History panel — render intel on historical records

**Files:**
- Modify: `src/app/page.js` (history panel around lines 700-870)

- [ ] **Step 1: Parse stored intel JSON**

Find where a selected history record is rendered (Grep for `selected`). Before rendering, add:

```js
const parsedIntel = (() => {
  if (!selected?.intel) return null
  if (typeof selected.intel === 'string') {
    try { return JSON.parse(selected.intel) } catch { return null }
  }
  return selected.intel
})()
const historyIntelEnabled = selected?.intelEnabled === 'true' || selected?.intelEnabled === true
```

- [ ] **Step 2: Render `<IntelPanel>` above the historical result**

Inside the history detail view, before the block that renders the text result, insert:

```jsx
{historyIntelEnabled && parsedIntel && <IntelPanel intel={parsedIntel} />}
```

- [ ] **Step 3: Smoke test**

Open an old history record (created before this change) — panel should not appear.
Create a new analysis with intel enabled — reopen it in history — panel should appear with the same cards as the live run.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.js
git commit -m "feat(ui): render intel panel for historical queries"
```

---

## Part 5 — Verification

### Task 5.1: Run full test suite

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: all vitest files pass. No failures.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: successful build.

---

### Task 5.2: Manual end-to-end test

- [ ] **Step 1: Pre-requisites**

In the admin settings drawer, set:
- `baseUrl`
- `apiKey` + `modelName` (main model, e.g. gemini-3.1-pro)
- `serpApiKey`
- `extractionModel` (e.g. gemini-2.5-flash)

- [ ] **Step 2: Happy path — intel enabled**

Submit a real analysis with a legitimate public company URL + a paragraph of inquiry text.
Verify:
- Intel panel appears within ~5 seconds showing cards progressively lighting up
- Main analysis streams after intel completes
- Final report visibly references the intel sections (e.g. "根据简报第 4 节 LinkedIn...")
- Risk badge (低/中/高) still renders
- Reopening from history shows intel panel

- [ ] **Step 3: Toggle off path**

Disable the "启用实时情报检索" checkbox, submit again.
Verify:
- No intel panel renders
- Main analysis uses the fallback 5-dimension prompt (structure differs from intel version)
- History record for this run does **not** show intel panel when reopened

- [ ] **Step 4: Failure path**

Temporarily set `serpApiKey` to an invalid value, submit with intel enabled.
Verify:
- Request is rejected at the API validation step with a clear error, **or**
- If the key is accepted but SerpAPI returns 401, the intel panel shows all SerpAPI cards as failed (red), Wayback and website cards still succeed, and the main analysis explicitly states "该维度数据缺失,无法作为依据" for the failed searches.

- [ ] **Step 5: SerpAPI counter**

After 2-3 runs, reopen the settings drawer. Confirm the monthly counter reflects the calls made.

---

## Self-Review Notes (performed by plan author)

- Spec §2–§16 each map to one or more tasks above. Section §15 (implementation order) follows the part numbering 0→1→2→3→4→5.
- No "TBD" / "implement later" / "add error handling" placeholders remain; every step shows full code for the change it describes.
- Function names are consistent across tasks: `gatherIntel`, `formatIntelAsBriefing`, `fetchWebsite`, `waybackFirstSnapshot`, `extractEntities`, `parseExtractionJson`, `serpSearch`, `searchLinkedIn`/`Facebook`/`Panjiva`/`Negative`/`General`, and their `build*Query` helpers.
- Field names `intel.generalSearch` (not `general`) are used consistently in orchestrator, formatter, tests, and frontend.
- `incrSerpUsage` is used fire-and-forget inside `serpSearch` — this matches §5.3 of the spec.
- `fallbackSystemPrompt` is read by analyze route only when `intel` is null (toggle off OR intel failure), matching §12 + §8 + §10 of the spec.

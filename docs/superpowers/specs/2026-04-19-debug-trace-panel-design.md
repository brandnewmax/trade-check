# Debug Trace 面板 — 设计文档

**日期:** 2026-04-19
**状态:** 设计待确认
**影响范围:** `lib/logger.js`（扩展）、新增 `lib/debug.js`、新增 API `src/app/api/admin/trace/*`、新增 Next.js 路由 `src/app/admin/traces/*`（独立 chrome，仅复用 Tailwind 设计 token）、`src/app/page.js` 增加 1 个 admin-only Debug NavItem（点击 `router.push('/admin/traces')`）、现有 route / intel 文件加若干纯新增 log 调用
**对业务逻辑的改动:** 零。现有任何业务语句、分支、返回值一律不改动，只在函数体空隙处 append 新的 `log.xxx()` 调用。`src/app/page.js` 只是追加一条 NavItem，现有 3 条 NavItem 和整个 Layout 字节级不改。Debug 页面有自己独立的调试优化 chrome，不共用 Layout / NavItem / Logo，仅复用 `tailwind.config.js` 的设计 token（颜色、字号、圆角）。

---

## 1. 背景与目标

### 起因

一起线上事故（request_id `req_sn_a`）：来自 StarSeed Packaging 官网表单的印度客户询盘，AI 背调目标被错误锁定为自家域名 `starseedpkg.com`。排查这个 bug 花了大量时间去手工拼接 Vercel stdout 日志来复原请求链路。

运营团队目前无法独立追查此类事故：
- 日志只在 Vercel 控制台 stdout 里滚动，保留时间和搜索能力都有限
- 每条节点事件是一行字符串，没有跨节点的完整时间线视图
- payload 被 `previewText()` 截成 120 字预览，无法看到完整输入输出
- 无列表、无筛选、无法按状态定位失败请求

### 目标

给 algo 运营和研发一个"n8n-lite"式的请求级调试面板：

1. **列表页**：按日期/状态/route 筛选任意一天的请求
2. **详情页**：一条请求从入口到结束的**每一个节点的完整输入和输出**
3. **原文可见**：询盘原文、company_profile 原文、图片、LLM 完整 prompt/response、OCR 完整转录、intel 完整 JSON
4. **运营自服务**：打开浏览器就能查，不需要研发支持
5. **可关闭**：一个环境变量就能全站关掉，零业务改动

### 非目标（本 PR 明确不做）

- **不修任何业务 bug**。包括本次引出此 PR 的 background-check bug — 留给后续 PR 由修 bug 的同学基于这里的 trace 数据验证修复效果
- 不做 n8n 那种 DAG 拓扑可视化（节点连线图），只做 vertical timeline
- 不做 trace 对比（同一 route 两次运行的 diff）
- 不做 trace 重放（re-run）
- 不改 `lib/obs.js`，不改 obs 的"只存 hash"规则，两条通道完全隔离
- 不引入 Postgres / Neon / Blob 等新基建，沿用 Upstash Redis

---

## 2. 范围

### In scope

- 新增 `lib/debug.js`：Redis 写入器 + trace 组装逻辑 + 开关判断
- 扩展 `lib/logger.js`：增加一个 sink 钩子，`createLogger` 每次调用除 stdout 之外额外把事件交给 `debug.js`（受 ENV 开关控制）
- 在三个 route 文件（`/api/analyze`、`/api/v1/analyze`、`/api/v1/profile`）和若干 intel 节点文件的函数体**空隙**处，**纯新增** log 调用以捕获原文（例如 `log.info('raw_inputs', {...})`、`log.info('llm_request', {...})`、`log.info('llm_response', {...})`）。**不删不改任何现有代码**
- 新增 `/api/admin/trace`（列表）和 `/api/admin/trace/:requestId`（详情）JSON API，admin-only
- 新增真实 Next.js 路由：
  - `/admin/traces` —— 列表页
  - `/admin/traces/[requestId]` —— 详情页
  - `src/app/admin/layout.js` —— admin 鉴权拦截 + debug 风格的顶栏
- 主应用 `src/app/page.js` 侧边栏追加一条 admin-only 的 `Debug` NavItem（和「分析 / 历史 / 设置」视觉一致），点击 `router.push('/admin/traces')`。除此之外 `page.js` 其他内容一字不改
- Debug 页面**独立 chrome，为调试优化交互**（不共用主应用 Layout / NavItem / Logo）：
  - 顶栏：Logo 小图标 + "Debug Trace" 标题 + "← 返回主页"链接 + 用户邮箱 + 登出
  - 主区满宽，不占左侧栏空间，给密集列表和长 timeline 留出版面
  - 视觉调性统一靠复用 Tailwind 设计 token：`text-stripe-navy` / `border-stripe-border` / `rounded-stripe-sm` / `text-stripe-purple` / `bg-stripe-purpleLight` 等
- 环境变量开关：`DEBUG_TRACE_ENABLED`、`DEBUG_TRACE_TTL_DAYS`、`DEBUG_TRACE_MAX_PAYLOAD_KB`、`DEBUG_TRACE_MAX_IMAGE_KB`
- 单元测试 + 鉴权测试

### Out of scope

- 任何业务 bug 修复（**明确包括 background-check bug**）
- 图片超出 256 KB 的 Blob 外挂存储（本 PR 只做内联截断，外挂走后续 PR）
- DAG 可视化、run diff、re-run
- trace 数据导出（CSV / JSON 下载）
- 告警（失败率、P95 时长超过阈值的推送通知）
- 多租户视图（本 PR 里 admin 看的是全站 trace，不按 user 分）

---

## 3. 用户故事

1. **运营 Alice** 收到客户反馈"我提交的询盘背调结果不对"。她拿到客户截图上的提交时间，打开 `/admin/traces`，按日期筛选，按时间和 email/来源页面反查，定位到 `request_id=req_sn_a`。点进详情，从上到下看每个节点的输入输出，发现在 `intel/extract` 节点 LLM 正常返回 `companyUrl: null`，但随后 regex fallback 节点输出了 `https://starseedpkg.com` —— 她直接截图发给研发，提了一条工单。
2. **研发 Bob** 接到工单后，在详情页展开 `intel/extract` 的 `fallback` 事件，看到输入的 `combinedText` 完整包含"来源页面 https://www.starseedpkg.com/..."，一眼判定是 regex 没过滤 referer label。修 bug 的 PR 合并后，他再跑一条同构的询盘，新的 trace 里 fallback 节点变成 `skipped`，确认修复成功。
3. **值班工程师 Carol** 在列表页按状态 = `error` 筛选今天的请求，快速定位 P0 事故；按 route 筛选 `v1/profile` 看有没有上游模型异常导致的失败潮。
4. **ENV 关闭场景**：某天 Redis 成本异常，运维在 Vercel 环境变量里把 `DEBUG_TRACE_ENABLED` 设为 `false`，面板立即 503，新请求不再写 trace，旧数据按 TTL 自然过期。业务零感知。

---

## 4. 架构总览

```
HTTP 请求
   ↓
route handler（零改动流程，加 N 条 log.info）
   ├─ runWithRequestContext({ requestId, route })
   ├─ log.start(...)  ─┐
   ├─ log.info('raw_inputs', { inquiry_text, company_profile, images_meta })（新增）
   ├─ ... 现有业务逻辑一行不改 ...
   ├─ log.info('llm_request', { messages, model })（新增）
   ├─ log.info('llm_response', { content, tokens })（新增）
   └─ log.ok(...) / log.fail(...)  ─┤
                                    │
                                    ▼
logger.js createLogger(tag) 每条调用:
   1. 原有 console.log() 保持不变
   2. 新增 sink.emit({ tag, event, level, payload, ctx }) —— Promise.resolve().then() 异步调用，永不抛错
                                    │
                                    ▼
lib/debug.js:
   - if !DEBUG_TRACE_ENABLED → 全部 noop
   - 识别 tag.startsWith('route/') 的 start 事件 → Redis hset meta + zadd index（开 trace）
   - 识别 tag.startsWith('route/') 的 ok/fail 事件 → Redis hset meta update（关 trace）
   - 其余事件 → Redis rpush debug:trace:<date>:<rid> 一条节点事件 JSON
   - payload 超 8KB 自动截断，图片 base64 超 256KB 自动截断
   - 所有 Redis 操作失败只 console.warn，不抛
                                    │
                                    ▼
Upstash Redis（和 obs:/user:/global_settings 键空间完全隔离）:
   debug:meta:<YYYYMMDD>:<rid>    ─ 请求摘要 hash
   debug:trace:<YYYYMMDD>:<rid>   ─ 节点事件 list
   debug:index:<YYYYMMDD>         ─ 按 start_ms 排序的 requestId sorted set
   全部 TTL = 14 天
                                    │
                                    ▼
/api/admin/trace（GET, admin-only）
   ├─ 列表: 指定日期 → 读 sorted set 分页 + batch hget meta → 返回摘要数组
   └─ 详情: requestId → hget meta + lrange trace → 返回完整 JSON
                                    │
                                    ▼
/admin/traces（SSR 页面, admin-only）
   ├─ 列表页: 日期选择器 + 状态/route/时长过滤 + 表格
   └─ 详情页: meta 卡片 + 输入区 + vertical timeline + 末尾 LLM 输出全文
```

---

## 5. 数据模型

### 5.1 Redis 键空间

```
debug:meta:<YYYYMMDD>:<requestId>   hash, TTL 14d
debug:trace:<YYYYMMDD>:<requestId>  list, TTL 14d
debug:index:<YYYYMMDD>              zset, score=startMs, member=requestId, TTL 14d
```

`<YYYYMMDD>` 使用 UTC 日期（和 obs.js 一致）。跨天的请求按开始时间落在当天。

### 5.2 meta hash 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `requestId` | string | uuid v4 |
| `route` | string | `v1/analyze` / `analyze` / `v1/profile` 等 |
| `scanMode` | string | `online` / `offline` / null |
| `enableIntel` | bool-like string | "true"/"false" |
| `inputHash` | string | SHA-256 of inquiry（来自 obs.js 同款函数，用于和 obs 通道串联） |
| `inquiryText` | string | **原文**，不 hash（本通道突破 obs 规则） |
| `companyProfile` | string | 原文 |
| `inquiryImages` | JSON string | 数组：`[{type, size, sha256, url?, base64?, truncated?}]` |
| `startMs` | number | 请求开始时间戳 |
| `endMs` | number \| null | 请求结束时间戳（success/error 都更新） |
| `durationMs` | number \| null | |
| `status` | string | `running` / `success` / `error` |
| `errorCode` | string \| null | `auth` / `config` / `llm` / `internal` 等 |
| `riskLevel` | string \| null | `high` / `medium` / `low` |
| `scores` | JSON string \| null | `{ inquiry, customer, match, strategy }` |
| `model` | string \| null | |
| `tokens` | JSON string \| null | `{ prompt, completion }` |
| `caller` | string \| null | 外部 API 调用方标识（用于 B2B 集成） |

### 5.3 trace list 每条事件

```js
{
  seq: number,         // 自增，从 1 开始
  ts: number,          // 毫秒时间戳
  tag: string,         // createLogger 的 tag，如 'intel/extract' / 'route/v1-analyze'
  event: string,       // start/ok/fail/skip/fallback/warn/info 或自定义
  level: 'info'|'warn'|'error',
  payload: object,     // redact 后的完整 JSON，超 8KB 截断
  truncated: boolean,  // payload 是否被截断
  payloadSize: number, // 原始字节数
}
```

### 5.4 index sorted set

每条 key 是日期。score 是该请求 `startMs`，member 是 requestId。用于列表页按时间倒序分页。

---

## 6. 关键组件

### 6.1 `lib/debug.js`（新建，~220 行）

导出：
- `isTraceEnabled(): boolean` —— 读 ENV
- `startTrace(ctx, meta)` —— hset meta + zadd index
- `endTrace(ctx, outcome)` —— hset meta 终态
- `recordEvent(ctx, tag, event, level, info)` —— rpush trace
- `fetchTraceList({ date, status, route, limit, cursor })` —— 列表查询
- `fetchTraceDetail(requestId)` —— 详情查询

所有写入：
- 通过 `Promise.resolve().then(() => ...).catch(e => console.warn(...))` 包裹
- 失败永不抛出、永不阻塞调用方

### 6.2 `lib/logger.js`（扩展，~30 行新增）

保持现有 API 100% 兼容。新增：

```js
import { recordEvent, isTraceEnabled } from './debug.js'

// 在 createLogger 内部 build() 调用后：
if (isTraceEnabled()) {
  const ctx = getRequestContext()
  if (ctx.requestId) {
    recordEvent(ctx, tag, event, level, info).catch(() => {})
  }
}
```

`recordEvent` 内部识别 `tag.startsWith('route/')` 的 `start` / `ok` / `fail` 事件触发 `startTrace` / `endTrace`。这样 route 文件**一行都不用动**。

### 6.3 现有 route 和 intel 文件的纯新增 log 调用

按 B 方案约定，**不删不改任何现有代码**，只在函数体空隙 append 新调用。新增点清单（预估 ~25-30 行）：

**`src/app/api/v1/analyze/route.js`**
- `normalizeRequest` 返回后：`log.info('raw_inputs', { inquiry_text, company_profile, inquiry_images_meta })`
- LLM 请求发出前：`log.info('llm_request', { model, messages, useBriefing })`
- LLM 响应收到后：`log.info('llm_response', { content: fullText, tokens, usage })`

**`src/app/api/analyze/route.js`**
- 同上三条

**`src/app/api/v1/profile/route.js`**
- 同上模式（原文网站、LLM 请求、LLM 响应）

**`lib/intel/extract.js`**
- `transcribeImages` 的 `ocr_ok` 后追加：`log.info('ocr_full', { text })`（现有 `ocr_ok` 只存前 200 字）
- `extractEntities` 的 LLM 请求前：`log.info('extract_llm_request', { messages })`
- LLM 响应后：`log.info('extract_llm_response', { content })`
- fallback 触发时：`log.info('fallback_input', { combinedText, userUrl })`（已有 fallback 日志只记结果不记输入）

**`lib/intel/fetchWebsite.js`**
- 成功返回前：`log.info('fetch_full', { excerpt, title, siteName })`（现有 `ok` 只记长度）

**`lib/intel/searches/*.js`**
- 每个 search 成功返回前：`log.info('results_full', { results })`（现有 `ok` 只记 `resultCount`）

**`lib/intel/wayback.js`**
- 成功返回前：`log.info('snapshot_full', { timestamp, snapshotUrl, fullResponse })`

**每一条新增都：不依赖任何上下文外变量、不修改返回值、不产生副作用、不引入新分支。只是 I/O 观察。**

### 6.4 Admin API（新建）

**`src/app/api/admin/trace/route.js`** —— 列表 JSON
- `GET /api/admin/trace?date=YYYYMMDD&status=error&route=v1/analyze&limit=50&cursor=N`
- 鉴权：`requireSession()` + 校验 `user.role === 'admin'`
- 返回：`{ ok, data: { items: [{requestId, route, status, durationMs, startMs, riskLevel, caller, inquiryPreview}], nextCursor } }`

**`src/app/api/admin/trace/[requestId]/route.js`** —— 详情 JSON
- `GET /api/admin/trace/:requestId?date=YYYYMMDD`（date 可选，不填自动扫当天和昨天）
- 返回：`{ ok, data: { meta, events } }`

### 6.5 Admin UI（独立路由 + debug 风格 chrome）

**改动点 1：`src/app/page.js`**（纯追加，不删不改）

左侧 `<nav>` 现有 3 条 NavItem 之后，新增一条 admin-only：

```jsx
{isAdmin && (
  <NavItem
    icon={<DebugIcon />}
    label="Debug"
    active={false}  // 在主应用内永远 false，真实 active 状态在 /admin/traces 里自己控制
    onClick={() => {
      router.push('/admin/traces')
      setMobileOpen(false)
    }}
    adminBadge
  />
)}
```

`DebugIcon` 内联在 page.js 同文件（和 `SearchIcon` / `ClockIcon` / `GearIcon` 放一起，保持风格）。`router` 从 `next/navigation` 的 `useRouter` 拿。现有 `page` state、`pageTitles` 字典、`App` 根组件分发逻辑一字不改。

**改动点 2：`src/app/admin/layout.js`**（新建）

- 鉴权拦截：调 `/api/me` 拉当前用户，不是 admin 直接 `redirect('/')`
- 套一层 debug 风格的顶栏：
  - 左：Logo 小图标（复用 page.js 里 Logo 的视觉元素，但独立实现一个小号版本）+ "Debug Trace" 标题
  - 右：当前用户邮箱 + "← 返回主页" 链接（`router.push('/')`）+ 登出按钮
- 主区满宽 `flex-1 overflow-y-auto` 容器留给 children

**改动点 3：`src/app/admin/traces/page.js`**（新建 —— 列表页）

Debug 优化的密集表格，不追求和主应用视觉一致、追求信息密度和操作效率：

- 顶部筛选条（sticky 固定）：日期选择器（默认今天 UTC）| status 下拉（all/success/error/running）| route 下拉 | requestId 搜索 | 刷新按钮
- 表格列（按密集排版）：开始时间 HH:mm:ss | requestId（短 8 位，等宽字体） | route | status（彩色徽章） | 时长 ms | riskLevel | caller | 询盘预览 80 字
- 行可点击跳 `/admin/traces/[requestId]`
- cursor-based 分页「加载更多」按钮
- 空列表显示"该日期无 trace"提示
- 对应 API：`GET /api/admin/trace?date=...&status=...&route=...&limit=50&cursor=...`

**改动点 4：`src/app/admin/traces/[requestId]/page.js`**（新建 —— 详情页）

三栏布局（大屏 lg+）或纵向堆叠（小屏）：

- 顶部面包屑：`← 返回列表` + `requestId` + meta 摘要（开始时间 / 时长 / status 徽章 / riskLevel / model / tokens）
- 左栏：**输入区**
  - `inquiry_text` 原文（可复制）
  - `company_profile` 原文（markdown 模式显原始文本，无渲染，方便调试看到原样）
  - images 缩略图网格（≤ 256 KB base64 直接渲染 `<img>`；> 256 KB 显示"图片已截断"占位 + sha256 哈希 + type / size）
- 中栏：**节点时间线**（最宽，主观看区）
  - 按 seq 排序，每个节点一张卡：
    - 顶部：tag（左）| event（中）| 耗时（右）| 状态色（绿/黄/红）
    - 展开：payload JSON 用 `<pre>` 等宽字体 + 轻量语法高亮（或直接 `JSON.stringify(..., 2)` 不做高亮）
    - 同一 tag 连续事件自动折叠成一组（例如 `intel/extract` 的 `start → ocr_start → ocr_ok → ocr_full → llm_call → extract_llm_request → extract_llm_response → llm_ok → fallback_input → fallback → ok` 归到一张主卡下），主卡显示总耗时和节点数，点开展开所有子事件
    - 悬挂请求（只有 start 没有 ok/fail）顶部徽章显示 `running` 黄色，提示"请求可能中途崩溃或正在执行"
  - 工具栏：「全部展开 / 全部折叠」双按钮；支持 Ctrl/Cmd+F 浏览器原生搜索（payload 已渲染成文本）
- 右栏：**最终 LLM 报告全文**（从 `llm_response` 事件的 payload 里抓 `content` 字段）
  - 长内容可滚动，配"复制到剪贴板"按钮
- 对应 API：`GET /api/admin/trace/:requestId?date=YYYYMMDD`

**样式约束**：
- 颜色 / 字号 / 圆角 / 间距 **必须**走 `tailwind.config.js` 的 stripe-* token（`text-stripe-navy` / `border-stripe-border` / `rounded-stripe-sm` / `text-stripe-purple` 等），确保和主应用调性协调
- 其余 UI / 交互按 debug 需求自由设计（密集表格、折叠组、宽时间线都是主应用里没有的）

### 6.6 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DEBUG_TRACE_ENABLED` | `true` | 总开关。false = 所有 recordEvent 空操作 |
| `DEBUG_TRACE_TTL_DAYS` | `14` | Redis TTL |
| `DEBUG_TRACE_MAX_PAYLOAD_KB` | `8` | 单条节点事件 payload 字节上限 |
| `DEBUG_TRACE_MAX_IMAGE_KB` | `256` | 单张图片 base64 字节上限 |

---

## 7. 鉴权

- `/api/admin/*` 和 `/admin/*` 使用已有的 `requireSession()`（`lib/auth.js`）
- 额外 role check: `session.user.role === 'admin'`，非 admin 401
- 失败走现有 401/403 格式，和 `/api/settings/admin` 同款

---

## 8. 错误处理和降级

| 场景 | 处理 |
|---|---|
| Redis 不可达 | `recordEvent` catch 掉，只 console.warn，请求链路不受影响 |
| `DEBUG_TRACE_ENABLED=false` | `isTraceEnabled` 返回 false，所有 debug 函数直接 return |
| payload 大于上限 | 保留前 N 字节 + `…[+M bytes]` 标记 + 原始 size + sha256 |
| 图片 base64 大于上限 | 保留前 128 KB + `truncated: true` + sha256，详情页显哈希占位 |
| 请求崩溃没到 `log.ok/fail` | meta 保持 `status: running`，列表页按"悬挂请求"标出；TTL 到期自然清理 |
| 高并发下 sorted set 竞态 | zadd 幂等，末次写入为准，不影响正确性 |

---

## 9. 测试

### 9.1 单元测试（`test/debug.test.js`）

- `isTraceEnabled` 对 ENV 的三态（未设置 / true / false）行为
- payload 截断：8KB 上下边界
- 图片截断：256KB 上下边界 + base64 正确保留首 128KB
- `recordEvent` 在 Redis 抛错时不抛
- `startTrace` / `endTrace` 多次调用幂等

### 9.2 logger 集成测试（`test/logger-sink.test.js`）

- `DEBUG_TRACE_ENABLED=false` 下 sink 完全不调用
- route/* 的 start/ok/fail 正确触发 startTrace/endTrace
- 非 route tag 只触发 recordEvent
- redact 规则正确应用（API key 被打码）

### 9.3 Admin API 测试（`test/admin-trace.test.js`）

- 非 admin 用户 401
- admin 用户读列表/详情 200
- 不存在的 requestId 返回 404
- 日期参数缺省走今天

### 9.4 手动 smoke

- 跑一次带图片的 `/api/v1/analyze` 请求
- 打开 `/admin/traces` 能看到这条请求
- 点进详情能看到所有节点的完整输入输出
- 把 `DEBUG_TRACE_ENABLED` 设为 `false`，重跑一次 —— 请求成功，但 `/admin/traces` 看不到新条目

---

## 10. 性能和成本

### 10.1 写入开销

- 每条节点事件 = 1 次 Redis `rpush`（~1-2ms over Upstash REST）
- 每个请求典型事件数：20-40 条
- 全部 fire-and-forget，不阻塞请求响应

### 10.2 存储估算

- 典型请求 trace 大小（含原文 + 图片缩略，单图 < 256 KB）：100-300 KB
- 上限请求 trace（4 张满额图片）：~1.5 MB
- 假设 500 请求/天，平均 200 KB → 100 MB/天 → 1.4 GB / 14 天保留窗口
- Upstash Pay-as-you-go Redis：目前容量价格约 $0.20/GB/月，量级可接受
- 高流量时可调小 `DEBUG_TRACE_MAX_IMAGE_KB` 到 64 或下调保留天数到 7

### 10.3 读取开销

- 列表页：单次 zrange + mget meta（1 + N 次 Redis 调用）
- 详情页：hget meta + lrange trace（2 次调用）
- 全部 admin-only 低频访问，无须缓存

---

## 11. 对现有业务的影响（明确列出）

- `lib/obs.js`：**零改动**
- `lib/kv.js`：**零改动**
- `lib/auth.js`：**零改动**
- route handler 业务流程：**零改动**（只在函数体空隙 append 纯新增 log 调用）
- intel pipeline 节点逻辑：**零改动**（同上）
- 前端现有页面（QueryPage / HistoryPage / SettingsPage / LoginPage）内部逻辑：**零改动**
- `src/app/page.js` 的 Layout / App 根组件：**仅追加一条 admin-only Debug NavItem + 一个 `useRouter()` 调用**；现有 3 个 NavItem、`page` state、`pageTitles`、App 分发逻辑一字不改
- API 契约：**零改动**（只新增 `/api/admin/trace/*`，不动现有任何路由）
- Tailwind / 全局样式：**零改动**（Debug 页面完全复用现有 stripe-* 设计 token）
- 数据库 schema：**零改动**（只是在 Redis 里多一个 `debug:` 前缀的键空间）
- CI / 部署：**零改动**

---

## 12. 分支和交付

- 分支名：`feat/debug-trace-panel`
- 预估改动行数：~900 行（新增为主 + ~30 行纯新增 log）
- 预估开发周期：3-4 天（设计已对齐的前提下）
- 合并前要求：
  - `npm test` 全绿
  - 本地 smoke：发一条带图片的请求，在面板里能看到完整链路
  - 本地 smoke：关掉 ENV 开关，确认请求正常 + 面板停写
  - code review 至少 1 approval

---

## 13. 后续可能（Out of scope，仅记录）

- **Vercel Blob 图片外挂**：超 256 KB 的图片改存 Blob，trace 里只存 blob URL
- **失败告警**：当日失败率 > 阈值推钉钉 / 企微
- **run diff**：给同一 route 的两条 trace 做字段级 diff
- **re-run**：从 trace 里一键复制原始 payload 回放，方便修 bug 验证
- **用户分组视图**：按 caller / session.email 聚合
- **trace 导出**：下载 JSON / CSV 给第三方分析

---

## 14. 风险点

| 风险 | 影响 | 缓解 |
|---|---|---|
| 把敏感数据（API key、密码）也存进 trace | 合规风险 | 复用 logger.js 现有的 `REDACT_KEYS` 白名单；新增的 `log.info` 也走同一个 redact 流程 |
| 存了原文导致合规问题 | 客户隐私 | admin-only 鉴权 + 14 天 TTL；ENV 能一键关闭 |
| Redis 存储暴涨 | 成本 | 日后可调 `MAX_IMAGE_KB` / `TTL_DAYS`；最坏情况关 ENV 开关，新数据停写、旧数据 14 天内自然过期 |
| 高并发下 logger sink 回压 | 请求变慢 | 所有写入 fire-and-forget，不 await；Redis 抛错只 warn |
| 新增 log 调用不小心打到了 PII 敏感字段 | 合规 | 新增每一处都明确列在本 spec 6.3 节；CR 时重点审计 |

---

## 15. 开放问题

- 无（本设计经过 2026-04-19 澄清会对齐，所有关键选项已锁定）

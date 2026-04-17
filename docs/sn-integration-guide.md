# SnapCheckAlgo — SN 平台对接指南

> 面向 SN 平台后端工程师。读完这份文档即可完成对接，不需要读项目内部 notebook。

SnapCheckAlgo 是一个独立部署的外贸询盘背景调查 API 服务——给定一段询盘文本 + 卖家自画像，返回结构化风险评估（四维评分 + 风险等级）、发件方实体、以及 8 路 OSINT 情报（LinkedIn、Panjiva 海关记录、Wayback 建站时间等）。

**生产地址**: `https://snap-check-algo.vercel.app`
**主端点**: `POST /api/v1/analyze`
**响应协议**: SSE 流式（`text/event-stream`）
**单次调用耗时**: 离线 15–30s / 联网 60–120s（含 8 路并发 OSINT）

---

## 1. 快速开始（3 分钟跑通第一个请求）

### 1.1 获取 `SERVICE_API_KEY`

联系 SnapCheckAlgo 管理员（tommy@mmldigi.com）申请，拿到一个 Bearer token 形式的 key。所有请求必须带此 key，否则返回 401。

### 1.2 最小化 curl

```bash
curl -N -X POST https://snap-check-algo.vercel.app/api/v1/analyze \
  -H "Authorization: Bearer $SERVICE_API_KEY" \
  -H "Content-Type: application/json" \
  --max-time 300 \
  -d '{
    "inquiry": "Hello, I am Sarah from Lagos Trading. Interested in bulk LED, 5000 units, CIF Lagos. sarah@lagostrading.com",
    "company": {
      "name": "Shenzhen Bright LED",
      "website": "https://shenzhen-bright-led.example.com"
    },
    "options": { "enable_intel": true }
  }'
```

`-N` 禁用 curl 自身 buffering，让 SSE 流实时显示。

### 1.3 预期响应

响应是 SSE 流。你会先看到多条 `progress` 事件（每 8s 心跳 + 每阶段切换 1 条），最后是一个 `done` 事件携带完整 JSON：

```
event: progress
data: {"stage":"queued","elapsed_ms":1}

event: progress
data: {"stage":"gather_intel","elapsed_ms":392}

event: progress
data: {"stage":"llm_analysis","elapsed_ms":12739}

... (更多 progress) ...

event: done
data: {"ok":true,"data":{"report":"# 询盘分析报告 ...","risk_level":"high","scores":{...},"buyer":{...},"intel":{...},"model":"claude-sonnet-4-6","tokens":{...},"elapsed_ms":80271}}
```

---

## 2. API 端点详解

### 2.1 `POST /api/v1/analyze`

**Headers**:

| Header | 值 |
|---|---|
| `Authorization` | `Bearer <SERVICE_API_KEY>` |
| `Content-Type` | `application/json` |
| `Accept` | `text/event-stream`（可选，但推荐） |

**请求体** (JSON)：

```json
{
  "inquiry": "<询盘原文，必填>",
  "company": {
    "name": "<我方公司名>",
    "website": "https://<我方官网 URL>",
    "intro": "<公司简介，可选>",
    "industry": "<行业，可选>",
    "product_lines": ["<产品线1>", "<产品线2>"]
  },
  "images": [
    { "url": "https://<图片URL>", "type": "image/jpeg" },
    { "base64": "<base64字符串>", "type": "image/png" }
  ],
  "options": {
    "enable_intel": true
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `inquiry` | string | ✓ | 询盘原文。空字符串 → 400 |
| `company.name` | string | × | 卖家（我方）公司名 |
| `company.website` | string | × | 卖家官网 URL（用作上下文，不是调查目标） |
| `company.intro` | string | × | 公司简介，帮助 LLM 判断匹配度 |
| `company.industry` | string | × | 行业标签 |
| `company.product_lines` | string[] | × | 产品线数组 |
| `images` | Array | × | 最多 4 张图片（名片/邮件截图等），每项支持 `url` 或 `base64` 二选一 |
| `options.enable_intel` | boolean | × | 默认 `true`。详见 §3 |

**非 SSE 的错误响应**（HTTP 4xx/5xx，普通 JSON body）：

| 状态码 | 原因 | 示例 body |
|---|---|---|
| 401 | Bearer token 缺失或非法 | `{"ok":false,"error":"Invalid or missing API key"}` |
| 400 | JSON body 解析失败 / `inquiry` 为空 | `{"ok":false,"error":"inquiry is required"}` |
| 503 | `SERVICE_API_KEY` / admin API Key / Base URL / SerpAPI Key 未在服务端配置 | `{"ok":false,"error":"SerpAPI Key not configured, set enable_intel: false to skip"}` |

一旦 HTTP 200 开始，余下通讯都走 SSE，错误也在 SSE 的 `error` 事件里。

### 2.2 SSE 事件模型

| event | 频率 | data 字段 |
|---|---|---|
| `progress` | 多次：入口立即 1 条 + 每 8s 心跳 + 每阶段切换 1 条 | `{"stage": "<stage>", "elapsed_ms": <number>}` |
| `done` | 1 次（成功时流末） | 完整 JSON，详见 §2.3 |
| `error` | 1 次（失败时流末） | `{"code": "<config\|llm\|internal>", "message": "<人类可读>"}` |

**`stage` 枚举**（按出现顺序）：
`queued` → `load_settings` → `prepare_images` → `gather_intel`（仅 `enable_intel:true`）→ `llm_analysis` → `post_process`

**首字节 deadline**: 请求到达后 **<10s** 必发出首个 `progress` 事件（实测 1ms）。

**流末语义**: 消费方必须等到 `done` 或 `error` 才认为请求结束。`progress` 事件只用于保持连接 + 进度展示，不含业务数据。

> **关键**: Vercel 边缘代理对**非流式**响应有 60s 空闲 TCP 硬截断。SSE 心跳每 8s 一条确保连接持续到分析完成。不要用阻塞式同步 HTTP 客户端实现消费端。

### 2.3 `done` 事件 data 完整 schema

```json
{
  "ok": true,
  "data": {
    "report": "<Markdown 分析报告>",
    "risk_level": "low | medium | high",
    "scores": {
      "inquiry": <0-100 整数>,
      "customer": <0-100 整数>,
      "match": <0-100 整数>,
      "strategy": <0-100 整数>
    },
    "buyer": {
      "company_name": "<string | null>",
      "person_name": "<string | null>",
      "person_title": "<string | null>",
      "email": "<string | null>",
      "phone": "<string | null>",
      "country": "<string | null>",
      "company_url": "<string | null>",
      "products": ["<string>", ...]
    },
    "intel": { ... } | null,
    "model": "<上游 LLM 模型名>",
    "tokens": {
      "prompt": <number | null>,
      "completion": <number | null>
    },
    "elapsed_ms": <number>
  }
}
```

**字段契约：**

- `risk_level` 永远是 `"low" | "medium" | "high"` 之一。**不会是 `"unknown"`**——后端如果 LLM 输出未命中关键词，会兜底为 `"medium"`
- `scores.*` 均为 0-100 整数；偶发 LLM 不按格式输出时可能为 `null`
- `buyer.products` 是字符串数组，可能为空 `[]`（**不是** `null`）
- `buyer` 其他字段 8 个均可为 `null`（提取失败时）
- **注意**: `enable_intel:false` 时 `buyer` 对象仍然存在，但 8 个字段**全部为 null**。不要假设 `buyer` 本身为 null
- `intel` 在 `enable_intel:false` 时为 `null`；`enable_intel:true` 时返回 §4 详述的结构
- `tokens` 可能为 `{prompt: null, completion: null}`（部分上游 provider 不透传 usage）
- `model` 是 SnapCheckAlgo 管理员后台配置的 LLM 模型名，可能随时变化

---

## 3. `enable_intel` 语义

| 取值 | 含义 | 典型耗时 | 外部调用 |
|---|---|---|---|
| `true`（默认） | 启用 8 路并发 OSINT 情报搜集（Serper + Wayback） | **60–120s** | SerpAPI 消耗 6-8 次搜索额度 |
| `false` | 只跑主 LLM 分析（用 fallback prompt） | **15–30s** | 无 |

**建议：**
- SN 平台用户主动选"深度背景调查"时传 `true`
- 用户选"快速初筛"或做预览时传 `false`
- SerpAPI 额度是 SnapCheckAlgo 全局共享资源（月配额限制），SN 平台应对"联网"和"离线"做独立的用户级配额

---

## 4. `intel` 字段详解

`intel` 对象在 `enable_intel:true` 成功时返回。包含：
- `extracted` — 发件方实体抽取结果（8 字段）
- 8 个 OSINT 子键：`website / wayback / linkedin / facebook / panjiva / negative / generalSearch / phone`
- `meta` — 情报管线元信息

### 4.1 统一外层约定

8 个 OSINT 子键都带一个 `status` 字段，取值：

| status | 触发条件 | 携带字段 |
|---|---|---|
| `'ok'` | 搜索/抓取成功返回（结果可能为空） | `query`（OSINT 搜索）、业务字段 |
| `'failed'` | 上游接口报错（HTTP 非 2xx、超时、解析失败） | `query`（OSINT 搜索，website/wayback 无 query）、`error` |
| `'skipped'` | 缺少必要输入参数（例如没有公司名、没有 URL） | `error`（说明原因） |

> SN 前端对这三种 status 分别做 UI：`ok` 渲染数据、`failed` 展示错误 chip、`skipped` 折叠/淡化。

### 4.2 子键 1：`extracted`（发件方实体抽取）

整个询盘分析的种子数据——其他 OSINT 搜索的 query 都从这里派生。

| 字段 | 类型 | 说明 |
|---|---|---|
| `companyName` | `string \| null` | 发件方公司名 |
| `companyUrl` | `string \| null` | 发件方官网 URL（已规范化为 `https://...`，可能来自 LLM 抽取、正则扫描或邮箱域名推导） |
| `personName` | `string \| null` | 发件方姓名 |
| `personTitle` | `string \| null` | 发件方职位 |
| `email` | `string \| null` | 发件方邮箱 |
| `phone` | `string \| null` | 发件方电话 |
| `country` | `string \| null` | 发件方国家（中文或 ISO 代码） |
| `products` | `string[]` | 询盘提及的产品数组（可为空 `[]`，不会是 null） |

抽取步骤失败时，`intel.extracted` 整个为 `null`。

### 4.3 子键 2：`website`（发件方官网抓取）

基于 `extracted.companyUrl` 抓取。

| status | 附加字段 |
|---|---|
| `'ok'` | `url: string`<br>`title: string \| null`（HTML title）<br>`siteName: string \| null`（og:site_name）<br>`excerpt: string`（正文摘录，≤3000 字符，已去标签） |
| `'failed'` | `error: string`（例如 `"HTTP 404"`, `"fetch failed"`） |
| `'skipped'` | `error: string`（常见：`"询盘未提及发件方公司网址"`） |

### 4.4 子键 3：`wayback`（Archive.org 建站时间）

| status | 附加字段 |
|---|---|
| `'ok'` | `firstSnapshot: string \| null`（ISO 日期 `"2018-03-15"`；可能 `null`）<br>`ageYears: number \| null`（1 位小数） |
| `'failed'` | `error: string` |
| `'skipped'` | `error: string` |

**`ageYears < 2`** 通常是外贸诈骗的强信号（声称"15 年老厂"但域名只有 1 年）。

### 4.5 子键 4：`linkedin`

Query 模板：`site:linkedin.com/in "{personName}" "{companyName}"`（有人名时）或 `site:linkedin.com/company "{companyName}"`。

| status | 附加字段 |
|---|---|
| `'ok'` | `query: string`<br>`found: boolean`<br>`topResults: SerpResult[]`（最多 5 条） |
| `'failed'` | `query: string`, `error: string` |
| `'skipped'` | `error: string`（常见：`"缺少人名和公司名"`） |

### 4.6 子键 5：`facebook`

与 `linkedin` **完全同构**（`query / found / topResults`）。

### 4.7 子键 6：`panjiva`（海关进出口足迹）

| status | 附加字段 |
|---|---|
| `'ok'` | `query: string`<br>`hasRecord: boolean`<br>`resultCount: number`<br>`topResults: SerpResult[]`（最多 5 条） |
| `'failed'` | `query: string`, `error: string` |
| `'skipped'` | `error: string`（`"缺少公司名"`） |

**声称"老牌贸易商"但 `hasRecord: false`** 是强负面信号。

### 4.8 子键 7：`negative`（负面舆情）

Query: `"{companyName}" (scam OR fraud OR 骗 OR complaint)`

| status | 附加字段 |
|---|---|
| `'ok'` | `query: string`<br>`hitCount: number`<br>`hits: SerpResult[]`（最多 5 条） |
| `'failed'` | `query: string`, `error: string` |
| `'skipped'` | `error: string`（`"缺少公司名/邮箱/人名"`） |

### 4.9 子键 8：`generalSearch`（通用搜索）

Query: `"{companyName}"`

| status | 附加字段 |
|---|---|
| `'ok'` | `query: string`<br>`topResults: SerpResult[]`（最多 5 条，无 `found` 字段） |
| `'failed'` | `query: string`, `error: string` |
| `'skipped'` | `error: string`（`"缺少公司名"`） |

### 4.10 子键 9：`phone`（电话反查）

Query: `"{normalizedPhone}"`（去空格/横杠/括号，要求长度 ≥ 6）

| status | 附加字段 |
|---|---|
| `'ok'` | `query: string`<br>`hitCount: number`<br>`hits: SerpResult[]`（最多 5 条） |
| `'failed'` | `query: string`, `error: string` |
| `'skipped'` | `error: string`（常见：`"询盘未提及发件方电话"`） |

**同一电话同时命中多个毫无关联的商家页面** = 假电话或公用号，强负面信号。

### 4.11 `SerpResult` 通用结构

```ts
{
  title: string,    // 搜索结果标题（可能为空 ""）
  link: string,     // 完整 URL
  snippet: string   // Google 摘要片段
}
```

### 4.12 `meta` 元信息

| 字段 | 类型 | 说明 |
|---|---|---|
| `durationMs` | `number` | 情报管线总耗时 |
| `skipped` | `string[]` | 被 skip 的子键 + 原因 |
| `extractionStatus` | `'ok' \| 'failed' \| 'skipped'` | 实体抽取步骤结果 |
| `extractionError` | `string \| null` | 抽取失败原因 |
| `extractionModel` | `string` | 实际用于抽取的模型 |

### 4.13 SN 前端渲染建议

| 子键 | 推荐 UI | 空态处理 |
|---|---|---|
| `extracted` | 名片式卡片 | `null` → "抽取失败" |
| `website` | 顶部 hero + 外链 | `failed` → 错误 chip；`skipped` → 淡化 |
| `wayback` | 年份强调 + age chip | `firstSnapshot === null` → "无历史快照"（可疑信号） |
| `linkedin` / `facebook` | 列表卡片 | `found: false` → "无匹配" |
| `panjiva` | "有海关记录 / 无记录"徽章 + 列表 | `hasRecord: false` → 红色 chip |
| `negative` | 红色警示卡片 | `hitCount: 0` → 绿色 chip |
| `generalSearch` | 通用列表 | `topResults: []` → "查无此司" |
| `phone` | 列表 + `hitCount` 徽章 | `skipped` → "未提供电话" |

通用规则：
- `status === 'failed'` 时所有子键显示 error chip，不展开数据
- `status === 'skipped'` 折叠到最小
- `topResults` / `hits` 数组可能为 `[]`（`status:'ok'` 但无结果），需区分"空数组"和"缺失字段"
- `query` 字段**只在 `status: 'ok' 或 'failed'` 时存在**
- `meta.durationMs` 可展示"情报耗时 Xs"

---

## 5. Node.js 调用示例

### 5.1 基础 SSE 流消费 + 事件分发

```js
// Node 18+, 使用内置 fetch
async function analyzeInquiry(payload) {
  const res = await fetch('https://snap-check-algo.vercel.app/api/v1/analyze', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SNAPCHECK_SERVICE_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(payload),
  })

  // 非 2xx 一律是非 SSE 的 JSON 错误
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE frames are separated by \n\n
    let idx
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)

      let eventType = ''
      let dataRaw = ''
      for (const line of frame.split('\n')) {
        if (line.startsWith('event: ')) eventType = line.slice(7)
        else if (line.startsWith('data: ')) dataRaw += line.slice(6)
      }
      const data = dataRaw ? JSON.parse(dataRaw) : null

      if (eventType === 'progress') {
        console.log(`[${data.elapsed_ms}ms] ${data.stage}`)
      } else if (eventType === 'done') {
        return data // { ok: true, data: { report, risk_level, ... } }
      } else if (eventType === 'error') {
        throw new Error(`[${data.code}] ${data.message}`)
      }
    }
  }

  throw new Error('Stream ended without done/error event')
}
```

### 5.2 将结果持久化到 SN 数据库

```js
// 伪代码，按 SN 后端技术栈调整
async function runAnalyzeAndSave(snUserId, request) {
  // 1. 记录初始状态
  const analysisId = await db.analyses.create({
    sn_user_id: snUserId,
    status: 'pending',
    request: request,
    created_at: new Date(),
  })

  try {
    await db.analyses.update(analysisId, { status: 'analyzing' })

    // 2. 调 SnapCheckAlgo（完整等到 done）
    const response = await analyzeInquiry(request)

    // 3. 落库
    await db.analyses.update(analysisId, {
      status: 'completed',
      report: response.data.report,
      risk_level: response.data.risk_level,
      scores: response.data.scores,
      buyer: response.data.buyer,
      intel: response.data.intel,       // JSON 列，或拆成多个子表
      model: response.data.model,
      prompt_tokens: response.data.tokens.prompt,
      completion_tokens: response.data.tokens.completion,
      elapsed_ms: response.data.elapsed_ms,
      completed_at: new Date(),
    })

    return analysisId
  } catch (err) {
    await db.analyses.update(analysisId, {
      status: 'failed',
      error_message: String(err.message || err).slice(0, 500),
      failed_at: new Date(),
    })
    throw err
  }
}
```

### 5.3 前端实时展示进度（可选）

如果 SN 前端想边走边展示阶段 / 耗时，把 `progress` 事件代理到前端的 WebSocket 或 Server-Sent Events：

```js
// 把 SnapCheckAlgo 的 SSE 转发到 SN 自己的 WebSocket
async function streamToClient(ws, payload) {
  // 和 5.1 一样，只是把 progress 代理给 ws
  // ...
  if (eventType === 'progress') {
    ws.send(JSON.stringify({ type: 'progress', ...data }))
  } else if (eventType === 'done') {
    ws.send(JSON.stringify({ type: 'done' }))
    // 业务数据单独走 REST 让前端再 fetch 一次（避免 WS 消息过大）
  }
}
```

---

## 6. 错误处理

### 6.1 `error` 事件的 `code` 枚举

| code | 场景 | SN 建议动作 |
|---|---|---|
| `config` | 服务端配置缺失（Admin API Key / Base URL / SerpAPI Key 未配） | 报警给 SnapCheckAlgo 运维（tommy@mmldigi.com），**不要重试**——人工配置问题 |
| `llm` | 上游 LLM 连接失败 / HTTP !ok / 返回空内容 | 可以**指数退避重试 1-2 次**；持续失败报警 |
| `internal` | 未分类异常（catch block 兜底） | 带上 `request_id`（见 §8）报警 |

### 6.2 非 SSE 层错误（HTTP 4xx/5xx）

| 状态码 | 原因 | SN 建议动作 |
|---|---|---|
| 400 | `inquiry` 为空 / JSON 解析失败 | 前置校验请求，不要重试 |
| 401 | Bearer token 非法 | 检查环境变量，**不要重试** |
| 503 | SnapCheckAlgo 配置缺失 | 报警，不要重试 |

### 6.3 网络断线 / 流意外中断

SSE 长连接可能因为中间网络、ISP 路由、负载均衡等原因中断。建议：

- **客户端超时**: 把 fetch 的整体 timeout 设为 **300s**（Vercel Function maxDuration 硬上界 = 300s）
- **超时判断**: 如果最后一个 `progress` 事件距今超过 **15s**（心跳每 8s 一次，15s 约等于 2 个周期），判为断线
- **重试策略**: **不重试**——SnapCheckAlgo 没有幂等保证，重试会重复消耗 SerpAPI 额度。让用户手动发起

### 6.4 建议的 SN 平台状态机

```
pending → analyzing → completed
                    ↘ failed
```

| 状态 | 触发 |
|---|---|
| `pending` | SN 用户点击"开始分析"，request 已落库但未发给 SnapCheckAlgo |
| `analyzing` | 已发起 SnapCheckAlgo 请求，收到首个 `progress` 事件 |
| `completed` | 收到 `done` 事件，报告已落库 |
| `failed` | 收到 `error` 事件 / HTTP 非 2xx / 超时 |

---

## 7. 限流与配额

### 7.1 SnapCheckAlgo 侧的 SerpAPI 限流

- **令牌桶：5 rps**（模块级内存实现，每个 Vercel Fluid Compute 实例独立）
- 单次 `enable_intel:true` 消耗约 **6-8 次搜索额度**
- SerpAPI 月配额由 SnapCheckAlgo 管理员统一管理；额度耗尽会导致 `intel.*.status === 'failed'`，但 LLM 分析仍能完成（降级行为）

### 7.2 Vercel Function 并发

- Pro 套餐，Function `maxDuration: 300s`
- Fluid Compute 会跨并发请求复用实例，但每个 Function instance 的 5 rps 限流是独立的

### 7.3 SN 平台建议的用户级配额

| 模式 | 建议配额 | 理由 |
|---|---|---|
| `enable_intel: true` | 50 次/天/用户 | 耗 6-8 条 SerpAPI 额度/次 + 60-120s 服务端资源 |
| `enable_intel: false` | 300 次/天/用户 | 只消耗 LLM tokens，成本低 |

重要：配额应该**在 SN 后端扣**，不是让 SnapCheckAlgo 挡。SnapCheckAlgo 只做服务端限流保护，不做业务层配额。

---

## 8. 监控与排查

### 8.1 通过 `request_id` 追踪

**当前版本**: 每次调用的 `request_id`（uuid v4）只存在于 SnapCheckAlgo 服务端观察日志里（见 §8.2），**不在** SSE 事件或 `done` 响应里返回。

SN 后端**建议自己生成一个追踪 ID**（例如 `sn_analysis_id`）作为业务主键，不依赖 SnapCheckAlgo 返回。

> 未来版本可能在 SSE 事件或 done 响应里暴露 `request_id`，使两端可以对齐。如有需求反馈给 SnapCheckAlgo 维护者。

### 8.2 SnapCheckAlgo 侧观察日志

每次调用 `/api/v1/analyze` 都会在 Upstash Redis 里写一条最小化日志：

- **Key**: `obs:analyze:{YYYYMMDD}:{request_id}`
- **TTL**: 90 天
- **字段**: `request_id`, `timestamp`, `user_id`, `input_hash`(SHA-256), `output_summary`, `elapsed_ms`, `enable_intel`, `source`, `status`, `error_code`

排查特定请求：SN 运维向 SnapCheckAlgo 运维提供时间戳（秒精度）+ 询盘文本的 SHA-256，SnapCheckAlgo 侧可用 `SCAN obs:analyze:{YYYYMMDD}:*` 定位并给出 `output_summary`。

### 8.3 异常排查 Checklist

从失败现象往根因走：

1. **HTTP 401** → 检查 `SNAPCHECK_SERVICE_API_KEY` 环境变量是否正确
2. **HTTP 503 + "not configured"** → SnapCheckAlgo 管理员后台配置缺失，联系运维
3. **长时间没有 `progress` 事件（>15s）** → 网络断线，断开重新发起
4. **`progress` 一直卡在 `gather_intel` 阶段** → SerpAPI 限流或配额耗尽；检查 SnapCheckAlgo `meta.skipped` 字段
5. **`done` 的 `risk_level` 一直是 `"medium"`** → 可能是 LLM 输出未命中风险关键词，系统用兜底值。可查 SnapCheckAlgo 运维的 `[v1/analyze] risk_level keyword miss` 日志定位
6. **`scores` 个别字段 null** → LLM 输出格式漂移，不影响整体可用性
7. **`intel.*.status === 'failed'`** → 单个子键失败不影响整体。检查其 `error` 字段判断上游原因

---

## 9. 版本与变更

这份指南对应 SnapCheckAlgo 当前生产版本（2026-04-17 部署）。后续 API 变更会通过：

1. 新版本走新路径（`/api/v2/analyze` 等），旧版本至少并行 1 个月
2. 破坏性变更在发布前 1 周通过邮件通知 SN 平台工程接口人

**对接问题联系**: tommy@mmldigi.com（SnapCheckAlgo 维护者）

---

## 附录 A: 完整 done 事件示例（生产真实请求截取）

```json
{
  "ok": true,
  "data": {
    "report": "# 询盘分析报告\n\n...（约 4000 字符的 Markdown 报告）...",
    "risk_level": "high",
    "scores": {
      "inquiry": 12,
      "customer": 5,
      "match": 0,
      "strategy": 2
    },
    "buyer": {
      "company_name": "Global Trading Solutions Ltd.",
      "person_name": "James Wilson",
      "person_title": null,
      "email": "james.wilson@gmail.com",
      "phone": "+254700123456",
      "country": "Kenya",
      "company_url": "https://globaltrading-solutions-kenya.com",
      "products": ["LED display products"]
    },
    "intel": {
      "extracted": { "...": "同 buyer 字段源数据" },
      "website": { "status": "failed", "error": "fetch failed" },
      "wayback": { "status": "ok", "firstSnapshot": null, "ageYears": null },
      "linkedin": {
        "status": "ok",
        "query": "site:linkedin.com/in \"James Wilson\" \"Global Trading Solutions Ltd.\"",
        "found": true,
        "topResults": [ { "title": "...", "link": "...", "snippet": "..." } ]
      },
      "facebook": { "status": "ok", "query": "...", "found": true, "topResults": [...] },
      "panjiva": {
        "status": "ok",
        "query": "site:panjiva.com \"Global Trading Solutions Ltd.\"",
        "hasRecord": false,
        "resultCount": 0,
        "topResults": []
      },
      "negative": { "status": "ok", "query": "...", "hitCount": 3, "hits": [...] },
      "generalSearch": { "status": "ok", "query": "...", "topResults": [...] },
      "phone": { "status": "ok", "query": "...", "hitCount": 3, "hits": [...] },
      "meta": {
        "durationMs": 16875,
        "skipped": [],
        "extractionStatus": "ok",
        "extractionError": null,
        "extractionModel": "gemini-3-flash-preview"
      }
    },
    "model": "claude-sonnet-4-6",
    "tokens": { "prompt": 9753, "completion": 3023 },
    "elapsed_ms": 92106
  }
}
```

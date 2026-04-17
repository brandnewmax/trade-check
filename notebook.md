# SnapCheckAlgo · 开发进度笔记

> 秒探分析引擎——外贸询盘 OSINT 情报搜集 + AI 分析。作为独立 API 服务部署，供 SN 平台 (ai-sn) 调用。

**GitHub 仓库**: https://github.com/tommyso24/SnapCheckAlgo（Fork 自 brandnewmax/trade-check）
**生产地址**: https://snap-check-algo.vercel.app
**部署平台**: Vercel（Pro 套餐，Vibe Coding MML 团队，Function 最长 300s）
**数据存储**: Upstash Redis（Singapore 区，Free 套餐）

---

## 项目历程

### 原始开发阶段（2026-04，在 trade-check 仓库）

| 阶段 | 状态 | 核心交付 |
|---|---|---|
| 1. 实时情报检索 | ✅ 已完成 | 4 阶段管线：Serper + Wayback + 多模态抽取 + 情报面板 |
| 2. Stripe 风格重设计 | ✅ 已完成 | Tailwind + Geist；11 组件全重写 |
| 3. 发件方/我方角色反转 | ✅ 已完成 | 情报以发件方为调查目标；fallback 链 |
| 4. 热修复 | ✅ 已完成 | 55/55 测试通过 |

### 平台集成阶段（2026-04-16 起，在 SnapCheckAlgo 仓库）

| 阶段 | 状态 | 说明 |
|---|---|---|
| Fork 仓库 + 重命名 | ✅ 完成 | tommyso24/SnapCheckAlgo |
| Vercel 部署 | ✅ 完成 | snap-check-algo.vercel.app，Upstash Redis 已连接 |
| 环境变量配置 | ✅ 完成 | 13 个变量（7 个手动 + 5 个 Upstash 自动注入 + 1 个 KV_REST_API_URL） |
| 构建验证 | ✅ 完成 | 首页 200，登录 API 401（正常） |
| 迁移至团队空间 | ✅ 完成（04-16） | Hobby/Tom So's projects → **Pro/Vibe Coding MML**，重新 vercel link + 清理重复 UPSTASH_REDIS_REST_URL + 重新部署验证通过 |
| LLM/SerpAPI 配置 | ✅ 已配置 | 日志显示 gemini-3-flash-preview 调用成功 |
| **新增对外 API 接口** | ⏳ 待做 | `POST /api/v1/analyze`，供 SN 平台调用 |
| SN 平台对接 | ⏳ 待做 | ai-sn 后端改为调用 SnapCheckAlgo API |

---

## 系统架构

### 当前架构（独立运行）

```
用户 → SnapCheckAlgo 前端 → /api/analyze（SSE 流式）→ 情报管线 + LLM → 报告
```

### 目标架构（SN 平台集成）

```
SN 平台用户
    │
    ▼
SN 后端 (ai-sn)
  ├── 用户认证、余额检查、扣费
  ├── POST /api/v1/analyze → SnapCheckAlgo
  │       │ Authorization: Bearer <SERVICE_API_KEY>
  │       ▼
  │   SnapCheckAlgo (Vercel)
  │     ├── 验证 API Key
  │     ├── 阶段1: 抓取卖家网站
  │     ├── 阶段2: LLM 提取实体
  │     ├── 阶段3: 8路并发 OSINT 搜索
  │     ├── 阶段4: 主 LLM 分析
  │     └── 返回完整报告 JSON
  │       │
  ├── 存储报告到数据库
  └── 返回报告给前端
```

### 后端情报管线（`lib/intel/gatherIntel`）

```
输入: { inquiry, company, images, options }
         ↓
阶段 1 · 我方背景并行抓取
  ├─ fetchWebsite(我方url) → userSite
  └─ serpSearch("我方品牌名") → userContext
         ↓
阶段 2 · 发件方实体抽取(LLM)
  输入: 询盘文本 + 图片(多模态)
  输出: { companyName, companyUrl, personName, email, phone, country, products }
  fallback: 正则 URL 扫描 → 邮箱域名推导
         ↓
阶段 3 · 8 路并发 OSINT（Serper.dev）
  ├─ fetchWebsite(发件方官网)
  ├─ waybackFirstSnapshot(建站时间)
  ├─ searchLinkedIn(人名+公司名)
  ├─ searchFacebook(公司名)
  ├─ searchPanjiva(海关记录)
  ├─ searchNegative(诈骗关键词)
  ├─ searchGeneral(通用搜索)
  └─ searchPhone(电话记录)
         ↓
阶段 4 · 主 LLM 分析（SSE 流式 / 同步）
  注入: 情报简报 + 我方背景 + 原始询盘
  输出: 风险等级 + 4 维评分 + Markdown 报告
```

---

## 环境变量

### Vercel 上已配置

| 变量名 | 说明 |
|--------|------|
| `UPSTASH_REDIS_REST_URL` | Redis 连接 URL |
| `UPSTASH_REDIS_REST_TOKEN` | Redis 认证 Token |
| `JWT_SECRET` | JWT 签名密钥 |
| `ADMIN_EMAIL` | 管理员邮箱 tommy@mmldigi.com |
| `ADMIN_PASSWORD` | 管理员密码 |
| `TEST_EMAIL` | 测试用户 info@mmldigi.com |
| `TEST_PASSWORD` | 测试用户密码 |
| `KV_*` / `REDIS_URL` | Upstash 自动注入（5个） |

### 待添加（API 对接时）

| 变量名 | 说明 |
|--------|------|
| `SERVICE_API_KEY` | SN 平台调用的认证密钥 |

### 通过 Web 设置页配置（存 Redis）

| 配置项 | 说明 |
|--------|------|
| Base URL | LLM API 端点 |
| API Key | LLM API Key |
| Model Name | 分析模型名 |
| SerpAPI Key | Serper.dev 搜索 Key |
| Extraction Model | 实体提取模型（默认 gemini-2.5-flash） |
| System Prompt | 分析报告系统提示词 |

---

## API 接口设计（待实现）

### `POST /api/v1/analyze`

SN 后端调用，**返回 SSE 流式响应** (`Content-Type: text/event-stream`)。

**为什么流式**: Vercel 边缘代理对非流式响应有 60s 空闲 TCP 硬截断，即便 Function 本身 `maxDuration: 300s`。流式响应只要在 60s 内发出第一个字节（progress 事件），代理就会保持连接到结束。

**认证**: `Authorization: Bearer <SERVICE_API_KEY>`

**请求体** (JSON):
```json
{
  "inquiry": "询盘原文...",
  "company": {
    "name": "我方公司名",
    "website": "https://our-company.com",
    "intro": "公司简介",
    "industry": "行业",
    "product_lines": ["产品1", "产品2"]
  },
  "images": [{"url": "https://oss.xxx/image.jpg", "type": "image/jpeg"}],
  "options": {"enable_intel": true, "report_tier": "standard"}
}
```

> 鉴权/入参错误仍以常规 JSON 形式返回 (HTTP 4xx/5xx)：
> - `401` — Bearer token 非法或缺失
> - `400` — JSON body 解析失败 / `inquiry` 为空
> - `503` — `SERVICE_API_KEY` / admin API Key / Base URL / SerpAPI Key 未配置
>
> 一旦 HTTP 200 开始，余下通讯都走 SSE。

### SSE 事件流

| event | 频率 | data (JSON) |
|---|---|---|
| `progress` | 多次 (入口立即 1 条 + 每 8s 心跳 + 每阶段切换 1 条) | `{"stage": "<stage>", "elapsed_ms": <number>}` |
| `done` | 1 次 (成功时流末) | 下文「done 契约」完整 JSON |
| `error` | 1 次 (失败时流末) | `{"code": "<config\|llm\|internal>", "message": "..."}` |

**stage 枚举**: `queued` → `load_settings` → `prepare_images` → `gather_intel` (仅 `enable_intel:true`) → `llm_analysis` → `post_process`

**首字节 deadline**: 请求到达后 **<10s** 必发出首个 `progress` 事件 (实测 <1s)。

**流末语义**: 消费方必须等到 `done` 或 `error` 才能认为请求结束；进度事件不含业务数据，只用于保持连接与进度展示。

### `done` 事件 data 契约

```json
{
  "ok": true,
  "data": {
    "report": "Markdown 报告...",
    "risk_level": "low" | "medium" | "high",
    "scores": { "inquiry": 85, "customer": 72, "match": 68, "strategy": 75 },
    "buyer": {
      "company_name": "...", "person_name": "...", "person_title": "...",
      "email": "...", "phone": "...", "country": "...",
      "company_url": "...", "products": ["..."]
    },
    "intel": { "extracted": {...}, "website": {...}, "linkedin": {...}, "facebook": {...},
               "panjiva": {...}, "negative": {...}, "phone": {...}, "generalSearch": {...},
               "wayback": {...}, "meta": {...} } | null,
    "model": "claude-sonnet-4-6",
    "tokens": {"prompt": 5200, "completion": 3100},
    "elapsed_ms": 98314
  }
}
```

### curl 调用示例

```bash
curl -N -X POST https://snap-check-algo.vercel.app/api/v1/analyze \
  -H "Authorization: Bearer $SERVICE_API_KEY" \
  -H "Content-Type: application/json" \
  --max-time 300 \
  -d '{
    "inquiry": "Hello, interested in bulk LED, 10k units...",
    "company": { "name": "Shenzhen Bright LED", "website": "https://mmldigi.com" },
    "options": { "enable_intel": true }
  }'
```

`-N` 禁用 curl 自身 buffering，实时显示 SSE。

### Node.js 流式消费示例

```js
async function analyze(payload) {
  const res = await fetch('https://snap-check-algo.vercel.app/api/v1/analyze', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SERVICE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE frames are separated by \n\n
    let idx
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)

      let event = ''
      let data = ''
      for (const line of frame.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7)
        else if (line.startsWith('data: ')) data += line.slice(6)
      }
      const payload = data ? JSON.parse(data) : null

      if (event === 'progress') {
        console.log(`[${payload.elapsed_ms}ms] ${payload.stage}`)
      } else if (event === 'done') {
        return payload         // { ok: true, data: { ... } }
      } else if (event === 'error') {
        throw new Error(`[${payload.code}] ${payload.message}`)
      }
    }
  }

  throw new Error('Stream ended without done/error event')
}
```

### 字段契约细则

- **`scores.*`**: 均为 `0-100` 整数；`risk_level` 枚举为 `"low" | "medium" | "high"`，**不允许 `"unknown"`**。主路径与 fallback 路径均通过 prompt 强约束输出格式，后端用正则解析 `询盘质量分/客户实力分/匹配度得分/综合战略分` 四个标签 + `XX/100`。如果 LLM 输出未命中 `低风险/中风险/高风险` 关键词（prompt 失效或模型抖动），**后端兜底返回 `"medium"`** 并写 `console.warn` 日志，SN 平台永远拿到合法三值枚举。
- **`buyer`**:
  - `enable_intel: true` 时返回完整实体结构，8 个字段: `company_name / person_name / person_title / email / phone / country / company_url / products`，任一字段可能为 `null`（提取失败时），`products` 为字符串数组（可为空 `[]`）。
  - `enable_intel: false` 时 `buyer` 对象仍然存在，但 8 个字段**全部为 null**（`products` 为空数组 `[]`）——语义上等价于 null。SN 平台调用方需对每个字段做空值处理，**不要假设 `buyer` 本身为 null**。
- **`model`**: 返回值取决于 admin 在后台实际配置的 `Model Name`（存 Redis）。如果 admin 配置了模型覆盖，代码里的默认值 `gemini-3.1-pro-preview-vertex` 会被覆盖，这是**设计预期行为**——不是 bug。SN 平台如果需要感知模型变化，可读取响应中的 `data.model` 字段。
- **`intel`**: `enable_intel: false` 或情报管线全部失败时为 `null`；成功时返回 8 路 OSINT 子结构。
- **`tokens`**: 由上游 LLM 的 `usage` 字段透传，部分 provider 可能不返回 → 字段为 `null`。

---

## 重要注意事项

- **Pro 套餐**: 已升级至 Vibe Coding MML 团队 Pro 套餐，Function 最长 300s，深度分析可用。
- **同事迭代**: Max 同事继续在 `brandnewmax/trade-check` 做算法实验，验证后通过 PR 同步到本仓库。
- **ai-sn PR #2**: 之前尝试过代码合并方案（把 Python 移植到 ai-sn），已提 PR 但改为 API 方案，由 Stanley 处理。

---

## 未来待办（现阶段不处理）

- **SerpAPI 分布式限流升级**: 当前 `lib/intel/serpapi.js` 的 5 rps 限流是模块级内存令牌桶，仅在单个 Vercel Fluid Compute 实例内生效，不是分布式限流。Beta 阶段 SN 平台接入量低够用。等稳定运行一周后，如果观察到 SerpAPI 429 频繁触发或账单异常，升级为 Upstash Redis 分布式令牌桶（共享 KV，已在项目中可用）。

---

## TODO: 数据存储架构决策

**触发时机:** SuperNova 3.0 VI 敲定后、SnapCheck 前端设计启动前

### 需要一次性决策的五件事

- [ ] 存什么、不存什么（用户输入 / 最终报告 / OSINT 原始数据 / LLM 对话）
- [ ] 存哪里（Upstash Redis 够不够？要不要引入 PostgreSQL，和 MML ERP 的 Neon PostgreSQL 技术栈对齐？）
- [ ] 数据结构设计（key 结构 / schema / 索引方式 / 多产品共享策略）
- [ ] 用户权限模型（个人数据 vs 团队数据 vs 平台脱敏数据）
- [ ] 隐私政策草案（中国 PIPL + 跨境传输 + 可选 GDPR）

### 早期埋点要求（本阶段即可实现，不等完整架构）

- [ ] 在 `/api/v1/analyze` 和 `/api/analyze` 的请求处理中，每次分析完成时向 Upstash Redis 写入一条最小化观察日志

**字段:**

| 字段 | 含义 |
|---|---|
| `request_id` | uuid |
| `timestamp` | ISO 8601 |
| `user_id` | 调用方标识（SN 平台调用时用 service identity） |
| `input_hash` | 询盘文本的 SHA-256（不存原文） |
| `output_summary` | `{ report, scores, risk_level, model, tokens }` |
| `token_cost` | prompt + completion |
| `elapsed_ms` | 分析耗时 |
| `enable_intel` | bool |
| `source` | `web_frontend` \| `sn_platform_api` |

**Key 结构:** `obs:analyze:{YYYYMMDD}:{request_id}`，TTL 90 天

**目的:** Beta 阶段数据不丢，未来迁移到正式存储架构时可回溯

# 实时情报检索增强背景调查 — 设计文档

**日期:** 2026-04-14
**状态:** 设计已确认,待实施
**影响范围:** `/api/analyze`、`lib/`、管理员设置页、前端分析页

---

## 1. 背景与目标

当前 `trade-check` 的分析流程是:用户填写公司网址 + 询盘文本(可选图片)→ 后端直接把原始文本塞进 LLM 做外贸背景调查。问题是模型拿到的只是一串 URL 字符串和询盘文字,**没有访问互联网的能力**,判断完全依赖模型自身先验,容易幻觉,也无法让用户交叉核验。

本次改造在"调用主 LLM 之前",由后端先并行检索多个公开数据源,生成一份**结构化情报简报**,和原始询盘一起喂给主模型,并把简报本身展示给用户做人工复核。

**要解决的核心问题:**
- 模型判断缺乏客观依据 → 加入可追溯的实时数据
- 用户看到的是黑盒结论 → 情报以可点击的卡片形式展示
- 模型自由发挥容易幻觉 → systemPrompt 强制绑定"证据驱动"框架

## 2. 范围

### In scope
- 前端分析表单新增 `启用实时情报检索` 复选框(默认开,localStorage 记住上次选择)
- 后端新增情报检索编排器(`lib/intel/`)
- SerpAPI 单一检索入口(全局管理员配置,所有用户共用)
- 轻量 LLM 结构化抽取(公司名 / 人名 / 邮箱 / 电话 / 国家 / 产品)
- 6 个检索维度:公司网站正文、Wayback 建站时间、LinkedIn、Facebook、Panjiva 海关足迹、负面/诈骗搜索、公司名通用搜索
- SSE 协议扩展:`intel` / `intelDone` / `delta` / `done` 事件类型
- 前端情报面板 UI(卡片式,按状态灰/绿/红)
- 管理员设置页新增字段:SerpAPI Key、抽取模型、抽取 Prompt
- 全局 SerpAPI 月度用量计数器
- 主 systemPrompt 更新,强制引用简报各节

### Out of scope(本次不做)
- 付费数据源(ImportGenius/Panjiva 官方 API/Proxycurl/WhoisXML)
- 模型 function calling / 多轮工具调用
- 按用户限额、按用户账单
- 情报结果缓存(同域名 24 小时内复用)— YAGNI
- 图片反向搜索

## 3. 用户故事

1. **外贸业务员**输入可疑客户的公司网址和一段零碎的询盘文本,确认表单上的 `启用实时情报检索` 开关(默认开),点击"分析"。关掉时走现有"一步到位"流程,不消耗 SerpAPI 额度。
2. 系统先并行抓取网站 + 查 Wayback,随后用便宜 LLM 从网站+询盘中抽出结构化字段(公司名/人名/邮箱/产品等)。
3. 抽完之后并行跑 SerpAPI 检索:LinkedIn、Facebook、Panjiva、负面新闻、通用搜索。
4. 每完成一项,前端对应卡片立即从"加载中"变成"有/无/失败"状态,用户能看到进度。
5. 所有情报就绪后,系统把一份 markdown 格式的情报简报注入 user 消息顶部,调用主模型流式生成最终分析。
6. 业务员看到两部分:上方情报面板(可点进 LinkedIn/Panjiva/负面链接亲自复核),下方 AI 风险分析报告(每条结论都引用了简报第 X 节)。
7. 记录保存时情报简报 + AI 报告一起入库,历史记录可完整回放。

## 4. 架构总览

```
用户点"分析"(携带 enableIntel: true/false)
   ↓
enableIntel === false? ──是──→ 跳过阶段 1~3,直接阶段 4(现有行为)
   │
   否
   ↓
[阶段1] 并行启动(不依赖实体名):
   ├─ fetch 公司网址正文
   └─ Wayback 查最早快照
   ↓ (~1-2s)
[阶段2] 轻量 LLM 抽取结构化字段
   (使用 global_settings.extractionModel,复用用户 apiKey + 全局 baseUrl)
   ↓ (~1-2s)
[阶段3] 基于抽取结果并行跑 SerpAPI:
   ├─ LinkedIn   (人名+公司名 降级链)
   ├─ Facebook   (同)
   ├─ Panjiva    (site:panjiva.com "公司名")
   ├─ 负面/诈骗   (公司名|人名|邮箱 + scam/fraud/骗)
   └─ 通用搜索    ("公司名")
   ↓ (~2-3s)
[情报简报就绪] → 通过 SSE 推 `intelDone` 事件
   ↓
[阶段4] 主 LLM 流式分析
   (systemPrompt 绑定简报框架 + 简报 markdown + 原始询盘)
   ↓
保存 query 记录(含情报 JSON + AI 报告全文)
```

**首字延迟预估:** 从现在的 ~3s → 约 4~6s(可接受,因为期间前端有进度反馈)。

**失败策略:** 任何一项检索失败都不阻断整体流程,该项在简报中标记 `status: 'failed'`,主模型被 prompt 约束"数据缺失维度不得作为依据"。

## 5. 数据模型

### 5.1 `global_settings` hash 新增字段

| 字段 | 说明 | 默认值 |
|---|---|---|
| `baseUrl` | 既有 | — |
| `systemPrompt` | 既有,内容替换为新版(见 §8) | 见 §8 |
| `serpApiKey` | SerpAPI 密钥,管理员全局配置 | `''` |
| `extractionModel` | 结构化抽取用的便宜模型名 | `'gemini-2.5-flash'` |
| `extractionPrompt` | 抽取步骤的 system prompt | 见 §7 |
| `fallbackSystemPrompt` | 用户关闭实时检索或情报失败时使用的旧版 prompt | 现有的 5 维度提示词 |

### 5.2 query 记录 hash 新增字段

在既有 `query:{ts}:{rand}` 里新增:

- `intel` — JSON 字符串,结构见 §5.4(用户关闭检索时为 `null` 或缺省)
- `intelEnabled` — `'true' | 'false'`,记录本次分析是否启用了检索,便于历史回放时正确渲染

### 5.3 新增 Redis key

- `serpapi:usage:{YYYY-MM}` — 字符串计数器,每次成功调用 SerpAPI 时 `INCR`。管理员设置页显示本月累计。

### 5.4 `intel` 对象结构

```json
{
  "extracted": {
    "companyName": "ABC Trading Ltd | null",
    "personName": "John Smith | null",
    "personTitle": "Purchasing Manager | null",
    "email": "john@abc.com | null",
    "phone": "+1-xxx | null",
    "country": "US | null",
    "products": ["LED lights"]
  },
  "website": {
    "status": "ok | failed | skipped",
    "title": "ABC Trading - Wholesale LED",
    "excerpt": "首页正文前 ~3000 字",
    "error": "error message if failed"
  },
  "wayback": {
    "status": "ok | failed | skipped",
    "firstSnapshot": "2018-03-12",
    "ageYears": 7
  },
  "linkedin": {
    "status": "ok | failed | skipped",
    "query": "site:linkedin.com/in \"John Smith\" \"ABC Ltd\"",
    "found": true,
    "topResults": [{ "title": "...", "link": "...", "snippet": "..." }]
  },
  "facebook": { "同上结构" },
  "panjiva": {
    "status": "ok | failed | skipped",
    "query": "site:panjiva.com \"ABC Ltd\"",
    "resultCount": 12,
    "hasRecord": true
  },
  "negative": {
    "status": "ok | failed | skipped",
    "query": "\"ABC Ltd\" (scam OR fraud OR 骗)",
    "hits": [{ "title": "...", "link": "...", "snippet": "..." }]
  },
  "generalSearch": {
    "status": "ok | failed | skipped",
    "query": "\"ABC Ltd\"",
    "topResults": [{ "title": "...", "link": "...", "snippet": "..." }]
  },
  "meta": {
    "durationMs": 4320,
    "serpApiCallsUsed": 5,
    "skipped": ["panjiva (缺公司名)"]
  }
}
```

每一项的 `status` 驱动前端渲染颜色(`ok`→绿 / `failed`→红 / `skipped`→灰)。

## 6. 代码结构

```
lib/
├── auth.js                 (既有)
├── kv.js                   (既有,新增 3 个导出:
│                            getSerpUsage(ym), incrSerpUsage(ym),
│                            改 getGlobalSettings 默认值)
└── intel/
    ├── index.js            # gatherIntel(params) 编排器
    ├── fetchWebsite.js     # fetch URL → { title, excerpt }
    ├── wayback.js          # archive.org/wayback/available
    ├── extract.js          # 调轻量 LLM → JSON(公司/人/邮/电/国/产品)
    ├── serpapi.js          # SerpAPI 底层封装 + incrSerpUsage + 错误处理
    ├── format.js           # formatIntelAsBriefing(intel) → markdown
    └── searches/
        ├── linkedin.js
        ├── facebook.js
        ├── panjiva.js
        ├── negative.js
        └── general.js
```

**职责边界:**
- `lib/intel/searches/*.js` — 每个文件负责"接收 extracted 实体 → 构造一个查询字符串 → 调 serpapi.js → 返回标准 `{ status, query, ... }` 结构"。失败时返回 `{ status: 'failed', error }`,不抛。
- `serpapi.js` — 唯一会真正碰 fetch 的地方,集中处理超时、配额超限、计数器自增、错误映射。
- `extract.js` — 唯一调用 LLM 的地方(非主分析),复用全局 baseUrl + 用户 apiKey + `global_settings.extractionModel`。
- `index.js` — 编排阶段 1/2/3,接受 `onProgress` 回调逐步推送部分结果,返回完整 intel 对象。
- `format.js` — 纯函数,把 intel 对象转成 §8 里要求的 markdown 结构。没有副作用。

**`src/app/api/analyze/route.js` 改造:**

```js
// 伪代码
export async function POST(req) {
  const { session } = await requireSession()
  const body = await req.json()   // { url, inquiry, images, enableIntel }
  const [globalSettings, userSettings] = await Promise.all([...])

  // 校验: baseUrl / apiKey 必须有
  // serpApiKey 只在 enableIntel === true 时才校验

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (obj) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      // 1) 情报阶段(仅当 enableIntel === true)
      let intel = null
      if (body.enableIntel) {
        try {
          intel = await gatherIntel({
            url: body.url,
            inquiry: body.inquiry,
            apiKey: userSettings.apiKey,
            globalSettings,
            onProgress: (partial) => enqueue({ type: 'intel', partial }),
          })
          enqueue({ type: 'intelDone', intel })
        } catch (e) {
          enqueue({ type: 'error', error: `情报收集失败: ${e.message}` })
          // 不 return — 继续跑主分析,只是没有情报
          intel = null
        }
      }

      // 2) 拼最终 prompt
      //    - intel 非空 → 注入情报简报,用新版 systemPrompt(强约束框架)
      //    - intel 为空(用户关闭或情报失败) → 不注入简报,使用 fallbackSystemPrompt(旧版 5 维度)
      const briefing = intel ? formatIntelAsBriefing(intel) : null
      const effectiveSystemPrompt = intel
        ? globalSettings.systemPrompt
        : globalSettings.fallbackSystemPrompt
      const userContent = buildUserContent({
        briefing, url: body.url, inquiry: body.inquiry, images: body.images
      })

      // 3) 主 LLM 流式调用(基本照搬现有代码,改 messages 内容 + 加 type 字段)
      // ...
      // 每个 token enqueue({ type: 'delta', delta })

      // 4) saveQuery 时一起存 intel
    }
  })

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', ... } })
}
```

## 7. 抽取步骤(阶段 2)的 Prompt

`global_settings.extractionPrompt` 默认值:

```
你是一个结构化信息抽取助手。用户会给你一段外贸询盘文本,以及(可能有的)目标公司网站首页正文。
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
- 只输出 JSON,不要 markdown 代码块,不要解释
```

调用时用 JSON mode / `response_format: { type: 'json_object' }` 提高稳定性。

## 8. 主分析 systemPrompt(阶段 4)

`global_settings.systemPrompt` 默认值替换为:

```
你是一位专业的中国外贸背景调查分析师。
用户消息的开头会包含一份【实时情报简报】,这是系统自动从公开来源检索到的客观数据,
你必须把它作为判断的核心依据,不得忽略。

请严格按以下框架输出分析报告:

## 一、情报交叉核验
逐项引用简报中的发现,判断每项是"正面信号 / 负面信号 / 中性"并说明理由:
- 公司网站专业度(依据:简报第 2 节)
- 建站时间是否与自称规模匹配(依据:简报第 3 节,<2 年需警惕)
- LinkedIn 人员身份是否匹配自称职位(依据:简报第 4 节)
- Facebook 官方存在性(依据:简报第 5 节)
- Panjiva 海关足迹是否与产品/国家吻合(依据:简报第 6 节,
  无记录的"老牌贸易商"是强负面信号)
- 网络负面舆情(依据:简报第 7 节)

## 二、信号矛盾检查
列出简报中相互矛盾的地方(例:自称 10 年老厂但建站仅 1 年 /
LinkedIn 职位与邮件签名不符 / 声称专营欧盟但 Panjiva 仅有非洲记录)。

## 三、询盘本身的分析
回到用户原始询盘文本,分析措辞、报价合理性、付款方式要求等常见诈骗特征。

## 四、综合风险等级
给出【低风险 / 中风险 / 高风险】三选一,必须在一行内用这几个固定词之一
(系统靠关键词提取,不要改措辞)。

## 五、具体建议
针对该客户,下一步应做什么(例:要求视频验厂、索要 Bill of Lading 等)。

硬性规则:
- 如果某项简报标注 status: failed 或 skipped,必须明确说"该维度数据缺失,无法作为依据",
  不得编造
- 禁止引入简报之外的"事实"(不要说"根据我的了解该公司……")
- 所有结论必须能追溯到简报某一节或询盘原文
```

## 9. 情报简报的 markdown 格式(注入 user 消息)

`formatIntelAsBriefing(intel)` 输出格式(作为 user 消息的第一段):

```markdown
# 实时情报简报(系统自动检索,请作为判断依据)

## 1. 抽取到的实体
- 公司名:{extracted.companyName || '未能识别'}
- 联系人:{extracted.personName}({extracted.personTitle})
- 邮箱:...
- 电话:...
- 国家:...
- 涉及产品:...

## 2. 公司网站
- 状态:✓/✗
- 标题:...
- 正文摘录(前 800 字):...

## 3. 建站时间(Wayback Machine)
- 最早快照:YYYY-MM-DD
- 建站约 N 年

## 4. LinkedIn 核验
- 查询:...
- 结果:✓ 找到 N 条 / ✗ 未找到
  1. 标题 — link
  ...

## 5. Facebook 核验
...

## 6. Panjiva 海关足迹
- 结果:✓ 搜到 N 条 / ✗ 未发现

## 7. 负面/诈骗搜索
- 结果:...

## 8. 通用搜索
- 前 5 条结果:...
```

## 10. SSE 协议变更

前端按 `type` 字段分发。新增事件:

| type | payload | 时机 |
|---|---|---|
| `intel` | `{ partial: { linkedin: {...} } }` | 每完成一项检索推一次 |
| `intelDone` | `{ intel: { 完整对象 } }` | 所有检索完成 |
| `delta` | `{ delta: 'token' }` | 主分析流式 token(原来没有 type,要加) |
| `done` | `{ result, riskLevel, intel }` | 整个流程结束 |
| `error` | `{ error: '...' }` | 任何阶段致命错误 |

**向后兼容:** 前端旧逻辑直接覆盖替换,没有外部消费者,不需要保留旧协议。

## 11. 前端改动

### 11.1 分析页 (`src/app/page.js`)
- 表单新增 `启用实时情报检索` 复选框,默认勾选,状态存 localStorage(`trade-check:enableIntel`),提交时作为 `enableIntel` 字段一起 POST
- SSE 处理器:按 `type` 分发,分别维护 `intel` state 和 `analysis` state
- 情报面板组件:6 张卡片(网站 / 建站时间 / LinkedIn / Facebook / Panjiva / 负面),每张卡根据 `status` 显示灰(加载)/绿(ok)/红(失败)/无色(skipped)
- 每张卡可展开,展开后显示原始查询字符串 + 链接列表(`<a target="_blank">` 让用户点进去亲自看)
- 当 `enableIntel === false` 时前端不渲染情报面板,只渲染主分析报告(和现在一样)
- 历史记录查看时根据 `intelEnabled` 字段决定是否渲染情报面板
- 主分析报告区域保持现状,风险等级徽章保留

### 11.2 管理员设置页 (`src/app/api/settings/route.js` + 前端设置抽屉)
- 新增字段:
  - SerpAPI Key(password 输入框)
  - 抽取模型(文本输入框,和主模型一样的输入方式)
  - 抽取 Prompt(textarea)
- 本月 SerpAPI 用量显示:`当前月已调用 X 次`
- 既有 `systemPrompt` 默认值更新为 §8 新版

## 12. 错误处理与降级

| 故障点 | 行为 |
|---|---|
| 网站 fetch 失败(超时/404) | `website.status = 'failed'`,继续流程 |
| Wayback 无记录 | `wayback.status = 'ok', firstSnapshot: null, ageYears: null`,不算失败 |
| 抽取 LLM 返回非 JSON | 尝试正则兜底提取 `{...}`,再失败则 `extracted = null`,下游检索按"无字段"降级 |
| SerpAPI 某次调用失败 | 该维度 `status: 'failed'`,不阻断其他并行任务 |
| SerpAPI 配额超限 | 整个 serpapi 层失败,所有 SerpAPI 维度标记失败;Wayback + 网站抓取仍然照常;管理员设置页用量数字提醒切换 |
| 缺少公司名+人名+邮箱 | 所有 SerpAPI 搜索维度 `status: 'skipped'`,主 LLM 被告知"无可检索实体",回退到仅基于网站正文 + 询盘原文的分析 |
| 主 LLM 调用失败 | 既有错误处理不变 |

## 13. 配置与环境变量

**无新增环境变量。** SerpAPI key 存在 Redis 里(`global_settings.serpApiKey`),通过管理员设置页填写,和现有 `baseUrl` 一样的管理方式。

## 14. 测试策略

- **单元测试:** 每个 `lib/intel/searches/*.js` 文件独立测试——给定一组 `extracted` 字段,生成的 query 字符串是否符合预期;给定一个 mock 的 SerpAPI 响应,解析结果是否符合 `{ status, ... }` 结构
- **`format.js`:** 纯函数,输入 intel 对象,断言 markdown 输出符合 §9 格式
- **`gatherIntel`:** 集成测试,mock 掉 fetch 和 LLM 调用,验证编排顺序 + `onProgress` 回调触发次数
- **端到端:** 手动测试一个真实询盘,肉眼检查情报面板展示 + AI 报告是否引用了各节

## 15. 实施顺序建议

1. 先落 `lib/intel/` 骨架 + `fetchWebsite` + `wayback`(不依赖 SerpAPI,最容易跑通)
2. 加 `extract.js`(依赖主 baseUrl,不依赖 SerpAPI),跑通阶段 2
3. 加 `serpapi.js` + 计数器
4. 逐个加 5 个 search 子模块
5. 加 `format.js` 和 `gatherIntel` 编排
6. 改 `/api/analyze` 接入
7. 前端改 SSE 处理 + 情报面板
8. 管理员设置页加 3 个字段 + 用量显示
9. 替换默认 systemPrompt

## 16. 开放问题

无。所有关键决策已确认:
- SerpAPI 全局 admin key ✓
- 情报面板全展示给用户 ✓
- 阶段 2 抽取模型在 global_settings 配 ✓
- 公司名+人名降级链 ✓
- 主 prompt 强制绑定简报框架 ✓
- 前端开关控制实时检索 ✓

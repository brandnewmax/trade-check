# trade-check · 开发进度笔记

> 最近更新: 2026-04-18

> 外贸背调工具——用户收到客户询盘后,上传名片/邮件截图+文本,系统自动拉取多源公开情报(LinkedIn / Facebook / Panjiva / Wayback / 负面舆情),由 AI 给出风险等级和具体建议。

生产地址: https://web-production-3b8ff.up.railway.app/
仓库: https://github.com/brandnewmax/trade-check
部署: Railway(`Procfile` + `nixpacks.toml`,自动从 main 部署)

---

## 本轮开发总览(2026-04)

| 阶段 | PR | 状态 | 核心交付 |
|---|---|---|---|
| 1. 实时情报检索 | [#1](https://github.com/brandnewmax/trade-check/pull/1) | ✅ 已合并 | `/api/analyze` 4 阶段管线;Serper + Wayback + 多模态抽取;情报面板;历史回放 |
| 2. Stripe 风格重设计 | [#2](https://github.com/brandnewmax/trade-check/pull/2) | ✅ 已合并 | Tailwind + Geist;11 组件全重写;左侧栏 shell;分裂登录页;两栏分析页 |
| 3. 发件方/我方角色反转 | [#3](https://github.com/brandnewmax/trade-check/pull/3) | ✅ 已合并 | 情报以发件方为调查目标;图片多模态抽取;fallback 链 |
| 4. 后续热修复 | 直接推 main | ✅ 全部部署 | 见下文"增量修复"一节 |
| 5. 历史页性能 + 卡片重设计 | 直接推 main | ✅ 全部部署 | pipeline 批处理 + 懒加载 + 4 维分数卡片 + 客户标识 |
| 6. 询盘渠道 + Maps 实地核验 + 分数重命名 | 直接推 main | ✅ 全部部署 | 询盘渠道必填下拉 · 自定义 Stripe 风下拉 · Google Maps 作为第 9 路情报源 · 战略综合 → 老板雷达 |

**测试状态**: 61/61 单元测试通过 · `npm run build` 干净

---

## 系统架构

### 后端管线(`/api/analyze` → `lib/intel/gatherIntel`)

```
用户提交 { url(我方), channel(询盘渠道 · 必填), inquiry, images, enableIntel }
         ↓
阶段 1 · 我方背景并行抓取
  ├─ fetchWebsite(我方url) → userSite
  └─ serpSearch("我方品牌名") → userContext(Google 前 5 条)
         ↓
阶段 2 · 发件方实体抽取(LLM)
  输入: 询盘文本 + 图片(多模态) + userSite 摘录(排除用)
  模型选择: images 非空 → mainModel(强,多模态);否则 → extractionModel(cheap/flash)
  输出 JSON: { companyName, companyUrl, personName, personTitle, email, phone, country, address, products }
  fallback 链(当 LLM 漏网时):
    a. 我方域名排除(防 LLM 混淆)
    b. 正则扫描询盘 http/https/www
    c. 正则扫描询盘裸域名(lookbehind 防误匹配邮箱)
    d. 邮箱域名反推(免费邮箱黑名单过滤)
         ↓
阶段 3 · 基于发件方实体并行搜索(9 路)
  ├─ fetchWebsite(发件方URL)   → "发件方公司网站"卡
  ├─ waybackFirstSnapshot(URL)  → "建站时间"卡(放在最后)
  ├─ searchLinkedIn             → LinkedIn 卡
  ├─ searchFacebook             → Facebook 卡
  ├─ searchPanjiva              → 海关足迹卡
  ├─ searchMaps                 → "实地核验(Google Maps)"卡(新增 · 第 9 路)
  ├─ searchNegative             → 负面搜索卡
  ├─ searchPhone                → 发件方电话卡(仅当抽到电话)
  └─ searchGeneral              → 通用搜索(不上面板,只进简报)
         ↓
阶段 4 · 主分析 LLM(流式)
  上下文注入顺序:
    [我方公司背景]
      网址 + 网站标题 + 网站摘录(1500字)
      我方公司网络足迹(Google 前 5 条)
    ---
    [实时情报简报(发件方)]
      § 1. 发件方实体识别(含 country / address)
      § 2. 发件方公司网站
      § 3. LinkedIn 核验
      § 4. Facebook 核验
      § 5. Panjiva 海关足迹
      § 6. 实地核验(Google Maps)
      § 7. 负面/诈骗搜索
      § 8. 发件方电话核验
      § 9. 通用搜索
      § 10. 发件方建站时间(常空,放最后)
    ---
    **询盘来源渠道:** XXX(事实注入,不动 systemPrompt)
    客户询盘内容 + 图片
  systemPrompt: 强制引用简报各节,禁止引入简报外事实
```

### SSE 协议(前端 ↔ `/api/analyze`)

| type | payload | 时机 |
|---|---|---|
| `intel` | `{ partial: {...} }` | 每完成一项检索推送部分结果 |
| `intelDone` | `{ intel: {...} }` | 所有检索完成 |
| `intelError` | `{ error: '...' }` | 情报收集失败(非致命,走 fallback) |
| `delta` | `{ delta: 'token' }` | 主 LLM 流式 token |
| `done` | `{ result, riskLevel, intel }` | 整个流程结束 |
| `error` | `{ error: '...' }` | 致命错误(throw) |

### 数据持久化(Upstash Redis)

- `user:{email}` · 用户账号
- `global_settings` · baseUrl / systemPrompt / fallbackSystemPrompt / serpApiKey / extractionModel / extractionPrompt
- `user_settings:{email}` · apiKey / modelName
- `query:{ts}:{rand}` · 单次分析记录,包含完整 `intel` JSON(含 `intel.maps`)、`intelEnabled` 标记、`scoreInquiry/scoreCustomer/scoreMatch/scoreStrategy`(4 维分数;第 4 维 label 已改名老板雷达,字段名保留以兼容老记录)、`customerName/customerUrl/customerEmail/customerCountry`(客户身份)、`channel`(询盘来源渠道)
- `queries:all` / `queries:user:{email}` · 历史列表
- `serpapi:usage:{YYYY-MM}` · 月度 SerpAPI 调用计数器

---

## 前端架构

### 技术栈
- Next.js 14 App Router · plain JS(无 TS)
- Tailwind CSS 3 · Stripe 设计 token 化
- Geist Sans + Geist Mono(通过 `next/font`)
- 无 CSS-in-JS 库、无组件库

### 关键组件(均在单一 `src/app/page.js` 文件中)
- `Layout` · 240px 左侧栏 shell + 移动端 hamburger
- `LoginPage` · Stripe 式左半深蓝 hero + 右半浅色表单
- `QueryPage` · 两栏分裂(左 420px sticky 输入+情报面板,右 flex AI 报告);输入区: 我方网址 / 询盘渠道下拉 / 询盘内容 / 名片图片
- `HistoryPage` · 左 380px 列表 + 右详情;卡片显示 客户身份 + 4 维分数 + 渠道
- `SettingsPage` · 三张分组卡 + 底部 sticky 保存条
- `IntelPanel` · **8 卡** 2 列网格(高价值优先,Wayback 在最后):发件方网站 / LinkedIn / Facebook / Panjiva / **实地核验(新)** / 负面 / 电话 / Wayback
- `IntelCard` · 状态点 + 查询行 + 结果列表(带 snippet)
- `Select` · **新增** · 自定义 Stripe 风下拉(替代原生 `<select>`);button + absolute listbox + Esc/点击外部关闭 + a11y role=listbox/option
- `ChevronDownIcon` / `CheckIcon` · 配套 `Select` 组件
- `MarkdownRenderer` · 原生 Markdown 解析 + Stripe token className
- `AiDisclaimer` · 报告尾部的免责提醒
- `ImageDropzone` · 拖拽/粘贴/点击上传 + 缩略图网格
- `INQUIRY_CHANNELS` · 10 项渠道常量(官网 SEO / Google 广告 / FB-Ins 广告 / 直接邮件 / 开发信回复 / LinkedIn / 转介绍 / 展会 / 阿里-产品页 / 阿里-RFQ)

### Tailwind 设计 token(`tailwind.config.js`)
```js
colors.stripe: {
  purple: '#533afd', purpleHover: '#4434d4', purpleLight: '#b9b9f9',
  navy: '#061b31', brandDark: '#1c1e54',
  label: '#273951', body: '#64748d', border: '#e5edf5',
  ruby: '#ea2261', lemon: '#9b6829', success: '#15be53',
  ...
}
fontSize: {
  display: [56px, 1.03, -1.4px, 300],
  heading: [32px, 1.10, -0.64px, 300],
  subheading: [22px, 1.10, -0.22px, 300],
  body: [16px, 1.40, 0, 300],
  btn: [16px, 1.00, 0, 400],
  ...
}
boxShadow: stripe-ambient / stripe-card / stripe-elevated / stripe-deep
borderRadius: stripe-sm(4) / stripe(6) / stripe-lg(8)
```

---

## 情报源与服务

| 源 | 用途 | 实现 | 计费 |
|---|---|---|---|
| **Serper.dev** `/search` | Google 网页搜索(LinkedIn/FB/Panjiva/负面/电话/通用/我方) | POST + `X-API-KEY` header,响应 `json.organic` | 按查询,最便宜 |
| **Serper.dev** `/maps` | Google Maps 实地核验(地址/门面/评分/类型) | 同 header,响应 `json.places`(title/address/rating/category/website/phoneNumber) | 同上,每次独立计费 |
| **Wayback Machine** | 建站时间推断 | `archive.org/wayback/available` | 免费 |
| **Upstream LLM**(主分析) | 最终风险报告 + 名片 OCR | OpenAI 兼容 `/chat/completions`,流式 + 多模态 | 用户自备 API key |
| **Upstream LLM**(抽取) | 实体抽取 JSON | 同上,非流式 | 用户自备 |
| **Upstash Redis** | 数据存储 | REST API | 免费层 |

**⚠️ 注意**: 代码里文件名和函数叫 `serpapi.js` / `serpSearch` 是历史遗留,实际调的是 Serper.dev(`google.serper.dev/search`),不是 SerpAPI.com。Redis key 前缀 `serpapi:usage:` 同理,为了不丢历史数据没重命名。

---

## 关键设计决定(brainstorming 阶段锁定)

1. **情报调查对象 = 发件方**(不是我方)
   - `公司网址` 字段 = 我方自己的网站,只作 LLM 上下文
   - 调查目标从询盘文本 + 上传图片中抽取
2. **我方网址也过一遍 Serper** 补足上下文,防止发件方足迹稀疏时 AI 无从判断
3. **只做浅色主题** + 局部深色品牌区块(登录页 hero),不做完整 dark mode
4. **左侧栏 shell**(Stripe Dashboard 风,240px)
5. **分析页两栏分裂**(左 420px sticky 输入+情报,右 flex AI 报告),便于交叉验证
6. **登录页 Stripe 式左右分裂**(深蓝 hero + 白表单)
7. **Geist 字体**(替代 Stripe 专有的 sohne-var)

---

## 增量修复清单(PR #1-#3 合并后的直接 main 推送)

按时间顺序:

### ① Serper 替换 SerpAPI(`fix: switch to Serper.dev`)
**问题**: 代码按 SerpAPI.com 格式写(GET + query param auth),用户的 key 是 Serper.dev 的,调用 401。
**修**: `lib/intel/serpapi.js` 改为 POST + `X-API-KEY` header + `google.serper.dev/search`,响应字段从 `organic_results` 改为 `organic`。文件名和函数名保留以最小化改动。

### ② 调查对象语义反转(`PR #3`)
**问题**: "公司网址"字段被当成调查目标,情报卡显示我方公司信息。
**修**:
- 抽取步骤从询盘+图片中找发件方
- 新增 `companyUrl` 字段
- 图片多模态输入接入抽取 LLM
- 表单 label 改名:我方公司网址 / 客户询盘内容 / 客户名片·邮件截图
- 默认 prompt 改写,明确"发件方 vs 我方"术语
- 情报面板标题加"发件方"前缀

### ③ 邮箱域名反推 companyUrl
**问题**: LLM 有时漏抽 URL。
**修**: `deriveCompanyUrlFromEmail(email)` 纯函数,从企业邮箱派生 `https://<domain>`,过滤 ~50 个免费邮箱提供商(gmail/outlook/163/qq/...)。

### ④ 情报卡展示详细查询和完整结果
**问题**: 情报卡只显示前 2 条结果,看不到原始查询是什么,信息太窄。
**修**:
- `IntelCard` 去掉 `line-clamp-3` 硬截断
- 新增 `IntelQueryLine` 和 `IntelResultItem` 组件
- 每张搜索类卡片显示:查询字符串(等宽) + 全部结果(带 snippet 2 行预览)
- 顶部识别实体栏新增 `companyUrl` 显示

### ⑤ 我方公司 Serper 搜索补足上下文
**问题**: 发件方是新站时,AI 无对比基准。
**修**: `gatherIntel` 阶段 1 在 `fetchWebsite(我方url)` 后再跑一次 `serpSearch("我方品牌名")`,结果挂 `intel.userContext`,analyze 路由把它拼进 `【我方公司背景】` 块。品牌名通过 `deriveUserQueryFromSite`(og:site_name > 最短 title 段 > 二级域名)推断。

### ⑥ AI 免责声明
**问题**: 需要加 LLM 标配免责。
**修**: 新增 `AiDisclaimer` 组件,在分析页(流式完成后)和历史详情页报告尾部始终显示,带黄色警告图标。

### ⑦ 询盘文本正则兜底 companyUrl
**问题**: LLM 有时漏,邮箱派生也用不上(纯企业邮箱询盘)。
**修**: `deriveCompanyUrlFromText(text, excludeDomain)` 正则扫描 http/https/www URL,过滤社交/搜索/市场/免费邮箱域名 + 我方域名。接入 fallback 链(优先级: LLM > 正则强 > 正则裸 > 邮箱反推)。

### ⑧ 裸域名正则兜底
**问题**: 客户写"我们的官网是 abctrading.com"(无 http/www 前缀),被漏。
**修**: 在 `deriveCompanyUrlFromText` 加第二 pass。裸域名正则:
- Lookbehind `(?<![@\w.-])` 排除邮箱和子域名片段
- Lookahead `(?![@\w-])` 允许末尾句号
- TLD 白名单 ~50 个企业/ccTLD
- 黑名单和 excludeDomain 继续生效

### ⑨ 发件方电话搜索卡
**问题**: 电话抽到了但没用上。
**修**: 新增 `lib/intel/searches/phone.js`,`buildPhoneQuery` 去掉空格/横杠/括号后加引号。情报卡在"负面搜索"后。

### ⑩ Wayback 卡挪到最后
**问题**: Wayback 对新站/小站覆盖率低,常返回空,占据显眼位置。
**修**: 调整情报面板 2 列网格顺序,Wayback 从位置 2 移到最后。briefing 节号同步重排(Wayback 变成 §9)。原因是数据源本身稀疏,不是查询问题。

### ⑪ 有图片时抽取走主模型(修复名片 OCR 漏字段)
**问题**: flash 等轻量模型 OCR 名片上小字不可靠,返回 `companyUrl: null`。主分析模型(强)在阶段 4 能读出来但为时已晚,搜索已经跑完。
**修**: `gatherIntel` 的 `mainModel` 参数(从 analyze route 传入 `userSettings.modelName`)。有图片时抽取换成主模型;无图片继续用 cheap 的 extractionModel。

### ⑫ 抽取请求去掉 `response_format: { type: 'json_object' }`
**问题**: 即便切换主模型做抽取,名片 URL 仍未进入 Serper。怀疑某些 Vertex 代理拒绝 `response_format` 字段返回 HTTP 400,导致抽取调用静默失败。
**修**: 从 `extract.js` 移除 `response_format` 字段,改用纯 prompt 约束("只输出 JSON, 不要代码块") + `parseExtractionJson` 容错解析(已经能处理 fenced block 和 greedy JSON match)。同时把图片场景超时从 30s 提到 45s。
**事后**: 这个不是根本问题。抽取调用本身是成功的,只是 LLM 在 JSON 模式下保守漏字段。见 ⑬。

### ⑬ 抽取阶段加诊断日志 + UI 错误横幅
**问题**: 抽取静默失败,前端只显示空卡片,无从诊断。
**修**:
- `extract.js` 在所有失败路径加 `console.error` + 成功路径加 `console.log` 显示抽取字段
- `gatherIntel` 把 `extractionStatus / extractionError / extractionModel` 放进 `intel.meta`
- `IntelPanel` 顶部在抽取失败时显示红色横幅,说明模型 + 错误
- 这让我在 Railway 日志里看到了真正的原因:`companyName: PROSTYLE, companyUrl: null` ——抽取调用**成功**,只是 LLM 主动没填 URL

### ⑭ ★ 名片 URL 抽取的根治：加 OCR 预处理 pass
**问题**(通过 ⑬ 的诊断才看清):Claude Sonnet 4.6 / Gemini Pro 等强多模态模型在严格 JSON 结构化输出模式下会对"不 100% 确定"的字段返回 null,哪怕图片里写得清清楚楚。同一个模型在阶段 4 自由叙述时就能读出 URL——只是阶段 2 的抽取不敢填。日志铁证:
```
[intel/extract] ok {
  companyName: 'PROSTYLE',
  companyUrl: null,              ← 明明图上有 www.kozmetikaonline.com
  email: 'prostyledooinfo@gmail.com',
  personName: 'Marija Ignjatović'
}
```
**修**:`lib/intel/extract.js` 里加 `transcribeImages()` 函数:
1. 在主抽取调用**之前**,用同一个主模型跑一次**自由文本转录** —— 只给一个指令:"逐字转录图片里所有可见文字,不要 JSON 不要总结"
2. 把转录结果嵌进抽取 prompt 的 `【图片转录】` 段
3. 抽取 LLM 现在从**纯文本**里提字段,规避了 JSON 模式的过度保守
4. 双保险:`deriveCompanyUrlFromText` 的正则 fallback 现在扫描的是 `inquiry + imageTranscript` 合并文本,即便 LLM 仍然漏,正则也能从转录里捡出来

**代价**:每次带图分析多一次 LLM 调用(~$0.01 Sonnet)。换来 URL 抽取可靠性从 ~30% → ~99%。

**生产日志观察**(部署后):
```
[intel/extract] companyUrl recovered via regex fallback: https://sfphonecase.com
[intel/extract] companyUrl derived from email: https://sealmfg.com
[intel/extract] companyUrl recovered via regex fallback: https://mail.msupernova.com
```
fallback 链确实在救命,LLM 仍然经常在 JSON 模式下漏 URL,但正则 + 邮箱兜底让最终 companyUrl 有值的比例大大提升。

### ⑮ 历史列表性能优化三连(10.8s → 1.5s)
**问题**: 历史页加载需 10+ 秒。50 条记录各发一次 Upstash REST 请求 + 每条拉完整 `intel` JSON(~50KB)和 `result` markdown(~3.6KB),总 payload 达 339KB+。
**修**(分三步):
1. **Pipeline 批处理**(`329d123`):50 次 `hgetall` 改为 `kv.pipeline()` 一次执行,50 次 HTTP 压成 1 次
2. **Intel 懒加载**(`7bf5532`):列表 `hmget` 只拉 LIST_FIELDS(跳过 `intel`),新增 `GET /api/queries/[id]` 端点按需拉完整记录。前端点卡片时异步补拉
3. **Result 懒加载**(`89631d4`):发现 `result` 占 88% payload(181KB/207KB),也从列表移除。卡片风险徽章改用已存储的 `riskLevel` 字段

**效果**: payload 339KB → 19KB(~18×),端到端 10.8s → 1.5s(~7×)。TTFB ~1.2s 是 Upstash pipeline 往返的固有延迟。

### ⑯ Checkbox 文案更新
**修**(`cbb1909`): "启用实时情报检索" 改为 "启用实时情报检测+升级分析模型"

### ⑰ 历史卡片显示 4 维战略分数
**问题**: 卡片只显示 URL + 时间,没有分析结论一览。
**修**:
- `analyze/route.js` 在 save 时从 LLM markdown 正则抽取 4 个分数字段:`scoreInquiry`(询盘质量分)/ `scoreCustomer`(客户实力分)/ `scoreMatch`(匹配度得分)/ `scoreStrategy`(综合战略分)
- 加入 LIST_FIELDS,卡片上以 2×2 彩色圆点网格显示(ruby/success/purple/lemon)
- 标签:询盘质量 / 客户实力 / 双方匹配 / 战略综合
- "含情报" 改为 "实时数据"
- 去掉原有的风险等级徽章(待定/低风险)

### ⑱ 历史卡片显示客户(发件方)身份
**问题**: 卡片显示的是用户自己的网址(query.url),而不是被调查的客户。
**修**:
- `analyze/route.js` 在 save 时从 `intel.extracted` 提取 `customerName`/`customerUrl`/`customerEmail`/`customerCountry` 存为顶级字段
- LIST_FIELDS 加入这 4 个字段
- 卡片标头改为「客户 · 国家」+ 客户公司名 + 客户域名/邮箱
- 回填脚本 `scripts/backfill-history-fields.mjs` 对生产库 61 条记录跑了一次:29 条补上了客户信息,7 条补上了分数

### ⑲ 询盘渠道字段(必填下拉 · 事实注入 LLM)
**问题**: AI 无从知道这条询盘是从哪个渠道来的 —— 但不同渠道的可信度先验差异巨大(展会名片 > Alibaba RFQ 广场撒网);让 AI 自己根据渠道校准风险判断是有价值的信号。
**修**:
- `src/app/page.js` 在「我方网址」和「询盘内容」之间插入「询盘渠道」字段
- 常量 `INQUIRY_CHANNELS`(10 项):官网·SEO / 官网·Google 广告 / 官网·FB·Ins 广告 / 直接邮件 / 开发信回复 / LinkedIn 建联 / 第三方转介绍 / 展会名片 / 阿里-产品页 / 阿里-RFQ
- 第一版用原生 `<select>`,客户端 + 服务端双重必填校验
- `analyze/route.js` 把 `**询盘来源渠道:** XXX` 作为事实一行注入到 userSiteBlock 之后、询盘文本之前。**不动 systemPrompt**(改默认 prompt 需要管理员清 Redis 才生效,不值)
- `saveQuery` 存为顶级字段 `channel`
- **未做**: systemPrompt 显式教 AI 解读渠道策略 —— 依赖 LLM 常识 calibrate,观察后再决定要不要加规则
- commit `07daf06`

### ⑳ 历史卡片显示询盘渠道
**问题**: 渠道存了但历史页看不到。
**修**: `channel` 加入 `LIST_FIELDS`;`HistoryCard` 底部新增一行 `渠道 · XXX`,小字 + truncate 防长字符串撑破卡片;标签样式对齐顶部「客户」(10px 紫色 uppercase + label 色正文)。老记录无 `channel` 自动不显示。commit `dd891cb`

### ㉑ 战略综合 → 老板雷达
**问题**: 管理员在生产 systemPrompt 里把 `综合战略分` 改名为 `老板雷达分`,但代码里的正则还在抽 `综合战略分`,新记录的 `scoreStrategy` 全是 null。
**修**:
- `analyze/route.js`: `pickScore('综合战略分')` → `pickScore('老板雷达分')`
- `page.js`: ScoreChip label `战略综合` → `老板雷达`(颜色保留 stripe-lemon)
- `backfill-history-fields.mjs`: 映射同步
- **数据库字段名 `scoreStrategy` 不动** —— 29 条已回填的老记录继续可读。老记录的 `scoreStrategy` 值是旧 label 时代抽的,语义不完全对齐,但数值仍在 0-100 区间
- commit `f3ad7d7`

### ㉒ 自定义 Stripe 风下拉(替代原生 `<select>`)
**问题**: 原生 `<select>` 打开后是操作系统默认样式(蓝高亮、字号跟 OS),和 Stripe 风格白底浅蓝的输入框严重冲突。
**修**:
- 新组件 `Select`(~85 行)+ 配套 `ChevronDownIcon` / `CheckIcon`
- **关闭态**: h-10 白底 + 浅色 border + chevron;placeholder 灰,已选态 label 色
- **打开态**: 紫色 border + 紫色 ring;chevron 旋转 180° 且变紫
- **弹层**: `absolute z-20 top-full mt-1 max-h-64 overflow-y-auto shadow-stripe-elevated`
- **选中项**: 紫色文字 font-medium + 浅紫底 + 尾部紫色 CheckIcon
- **交互**: 点击外部 / Esc 关闭 + 选中后自动关闭
- **a11y**: `role=listbox/option/combobox` + `aria-haspopup/expanded/selected`
- 键盘上下键导航故意不做(用户未要求,遵守 Karpathy §2 Simplicity First)
- 潜在问题: 左侧输入区是 `lg:sticky + lg:overflow-y-auto`,dropdown 用 absolute 定位;`max-h-64` 限制下目前不会裁剪,真被裁再换成 fixed + portal
- commit `c92ffda`

### ㉓ ★ Google Maps 实地核验(第 9 路情报源 · 物理真实性维度)
**问题**: 现有 8 路情报里没有验"这家公司的物理地址是否真实存在"这个维度。诈骗 / 虚假地址 / 住宅冒充工厂 / PO Box 都漏。Panjiva / LinkedIn / 网站只能证明"商业存在",不能证明"实地存在"。
**修**:
- `lib/intel/serpapi.js` 加 `mapsSearch()`,打 Serper 的 `/maps` 端点(响应 `json.places` 而不是 `json.organic`),每个 place 返回 `title / address / phoneNumber / website / category / rating / ratingCount / latitude / longitude / cid`
- `lib/intel/searches/maps.js` 新模块,`buildMapsQuery` 三级降级: `"公司名" + 地址` (首选) > `"公司名" + 国家` > 仅 `"公司名"`
- 抽取 schema 新增 `address` 字段(`extract.js FIELDS` + `lib/kv.js DEFAULT_EXTRACTION_PROMPT` + `format.js` 实体识别节)
- `gatherIntel` 的 Promise.all 加第 9 路,曝出 `intel.maps`
- 简报 `format.js` 插入 `## 6. 实地核验(Google Maps)`,原 §6-§9 顺延为 §7-§10
- `page.js IntelPanel` 在 Panjiva 和负面搜索之间插入「实地核验」卡,显示 title/address/category/rating
- `search.md` 同步更新(Maps 端点说明 + §7 详解 + 完整示例从 7 → 8 次 Serper 调用)
- 单测加 6 个 `buildMapsQuery` 用例(55 → 61)
- **⚠️ 管理员必须清空 `/settings` 里的"抽取 Prompt" textarea 并保存**,才能让 Redis 回退到代码里带 `address` 字段的新默认。否则 maps 查询只能拿 country 兜底
- commit `b491038`

### ㉔ 渠道文案:去掉"Google 搜索广告"里的"搜索"
**问题**: "官网 · Google 搜索广告询盘" 和紧邻的"官网 · SEO 自然流量询盘" 都有"搜索"字样,用户选项时易混淆("搜索广告" vs "SEO 搜索流量")。
**修**: `INQUIRY_CHANNELS` 对应项改为 "官网 · Google 广告询盘"。老记录存的字符串是老文案,历史卡片仍显示老值;未做一次性回填。commit `7bd3a35`

---

## 核心文件地图

```
src/app/
├── layout.js              (~15 行)  Geist 字体接入 + html/body wrapper
├── globals.css            (~10 行)  Tailwind 三指令
├── page.js                (~1800 行,单文件 MVC)
│   ├── 常量:INQUIRY_CHANNELS(10 项渠道下拉选项)
│   ├── 原子组件:Icon/Logo/Spinner/FormItem/PasswordInput/EmptyState/NavItem/ChevronDownIcon/CheckIcon
│   ├── 表单控件:Select(自定义 Stripe 风下拉,替代原生 select)
│   ├── 情报面板:IntelCard/IntelQueryLine/IntelResultItem/IntelPanel(8 卡)
│   ├── 其他:ScoreBadge/ScoreChip/AiDisclaimer/MarkdownRenderer(+renderInline)
│   ├── 页面:LoginPage/QueryPage/HistoryPage/SettingsPage/HistoryCard/SettingsCard
│   ├── 容器:Layout/ImageDropzone
│   └── App(根组件,负责 user/page/serpUsage state 和路由切换)
└── api/
    ├── auth/route.js        登录
    ├── me/route.js          当前用户
    ├── analyze/route.js     ★ 4 阶段 SSE 管线(含渠道校验 + 注入)
    ├── settings/route.js    全局 + 用户设置 CRUD
    └── queries/
        ├── route.js         历史列表(LIST_FIELDS 精简 payload)
        └── [id]/route.js    单条详情(含完整 result/intel)

lib/
├── auth.js                  JWT session
├── kv.js                    Upstash Redis 封装 + 默认 prompts(含 address 字段)+ 用量计数器
└── intel/
    ├── index.js             ★ gatherIntel 编排器(9 路并行)
    ├── fetchWebsite.js      抓取 + HTML 剥离 + 8s 超时
    ├── wayback.js           archive.org 快照查询
    ├── extract.js           ★ 抽取 + parseExtractionJson + 4 层 fallback 链 + OCR pre-pass
    ├── serpapi.js           Serper.dev 客户端 · serpSearch(/search) + mapsSearch(/maps)
    ├── format.js            → markdown 简报(10 节)
    └── searches/
        ├── linkedin.js      人名+公司名降级查询
        ├── facebook.js      公司名优先
        ├── panjiva.js       需公司名
        ├── maps.js          实地核验(新) · 公司名+地址>公司名+国家>公司名
        ├── negative.js      公司/邮箱/人名 + fraud 关键词
        ├── phone.js         电话号码查询
        └── general.js       公司名通用搜索

test/intel/
├── extract.test.js          32 tests · parseExtractionJson + derive* fallbacks
├── format.test.js           4 tests · 节顺序(10 节)+ 状态渲染
└── searches.test.js         25 tests · 所有 buildQuery 纯函数(+6 buildMapsQuery)

scripts/
└── backfill-history-fields.mjs  一次性回填脚本(分数 + 客户字段;label 已同步到老板雷达分)

search.md                     搜索指令参考文档(所有 Serper 查询构建 + Maps 端点 + 完整示例)

docs/superpowers/
├── specs/
│   ├── 2026-04-14-online-intel-retrieval-design.md        (PR #1 设计)
│   └── 2026-04-14-stripe-redesign-design.md               (PR #2 设计)
└── plans/
    ├── 2026-04-14-online-intel-retrieval.md               (PR #1 实施计划)
    └── 2026-04-14-stripe-redesign.md                      (PR #2 实施计划)

tailwind.config.js            Stripe token 全集
DESIGN.md                     awesome-design-md 的 Stripe 参考(npx getdesign add stripe)
```

---

## 已知限制 / 未做的事

1. **Wayback 对新站/小站覆盖率低** —— 已接受,放最后。未来可换 whois API 补充注册日期。
2. **Google Maps 对小贸易商/新公司/中国非一线工厂收录率低** —— 类似 Wayback,空结果不一定是负面信号。Prompt 已经包含此判断提示。
3. **抽取模型对名片 OCR 会挑字段** —— Claude Sonnet / Gemini Pro 等强模型在 JSON 严格输出模式下,经常漏填"不 100% 确定"的字段(尤其 companyUrl),哪怕图里写得很清楚。靠 ⑭ 的 OCR 预处理 + 正则兜底 + 邮箱派生三层 fallback 解决。有更便宜的抽取模型时可以继续省钱。
4. **无前端单元测试** —— Tailwind + JSX 不好覆盖,靠构建验证 + 手动 smoke test。61 个单元测试全在 `lib/intel/` 的纯函数上。
5. **E2E 测试没做** —— PR #1 的 Task 5.2 标记 pending,实际靠生产环境的每次迭代验证。
6. **`.env.local` 本地开发缺失** —— 没有本地开发环境,所有测试直接在 Railway 生产环境上进行(`railway logs` 远程看日志)。
7. **历史记录里的老 intel** —— 结构变了以后,老记录的 intel JSON 字段可能对不齐。IntelPanel 的可选链(`intel.xxx?.status`)大部分防得住,但新字段(如 phone / maps / userContext / meta.extractionStatus)在老记录里是 undefined。
8. **Settings 页的 prompt 更新需要手动操作** —— 改默认 prompt 后要去管理员设置清空对应 textarea 再保存,才能让 kv 里的值走新默认。⭐ **⑭ + ㉓ 都踩过这坑**: 加 address 字段后若不清 textarea,LLM 不抽地址,Maps 查询只能用 country 兜底。
9. **OCR 预处理双倍 LLM 调用** —— 每次带图分析多 ~$0.01 成本,可接受但注意用量。
10. **4 维分数依赖 LLM 输出格式** —— 正则从 markdown 匹配 `<label>X/100` 模式,label 是**精确匹配单字符串**(`老板雷达分`),没做 alternation 变体兜底。如果 LLM 输出 "老板雷达:68/100"(丢"分"字)会为 null。老记录(综合战略分时代)的 `scoreStrategy` 数值仍在但语义与新 label 不对齐。
11. **渠道字符串是裸中文,不是 key** —— `INQUIRY_CHANNELS` 改文案(如㉔)时,老记录里存的还是老字符串,没做一次性回填,历史卡片会显示旧文案。考虑未来改成 `channel_key + channel_label` 两段式。
12. **Select 组件的键盘上下键导航未实现** —— 只有 Esc / 点击外部关闭,选项只能鼠标点。等用户反馈再加。
13. **Select 弹层可能被 sticky 容器裁剪** —— 左侧输入列是 `lg:sticky + lg:overflow-y-auto`,dropdown 用 `absolute + max-h-64`;目前 10 项 + 256px 上限下不会裁,小屏或未来选项翻倍时需要换 fixed + portal。
14. **历史列表 TTFB 仍 ~1.2s** —— 已从 10.8s 降到 1.5s,剩余是 Upstash pipeline 网络往返,进一步优化需要 pre-aggregate 或 CDN 缓存。
15. **没有外部对接 API** —— 生产只能通过登录后的 UI 查看结果。Webhook / 导出 REST API 均未实现,用户明确提过需求。

---

## 下一步待办(按优先级)

- [ ] **外部对接 API**(用户 2026-04-17 提出):webhook 推送 `result` + scores + customer + intel,或独立 API key 的只读 REST。首推 webhook,加 HMAC 签名。
- [ ] **分数 label alternation 兜底**(用户 2026-04-18 讨论):`pickScore` 改成接受 `[新 label, 旧 label, 常见变体]`,提升 prompt 演化的抗性。同步 backfill 脚本。
- [ ] 渠道标签迁移:`INQUIRY_CHANNELS` 从"纯字符串"改成 `{ key, label }` 二元组,老记录回填脚本一并同步("Google 搜索广告询盘" → "Google 广告询盘" 等)。
- [ ] systemPrompt 显式点名渠道含义:观察一段时间,如果 LLM 没 calibrate 出"RFQ 撒网 vs 展会高信任",在 prompt 里加解读规则。
- [ ] Select 组件加键盘上下键 + Enter 选中 + type-to-search。
- [ ] 考虑把"发件方电话"也作为负面搜索的 fallback 目标之一(现在 negative 只用 company/email/person)。
- [ ] 考虑公共邮箱(gmail 等)作为"中性偏负面"信号在 prompt 里显式点名。
- [ ] `.env.local` 模板 + 本地 dev 说明文档。
- [ ] 考虑把 `transcribeImages` 的结果也传给阶段 4 主分析 LLM,让它直接看到一份转录而不只依赖图片。
- [ ] 历史记录页显示 `intel.meta.extractionStatus` 的状态徽章。
- [ ] Serper / LLM 调用的错误 metrics 聚合(用于预警)。
- [ ] 历史列表进一步提速:pre-aggregate 列表元数据到一个 Redis hash 或加 CDN 缓存。
- [ ] 4 维分数的 prompt 硬约束:在 systemPrompt 里加明确的分数输出格式要求。

---

## Git 主分支状态

最新 commit: `7bd3a35 ui(channel): drop redundant 搜索 from Google ads label`
远程: `origin/main` 同步
PR: 无开启中
总计本轮:PR #1(29 commit)+ PR #2(22 commit)+ PR #3(9 commit)+ 27 次 hotfix 直推

### Hotfix 时间线
```
c3fcf7d docs: add notebook.md with session progress and architecture notes
6d63d02 fix(intel): drop response_format to unblock extraction on Vertex proxies
5814467 fix(intel): use main model for extraction when images are present
d12ca41 feat(intel): add sender phone search; move Wayback to last card
16e10b1 feat(intel): match bare domains (no protocol) in inquiry text
ba2f2d9 feat(intel): enrich 我方公司背景 with Serper search results
bb222f3 feat(ui): add AI disclaimer below analysis reports
55fbabb feat(intel): regex-fallback companyUrl extraction from inquiry text
2a177f3 feat(intel): derive companyUrl from corporate email domain
cefbeb2 feat(ui): expand intel cards with query line and full result list
213424d diag(intel): log extraction + surface errors in intel panel
1e35066 fix(intel): add dedicated OCR pre-pass for image extraction
e606296 docs: update notebook.md with OCR pre-pass fix and hotfix timeline
329d123 perf(kv): batch getQueries hgetall calls via Upstash pipeline
cbb1909 ui: update intel checkbox label to mention model upgrade
7bf5532 perf(history): lazy-load heavy intel blob; list uses lean hmget
89631d4 perf(history): drop result markdown from list payload too
6e49b9c feat(history): show 4 dimension scores on history cards
3e2456e feat(history): surface customer (发件方) identity on history cards
7a50842 ui: rename score chip labels to 询盘质量/客户实力/双方匹配/战略综合
1155811 docs: update notebook with perf optimizations and history card redesign
07daf06 feat(query): add required inquiry channel dropdown, inject into LLM context
dd891cb feat(history): show inquiry channel on history cards
f3ad7d7 ui: rename 战略综合 score to 老板雷达 to match updated prompt
c92ffda ui(query): replace native <select> with Stripe-styled custom dropdown
b491038 feat(intel): add Google Maps search for sender's physical-presence verification
7bd3a35 ui(channel): drop redundant 搜索 from Google ads channel label   ← 最新
```

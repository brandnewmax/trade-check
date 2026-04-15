# trade-check · 开发进度笔记

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

**测试状态**: 55/55 单元测试通过 · `npm run build` 干净

---

## 系统架构

### 后端管线(`/api/analyze` → `lib/intel/gatherIntel`)

```
用户提交 { url(我方), inquiry, images, enableIntel }
         ↓
阶段 1 · 我方背景并行抓取
  ├─ fetchWebsite(我方url) → userSite
  └─ serpSearch("我方品牌名") → userContext(Google 前 5 条)
         ↓
阶段 2 · 发件方实体抽取(LLM)
  输入: 询盘文本 + 图片(多模态) + userSite 摘录(排除用)
  模型选择: images 非空 → mainModel(强,多模态);否则 → extractionModel(cheap/flash)
  输出 JSON: { companyName, companyUrl, personName, personTitle, email, phone, country, products }
  fallback 链(当 LLM 漏网时):
    a. 我方域名排除(防 LLM 混淆)
    b. 正则扫描询盘 http/https/www
    c. 正则扫描询盘裸域名(lookbehind 防误匹配邮箱)
    d. 邮箱域名反推(免费邮箱黑名单过滤)
         ↓
阶段 3 · 基于发件方实体并行搜索(8 路)
  ├─ fetchWebsite(发件方URL)   → "发件方公司网站"卡
  ├─ waybackFirstSnapshot(URL)  → "建站时间"卡(放在最后)
  ├─ searchLinkedIn             → LinkedIn 卡
  ├─ searchFacebook             → Facebook 卡
  ├─ searchPanjiva              → 海关足迹卡
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
      § 1. 发件方实体识别
      § 2. 发件方公司网站
      § 3. LinkedIn 核验
      § 4. Facebook 核验
      § 5. Panjiva 海关足迹
      § 6. 负面/诈骗搜索
      § 7. 发件方电话核验
      § 8. 通用搜索
      § 9. 发件方建站时间(常空,放最后)
    ---
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
- `query:{ts}:{rand}` · 单次分析记录,包含完整 `intel` JSON 和 `intelEnabled` 标记
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
- `QueryPage` · 两栏分裂(左 420px sticky 输入+情报面板,右 flex AI 报告)
- `HistoryPage` · 左 380px 列表 + 右详情
- `SettingsPage` · 三张分组卡 + 底部 sticky 保存条
- `IntelPanel` · 7 卡 2 列网格(高价值优先,Wayback 在最后)
- `IntelCard` · 状态点 + 查询行 + 结果列表(带 snippet)
- `MarkdownRenderer` · 原生 Markdown 解析 + Stripe token className
- `AiDisclaimer` · 报告尾部的免责提醒
- `ImageDropzone` · 拖拽/粘贴/点击上传 + 缩略图网格

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
| **Serper.dev** | Google 搜索(LinkedIn/FB/Panjiva/负面/电话/通用/我方) | POST + `X-API-KEY` header | 按查询,最便宜 |
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

### ⑫ 抽取请求去掉 `response_format: { type: 'json_object' }`(最新)
**问题**: 即便切换主模型做抽取,名片 URL 仍未进入 Serper。怀疑某些 Vertex 代理拒绝 `response_format` 字段返回 HTTP 400,导致抽取调用静默失败。
**修**: 从 `extract.js` 移除 `response_format` 字段,改用纯 prompt 约束("只输出 JSON, 不要代码块") + `parseExtractionJson` 容错解析(已经能处理 fenced block 和 greedy JSON match)。同时把图片场景超时从 30s 提到 45s。

---

## 核心文件地图

```
src/app/
├── layout.js              (~15 行)  Geist 字体接入 + html/body wrapper
├── globals.css            (~10 行)  Tailwind 三指令
├── page.js                (~1700 行,单文件 MVC)
│   ├── 原子组件:Icon/Logo/Spinner/FormItem/PasswordInput/EmptyState/NavItem
│   ├── 情报面板:IntelCard/IntelQueryLine/IntelResultItem/IntelPanel
│   ├── 其他:ScoreBadge/AiDisclaimer/MarkdownRenderer(+renderInline)
│   ├── 页面:LoginPage/QueryPage/HistoryPage/SettingsPage/HistoryCard/SettingsCard
│   ├── 容器:Layout/ImageDropzone
│   └── App(根组件,负责 user/page/serpUsage state 和路由切换)
└── api/
    ├── auth/route.js        登录
    ├── me/route.js          当前用户
    ├── analyze/route.js     ★ 4 阶段 SSE 管线
    ├── settings/route.js    全局 + 用户设置 CRUD
    └── queries/route.js     历史记录查询

lib/
├── auth.js                  JWT session
├── kv.js                    Upstash Redis 封装 + 默认 prompts + 用量计数器
└── intel/
    ├── index.js             ★ gatherIntel 编排器
    ├── fetchWebsite.js      抓取 + HTML 剥离 + 8s 超时
    ├── wayback.js           archive.org 快照查询
    ├── extract.js           ★ 抽取 + parseExtractionJson + 4 层 fallback 链
    ├── serpapi.js           Serper.dev 客户端(名字是历史遗留)
    ├── format.js            → markdown 简报
    └── searches/
        ├── linkedin.js      人名+公司名降级查询
        ├── facebook.js      公司名优先
        ├── panjiva.js       需公司名
        ├── negative.js      公司/邮箱/人名 + fraud 关键词
        ├── phone.js         电话号码查询(新增)
        └── general.js       公司名通用搜索

test/intel/
├── extract.test.js          32 tests · parseExtractionJson + derive* fallbacks
├── format.test.js           4 tests · 节顺序 + 状态渲染
└── searches.test.js         19 tests · 所有 buildQuery 纯函数

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
2. **抽取模型默认 `gemini-2.5-flash`** —— 对英文名片 OCR 不可靠,目前靠"有图片时切换主模型"绕过。不是通用方案,但主模型确定可用。
3. **无前端单元测试** —— Tailwind + JSX 不好覆盖,靠构建验证 + 手动 smoke test。24+ 单元测试全在 `lib/intel/` 的纯函数上。
4. **E2E 测试没做** —— PR #1 的 Task 5.2 标记 pending,实际靠生产环境的每次迭代验证。
5. **`.env.local` 本地开发缺失** —— 没有本地开发环境,所有测试直接在 Railway preview 上进行。
6. **历史记录里的老 intel** —— 结构变了以后,老记录的 intel JSON 字段可能对不齐。IntelPanel 的可选链(`intel.xxx?.status`)大部分防得住,但新字段(如 phone)在老记录里是 undefined,卡片直接显示加载态。
7. **Settings 页的 prompt 是否更新需要手动操作** —— 改默认 prompt 后要去管理员设置清空对应 textarea 再保存,才能让 kv 里的值走新默认。

---

## 下一步待办(按优先级)

- [ ] 验证 ⑫ 修复(去掉 response_format)后名片 URL 能否正确进入 Serper
- [ ] 考虑把"发件方电话"也作为负面搜索的 fallback 目标之一(现在 negative 只用 company/email/person)
- [ ] 考虑公共邮箱(gmail 等)作为"中性偏负面"信号在 prompt 里显式点名
- [ ] IntelPanel 里当抽取失败时,给个明确的错误提示(现在只是默默变空)
- [ ] .env.local 模板 + 本地 dev 说明文档

---

## Git 主分支状态

最新 commit: `6d63d02 fix(intel): drop response_format to unblock extraction on Vertex proxies`
远程: `origin/main` 同步
PR: 无开启中
总计本轮:PR #1(29 commit)+ PR #2(22 commit)+ PR #3(9 commit)+ 12 次 hotfix 直推

import { Redis } from '@upstash/redis'

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// ─── USERS ────────────────────────────────────────────────────────────────────
export async function getUser(email) {
  return await kv.hgetall(`user:${email}`)
}

export async function initUsers() {
  const adminExists = await kv.exists(`user:${process.env.ADMIN_EMAIL}`)
  if (!adminExists) {
    await kv.hset(`user:${process.env.ADMIN_EMAIL}`, {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'admin',
      name: 'Admin',
    })
    await kv.hset(`user:${process.env.TEST_EMAIL}`, {
      email: process.env.TEST_EMAIL,
      password: process.env.TEST_PASSWORD,
      role: 'user',
      name: '测试用户',
    })
  }
}

// ─── DEFAULT PROMPTS ─────────────────────────────────────────────────────────
const DEFAULT_SYSTEM_PROMPT = `你是一位专业的中国外贸背景调查分析师。用户收到了一封来自潜在客户的询盘,需要判断**发件方**(对方)是否可信。

用户消息会包含以下几部分:
1. 【我方公司背景】——收件方(即用户自己)的公司简介,仅供你理解业务语境。**不是**调查对象。
2. 【实时情报简报】——系统自动从公开来源检索到的关于**发件方**(对方)的客观数据,你必须以此为判断核心依据。
3. 原始询盘文本 + (可能的)图片附件——名片、邮件截图、聊天记录等。

请严格按以下框架输出分析报告:

## 一、情报交叉核验
逐项引用简报中关于**发件方**的发现,判断每项是"正面信号 / 负面信号 / 中性"并说明理由:
- 发件方公司网站专业度(依据:简报第 2 节)
- 发件方建站时间是否与自称规模匹配(依据:简报第 3 节,<2 年需警惕)
- LinkedIn 人员身份是否匹配自称职位(依据:简报第 4 节)
- Facebook 官方存在性(依据:简报第 5 节)
- Panjiva 海关足迹是否与自称产品/国家吻合(依据:简报第 6 节,无记录的"老牌贸易商"是强负面信号)
- 网络负面舆情(依据:简报第 7 节)

## 二、信号矛盾检查
列出简报中发件方自身信息相互矛盾的地方(例:自称 10 年老厂但建站仅 1 年 / LinkedIn 职位与邮件签名不符 / 声称专营欧盟但 Panjiva 仅有非洲记录 / 声称想采购的产品与我方业务根本不匹配)。

## 三、询盘本身的分析
回到原始询盘文本与图片,分析措辞、报价合理性、付款方式要求等常见诈骗特征。结合【我方公司背景】判断对方是否真的了解我方产品,还是在群发模板邮件。

## 四、综合风险等级
给出【低风险 / 中风险 / 高风险】三选一,必须在一行内用这几个固定词之一(系统靠关键词提取,不要改措辞)。

## 五、具体建议
针对该发件方,下一步应做什么(例:要求视频验厂、索要 Bill of Lading、要求对方从公司域名邮箱回复等)。

硬性规则:
- 所有情报都指**发件方**,严禁把"我方公司背景"当作调查目标
- 如果某项简报标注 status: failed 或 skipped,必须明确说"该维度数据缺失,无法作为依据",不得编造
- 禁止引入简报之外的"事实"(不要说"根据我的了解该公司……")
- 所有结论必须能追溯到简报某一节、询盘原文或图片内容`

const DEFAULT_FALLBACK_SYSTEM_PROMPT = `你是一位专业的中国外贸背景调查分析师。请根据用户提供的公司网址和询盘信息,从以下维度进行深度分析:

1. **公司可信度评估**:分析公司网站的专业程度、内容质量、联系方式完整性
2. **询盘真实性分析**:判断询盘内容是否符合正常外贸询价规律,是否存在欺诈风险
3. **风险等级判定**:综合评估,给出低/中/高风险评级
4. **具体风险点**:列出发现的具体问题或可疑信号
5. **建议处理方式**:根据分析结果给出专业建议

请用中文输出结构化的分析报告,语言专业简洁。`

const DEFAULT_EXTRACTION_PROMPT = `你是一个结构化信息抽取助手。
场景:中国外贸企业收到一封来自潜在客户的询盘,需要从中识别**发件方**(可能是真客户,也可能是可疑人员)的身份信息,用于后续背景调查。

你会收到:
1. 【我方公司背景】(可选)——收件方自己的公司简介,仅供参考,**不要**把它当作抽取对象
2. 【询盘文本】——邮件正文、WhatsApp 记录、微信聊天截图等
3. 【图片附件】(可选)——可能是对方的名片、邮件截图、签名图、聊天记录等,请 OCR 识别其中的印刷/手写文字

请从上述内容中提取【发件方】(不是我方)的以下字段,严格返回一个 JSON 对象,不要任何额外文字:

{
  "companyName": 发件方公司名或 null,
  "companyUrl": 发件方公司网址或 null,
  "personName": 发件方姓名或 null,
  "personTitle": 发件方职位或 null,
  "email": 发件方邮箱或 null,
  "phone": 发件方电话或 null,
  "country": 发件方所在国家(中文或 ISO 代码)或 null,
  "products": 对方想采购/咨询的产品字符串数组(可为空)
}

规则:
- **严禁**把我方(收件方)信息当成发件方写进来
- 拿不准的字段填 null,绝不猜测
- **companyUrl 提取规则**:
  - 询盘正文 / 邮件签名 / 名片 / 图片中任何出现的 http://、https:// 或 www. 开头的网址,几乎总是发件方的网址,请优先抽取
  - "我的网站是 X"、"Please visit X"、"website: X"、"check our site X" 这类句式后面的网址必抽
  - 排除明显的社交媒体/搜索引擎/市场平台域名(facebook.com、linkedin.com、alibaba.com、amazon.com 等),这些不是发件方官网
  - 不要根据公司名凭空编造网址
- 电话统一去掉空格和横杠
- 如果图片是名片,按印刷顺序逐字读取
- 只输出 JSON,不要 markdown 代码块,不要解释`

// ─── GLOBAL SETTINGS (admin: baseUrl, systemPrompt) ──────────────────────────
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

// ─── USER SETTINGS (per-user: apiKey, modelName) ─────────────────────────────
export async function getUserSettings(email) {
  const s = await kv.hgetall(`user_settings:${email}`)
  return s || { apiKey: '', modelName: 'gemini-3.1-pro-preview-vertex' }
}

export async function saveUserSettings(email, data) {
  const allowed = ['apiKey', 'modelName']
  const filtered = Object.fromEntries(
    Object.entries(data).filter(([k]) => allowed.includes(k))
  )
  if (Object.keys(filtered).length > 0) {
    await kv.hset(`user_settings:${email}`, filtered)
  }
}

// ─── QUERIES ──────────────────────────────────────────────────────────────────
export async function saveQuery(query) {
  const id = `query:${Date.now()}:${Math.random().toString(36).slice(2)}`
  const record = { ...query }
  if (record.intel && typeof record.intel !== 'string') {
    record.intel = JSON.stringify(record.intel)
  }
  if (record.intelEnabled !== undefined) {
    record.intelEnabled = record.intelEnabled ? 'true' : 'false'
  }
  // Upstash hset rejects null/undefined values; drop them.
  for (const k of Object.keys(record)) {
    if (record[k] === null || record[k] === undefined) delete record[k]
  }
  await kv.hset(id, record)
  await kv.lpush('queries:all', id)
  await kv.lpush(`queries:user:${query.userEmail}`, id)
  return id
}

// Fields returned in list view. Excludes the two largest blobs:
//   - `intel`  (tens of KB — search results + snippets)
//   - `result` (~3-8 KB — full LLM markdown report)
// Together these were ~95% of a 50-row history payload. Both are
// fetched on-demand via getQueryById when a card is clicked.
const LIST_FIELDS = [
  'userEmail',
  'url',
  'inquiry',
  'createdAt',
  'intelEnabled',
  'riskLevel',
  'scoreInquiry',
  'scoreCustomer',
  'scoreMatch',
  'scoreStrategy',
  'customerName',
  'customerUrl',
  'customerEmail',
  'customerCountry',
  'hasImages',
  'imageCount',
]

export async function getQueries(role, email, page = 0, limit = 50) {
  const listKey = role === 'admin' ? 'queries:all' : `queries:user:${email}`
  const start = page * limit
  const ids = await kv.lrange(listKey, start, start + limit - 1)
  if (!ids || ids.length === 0) return []
  const pipeline = kv.pipeline()
  ids.forEach(id => pipeline.hmget(id, ...LIST_FIELDS))
  const rows = await pipeline.exec()
  return rows
    .map((row, i) => {
      if (!row) return null
      const obj = { id: ids[i] }
      LIST_FIELDS.forEach((f, idx) => {
        if (row[f] !== undefined && row[f] !== null) obj[f] = row[f]
      })
      return obj
    })
    .filter(Boolean)
}

export async function getQueryById(id, role, email) {
  if (!id || typeof id !== 'string' || !id.startsWith('query:')) return null
  const record = await kv.hgetall(id)
  if (!record) return null
  // Non-admins can only read their own records
  if (role !== 'admin' && record.userEmail !== email) return null
  return { id, ...record }
}

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

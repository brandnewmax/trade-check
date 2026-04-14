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
  await kv.hset(id, record)
  await kv.lpush('queries:all', id)
  await kv.lpush(`queries:user:${query.userEmail}`, id)
  return id
}

export async function getQueries(role, email, page = 0, limit = 50) {
  const listKey = role === 'admin' ? 'queries:all' : `queries:user:${email}`
  const start = page * limit
  const ids = await kv.lrange(listKey, start, start + limit - 1)
  if (!ids || ids.length === 0) return []
  const results = await Promise.all(ids.map(id => kv.hgetall(id)))
  return results.filter(Boolean)
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

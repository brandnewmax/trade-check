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

// ─── GLOBAL SETTINGS (admin: baseUrl, systemPrompt) ──────────────────────────
export async function getGlobalSettings() {
  const s = await kv.hgetall('global_settings')
  return s || {
    baseUrl: '',
    systemPrompt: `你是一位专业的中国外贸背景调查分析师。请根据用户提供的公司网址和询盘信息，从以下维度进行深度分析：

1. **公司可信度评估**：分析公司网站的专业程度、内容质量、联系方式完整性
2. **询盘真实性分析**：判断询盘内容是否符合正常外贸询价规律，是否存在欺诈风险
3. **风险等级判定**：综合评估，给出低/中/高风险评级
4. **具体风险点**：列出发现的具体问题或可疑信号
5. **建议处理方式**：根据分析结果给出专业建议

请用中文输出结构化的分析报告，语言专业简洁。`,
  }
}

export async function saveGlobalSettings(data) {
  const allowed = ['baseUrl', 'systemPrompt']
  const filtered = Object.fromEntries(
    Object.entries(data).filter(([k]) => allowed.includes(k))
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
  await kv.hset(id, query)
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

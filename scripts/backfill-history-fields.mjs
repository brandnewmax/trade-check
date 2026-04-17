// One-off: walk every query:* record in Redis and backfill
//   scoreInquiry / scoreCustomer / scoreMatch / scoreStrategy
//   customerName / customerUrl / customerEmail / customerCountry
// by parsing the stored `result` markdown and `intel` JSON.
// Idempotent: only writes fields that are currently missing.

import { Redis } from '@upstash/redis'

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN
if (!url || !token) {
  console.error('Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN')
  process.exit(1)
}
const kv = new Redis({ url, token })

const SCORE_LABELS = {
  scoreInquiry: '询盘质量分',
  scoreCustomer: '客户实力分',
  scoreMatch: '匹配度得分',
  scoreStrategy: '老板雷达分',
}

function pickScore(text, label) {
  if (!text) return null
  const re = new RegExp(label + '[^0-9]{0,30}(\\d{1,3})\\s*\\/\\s*100')
  const m = text.match(re)
  if (!m) return null
  const n = parseInt(m[1])
  return n >= 0 && n <= 100 ? n : null
}

function parseIntel(v) {
  if (!v) return null
  if (typeof v === 'object') return v
  try { return JSON.parse(v) } catch { return null }
}

async function main() {
  const ids = await kv.lrange('queries:all', 0, -1)
  console.log(`total records: ${ids.length}`)

  let touched = 0
  let scoresAdded = 0
  let customerAdded = 0

  for (const id of ids) {
    const rec = await kv.hgetall(id)
    if (!rec) continue

    const patch = {}

    // scores from result markdown
    for (const [field, label] of Object.entries(SCORE_LABELS)) {
      if (rec[field] == null) {
        const v = pickScore(rec.result, label)
        if (v != null) patch[field] = v
      }
    }

    // customer info from intel.extracted
    if (rec.customerName == null || rec.customerUrl == null || rec.customerEmail == null || rec.customerCountry == null) {
      const intel = parseIntel(rec.intel)
      const x = intel?.extracted
      if (x) {
        if (rec.customerName == null && x.companyName) patch.customerName = x.companyName
        if (rec.customerUrl == null && x.companyUrl) patch.customerUrl = x.companyUrl
        if (rec.customerEmail == null && x.email) patch.customerEmail = x.email
        if (rec.customerCountry == null && x.country) patch.customerCountry = x.country
      }
    }

    if (Object.keys(patch).length > 0) {
      await kv.hset(id, patch)
      touched++
      if (Object.keys(patch).some(k => k.startsWith('score'))) scoresAdded++
      if (Object.keys(patch).some(k => k.startsWith('customer'))) customerAdded++
      console.log(`  ${id}  +${Object.keys(patch).join(',')}`)
    }
  }

  console.log(`\ndone. touched=${touched}  scoresAdded=${scoresAdded}  customerAdded=${customerAdded}`)
}

main().catch(e => { console.error(e); process.exit(1) })

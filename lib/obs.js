// Observation log: minimal telemetry for /api/analyze and /api/v1/analyze.
// Captures per-request metadata + output summary so Beta-era analytics have
// a retrievable trail before the formal data storage architecture lands.
//
// Design rules (enforced here):
//   - Never store inquiry raw text (only SHA-256 hash)
//   - Never store buyer PII or intel raw data (size + privacy)
//   - Writes MUST NOT fail the request — try/catch swallows errors
//   - Keys auto-expire after 90 days (TTL), no cleanup job needed
//
// See notebook.md "Observation Log" section for the full schema.

import { Redis } from '@upstash/redis'
import crypto from 'crypto'

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const TTL_SECONDS = 90 * 24 * 60 * 60 // 90 days

export function newRequestId() {
  return crypto.randomUUID()
}

export function hashInquiry(text) {
  return crypto.createHash('sha256').update(String(text ?? '')).digest('hex')
}

function utcDateKey(d = new Date()) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/**
 * Fire-and-forget write of a single observation log entry. Failures only
 * emit a console.warn so the caller's response path stays unaffected.
 *
 * @param {string} requestId - uuid v4 generated at route entry
 * @param {Object} payload   - full log body matching notebook.md Observation Log schema
 */
export async function writeObservationLog(requestId, payload) {
  try {
    const key = `obs:analyze:${utcDateKey()}:${requestId}`
    await kv.set(key, payload, { ex: TTL_SECONDS })
  } catch (e) {
    console.warn('[obs] write failed', e?.message || String(e))
  }
}

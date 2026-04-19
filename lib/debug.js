// Debug trace sink — admin-only, fire-and-forget per-request node tracing.
// Separate channel from obs.js: allowed to store raw inquiry text, images,
// and full LLM I/O for operational debugging. Gated behind DEBUG_TRACE_ENABLED.
//
// Storage layout (Upstash Redis, debug: prefix, TTL per config):
//   debug:meta:<YYYYMMDD>:<requestId>   hash, per-request summary
//   debug:trace:<YYYYMMDD>:<requestId>  list, append-only node events
//   debug:index:<YYYYMMDD>              zset score=startMs member=requestId

import crypto from 'crypto'
import { Redis } from '@upstash/redis'

export function isTraceEnabled() {
  const v = (process.env.DEBUG_TRACE_ENABLED ?? 'true').toLowerCase()
  return v !== 'false' && v !== '0' && v !== 'off'
}

export function getConfig() {
  return {
    ttlDays: parseInt(process.env.DEBUG_TRACE_TTL_DAYS ?? '14', 10),
    maxPayloadKB: parseInt(process.env.DEBUG_TRACE_MAX_PAYLOAD_KB ?? '8', 10),
    maxImageKB: parseInt(process.env.DEBUG_TRACE_MAX_IMAGE_KB ?? '256', 10),
  }
}

// Truncate a JSON-serializable payload to stay under maxKB. If over, replace
// the payload with a short marker object holding the original size and a
// head/tail sample — enough context to eyeball without blowing Redis.
export function truncatePayload(payload, maxKB) {
  let json
  try { json = JSON.stringify(payload) }
  catch { json = '[unserializable]' }
  const size = Buffer.byteLength(json, 'utf8')
  const limit = maxKB * 1024
  if (size <= limit) {
    return { payload, truncated: false, size }
  }
  const headLen = Math.min(4096, Math.floor(limit * 0.6))
  const head = json.slice(0, headLen)
  return {
    payload: {
      __truncated: true,
      __originalSize: size,
      __preview: head + `…[+${size - headLen} bytes]`,
    },
    truncated: true,
    size,
  }
}

// Serialize user-supplied inquiry_images into a trace-safe shape:
//   - Always compute SHA-256 + size + type
//   - If `url` present, keep it (so we can re-fetch or link)
//   - If `base64` present, keep it inline up to maxImageKB; above that,
//     keep the first 128 KB as a preview and mark truncated
export function serializeImages(images, maxImageKB) {
  if (!Array.isArray(images) || images.length === 0) return []
  const maxBytes = maxImageKB * 1024
  const previewBytes = 128 * 1024

  return images.map(img => {
    const out = { type: img.type || 'image/jpeg' }
    if (img.url) out.url = img.url
    if (img.base64) {
      let buf
      try { buf = Buffer.from(img.base64, 'base64') }
      catch { buf = Buffer.alloc(0) }
      out.size = buf.length
      out.sha256 = crypto.createHash('sha256').update(buf).digest('hex')
      if (img.base64.length <= maxBytes) {
        out.base64 = img.base64
        out.truncated = false
      } else {
        out.base64 = img.base64.slice(0, previewBytes)
        out.truncated = true
      }
    } else {
      out.size = 0
      out.sha256 = crypto.createHash('sha256').update('').digest('hex')
    }
    return out
  })
}

export function utcDateKey(d = new Date()) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export const metaKey  = (date, rid) => `debug:meta:${date}:${rid}`
export const traceKey = (date, rid) => `debug:trace:${date}:${rid}`
export const indexKey = (date)      => `debug:index:${date}`

let _redis = null
function getRedis() {
  if (_redis) return _redis
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
  return _redis
}

function safeAsync(fn) {
  return Promise.resolve()
    .then(fn)
    .catch(e => { try { console.warn('[debug]', e?.message || String(e)) } catch {} })
}

// Start a trace. Writes the meta hash and adds to the daily index.
// Signature: startTrace({ requestId, route, startMs, meta })
//   meta = additional key/value pairs (scanMode, enableIntel, caller, inputHash,
//          inquiryText, companyProfile, inquiryImages stringified, etc.)
export async function startTrace({ requestId, route, startMs, meta = {} }) {
  if (!isTraceEnabled() || !requestId) return
  return safeAsync(async () => {
    const { ttlDays } = getConfig()
    const ttlSec = ttlDays * 24 * 60 * 60
    const date = utcDateKey(new Date(startMs))
    const redis = getRedis()
    const fields = {
      requestId,
      route: String(route || ''),
      startMs,
      endMs: null,
      durationMs: null,
      status: 'running',
      ...Object.fromEntries(
        Object.entries(meta).map(([k, v]) => [k, typeof v === 'object' && v !== null ? JSON.stringify(v) : (v ?? '')])
      ),
    }
    await redis.hset(metaKey(date, requestId), fields)
    await redis.expire(metaKey(date, requestId), ttlSec)
    await redis.zadd(indexKey(date), { score: startMs, member: requestId })
    await redis.expire(indexKey(date), ttlSec)
  })
}

// Close a trace. Updates meta with endMs / durationMs / status / outcome fields.
// Signature: endTrace({ requestId, startMs, endMs, status, errorCode?, outcome? })
export async function endTrace({ requestId, startMs, endMs, status, errorCode = null, outcome = {} }) {
  if (!isTraceEnabled() || !requestId) return
  return safeAsync(async () => {
    const date = utcDateKey(new Date(startMs))
    const redis = getRedis()
    const fields = {
      endMs,
      durationMs: endMs - startMs,
      status,
      errorCode: errorCode ?? '',
      ...Object.fromEntries(
        Object.entries(outcome).map(([k, v]) => [k, typeof v === 'object' && v !== null ? JSON.stringify(v) : (v ?? '')])
      ),
    }
    await redis.hset(metaKey(date, requestId), fields)
    const { ttlDays } = getConfig()
    const ttlSec = ttlDays * 24 * 60 * 60
    await redis.expire(metaKey(date, requestId), ttlSec)
  })
}

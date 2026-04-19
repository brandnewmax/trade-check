// Structured per-node logger for the algo pipeline.
//
// Goal: every node (lib/intel/*, lib/intel/searches/*, route handlers) emits
// a single greppable line per lifecycle event so any one node can be debugged
// independently. All lines share a prefix of the form:
//
//   [SCA req=<short-id> r=<route>] [<node-tag>] <event> {json}
//
// Grep `req=a1b2c3d4` to follow one request across every node it touched.
//
// Request-id propagation uses AsyncLocalStorage so leaf functions don't need
// signature changes. Route handlers wrap their stream body once via
// `runWithRequestContext({ requestId, route }, fn)` and every nested call
// inherits the context.
//
// API keys, bearer tokens and passwords are redacted automatically before
// the payload is serialised.
//
// Design rules:
//   - Never log raw inquiry text or LLM raw content — use previewText().
//   - Every node emits at minimum a terminal event (ok/skip/fail) so an
//     absence of logs for a node means the node was never reached.

import { AsyncLocalStorage } from 'node:async_hooks'

const als = new AsyncLocalStorage()

export function runWithRequestContext(ctx, fn) {
  return als.run({ ...ctx }, fn)
}

export function getRequestContext() {
  return als.getStore() || {}
}

export function shortId(id) {
  if (!id) return '-'
  return String(id).slice(0, 8)
}

const REDACT_KEYS = new Set([
  'apikey', 'apiKey', 'api_key',
  'authorization', 'Authorization',
  'bearer',
  'token', 'access_token',
  'password',
  'x-api-key', 'X-API-KEY',
  'serpApiKey', 'serpapikey',
])

function redact(value, depth = 0) {
  if (depth > 6) return '[deep]'
  if (value == null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1))
  const out = {}
  for (const [k, v] of Object.entries(value)) {
    if (REDACT_KEYS.has(k) || REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = typeof v === 'string' && v.length > 0 ? '***' : v
    } else {
      out[k] = redact(v, depth + 1)
    }
  }
  return out
}

function safeJson(info) {
  try { return JSON.stringify(redact(info)) }
  catch { return '[unserializable]' }
}

export function previewText(text, max = 120) {
  if (text == null) return ''
  const s = String(text)
  return s.length > max ? s.slice(0, max) + `…[+${s.length - max}]` : s
}

export function createLogger(tag) {
  const build = (event, info) => {
    const ctx = getRequestContext()
    const req = `req=${shortId(ctx.requestId)}`
    const route = ctx.route ? ` r=${ctx.route}` : ''
    const prefix = `[SCA ${req}${route}] [${tag}]`
    return info === undefined ? `${prefix} ${event}` : `${prefix} ${event} ${safeJson(info)}`
  }
  return {
    start: (info) => console.log(build('start', info)),
    ok: (info) => console.log(build('ok', info)),
    skip: (info) => console.log(build('skip', info)),
    fallback: (info) => console.log(build('fallback', info)),
    warn: (event, info) => console.warn(build(event, info)),
    fail: (info) => console.error(build('fail', info)),
    info: (event, info) => console.log(build(event, info)),
  }
}

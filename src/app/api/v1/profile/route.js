export const dynamic = 'force-dynamic'

import { getGlobalSettings, getUserSettings } from '@/lib/kv'
import { serpSearch } from '@/lib/intel/serpapi'
import { newRequestId, hashUrl, writeObservationLog } from '@/lib/obs'
import { createLogger, previewText, runWithRequestContext } from '@/lib/logger'

const log = createLogger('route/v1-profile')

// ─── SERVICE_API_KEY auth (same contract as /api/v1/analyze) ────────────────
function authenticateService(req) {
  const key = process.env.SERVICE_API_KEY
  if (!key) return { ok: false, status: 503, error: 'SERVICE_API_KEY not configured' }

  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token || token !== key) {
    return { ok: false, status: 401, error: 'Invalid or missing API key' }
  }
  return { ok: true }
}

function normalizeProfileRequest(body = {}) {
  return {
    request_id: body.request_id || null,
    website_url: (body.website_url || '').toString().trim(),
    supplementary_info: (body.supplementary_info || '').toString(),
  }
}

function isValidHttpUrl(s) {
  if (!s) return false
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch { return false }
}

// ─── Direct website fetch ───────────────────────────────────────────────────
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 15_000
const MAX_BYTES = 2 * 1024 * 1024
const MIN_CONTENT_CHARS = 200
const MAX_EXTRACT_CHARS = 15_000

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

const fetchLog = createLogger('profile/directFetch')

async function directFetchWebsite(url) {
  const t0 = Date.now()
  fetchLog.start({ url })
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    })

    if (res.status === 404) {
      fetchLog.fail({ url, reason: 'fetch_not_found', status: 404, durationMs: Date.now() - t0 })
      return { ok: false, reason: 'fetch_not_found' }
    }
    if ([403, 429, 503].includes(res.status)) {
      fetchLog.fail({ url, reason: 'blocked_status', status: res.status, durationMs: Date.now() - t0 })
      return { ok: false, reason: 'blocked_status' }
    }
    if (!res.ok) {
      fetchLog.fail({ url, reason: 'fetch_not_found', status: res.status, durationMs: Date.now() - t0 })
      return { ok: false, reason: 'fetch_not_found' }
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: false })
    let html = ''
    let received = 0
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      html += decoder.decode(value, { stream: true })
    }
    try { reader.cancel() } catch {}

    // Cloudflare / anti-bot challenge markers
    if (/cf-chl|Just a moment\.{3}|cf-browser-verification/i.test(html)) {
      fetchLog.fail({ url, reason: 'cloudflare_challenge', bytes: received, durationMs: Date.now() - t0 })
      return { ok: false, reason: 'cloudflare_challenge' }
    }

    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() || ''
    const body = stripHtml(html)
    if (body.length < MIN_CONTENT_CHARS) {
      fetchLog.fail({ url, reason: 'too_short', bodyLen: body.length, bytes: received, durationMs: Date.now() - t0 })
      return { ok: false, reason: 'too_short' }
    }
    const head = title ? `${title}\n\n` : ''
    const text = (head + body).slice(0, MAX_EXTRACT_CHARS)
    fetchLog.ok({
      url,
      title: previewText(title, 80),
      bodyLen: body.length,
      textLen: text.length,
      bytes: received,
      durationMs: Date.now() - t0,
    })
    return { ok: true, text }
  } catch (e) {
    const msg = String(e?.message || e)
    let reason
    if (/ENOTFOUND|getaddrinfo|ENETUNREACH/i.test(msg)) reason = 'dns'
    else if (/abort|timeout/i.test(msg)) reason = 'timeout'
    else reason = msg.slice(0, 120)
    fetchLog.fail({ url, reason, error: previewText(msg, 200), durationMs: Date.now() - t0 })
    return { ok: false, reason }
  }
}

// ─── SerpAPI fallback ───────────────────────────────────────────────────────
const serpFallbackLog = createLogger('profile/serpFallback')

async function serpFallback(websiteUrl, apiKey) {
  const t0 = Date.now()
  let host
  try { host = new URL(websiteUrl).hostname.replace(/^www\./, '') }
  catch {
    serpFallbackLog.fail({ reason: 'url_parse', url: websiteUrl })
    return { ok: false }
  }
  serpFallbackLog.start({ host })

  const res = await serpSearch({
    query: `site:${host}`,
    apiKey,
    num: 10,
  })
  if (!res.ok || !res.results?.length) {
    serpFallbackLog.fail({
      host,
      reason: res.ok ? 'empty_results' : 'serp_error',
      error: res.error || null,
      durationMs: Date.now() - t0,
    })
    return { ok: false, error: res.error }
  }

  const aggregated = res.results
    .map((r, i) => {
      const parts = []
      if (r.title) parts.push(r.title)
      if (r.snippet) parts.push(r.snippet)
      return `${i + 1}. ${parts.join(' — ')}`
    })
    .join('\n')

  serpFallbackLog.ok({
    host,
    resultCount: res.results.length,
    aggregatedLen: aggregated.length,
    durationMs: Date.now() - t0,
  })
  return { ok: true, text: aggregated, resultCount: res.results.length }
}

// ─── LLM system prompt ──────────────────────────────────────────────────────
const PROFILE_SYSTEM_PROMPT = `你是一个专业的外贸公司资料分析师。根据提供的公司网站抓取内容和用户补充资料,生成一份 2000-3000 字的公司资料报告,用于后续客户背景调查时的匹配分析。

报告要包含以下维度:
1. 公司概况(名称、所在地、成立时间、规模)
2. 主营产品/服务(品类、特色、技术优势)
3. 目标客户画像(行业、地区、典型客户)
4. 业务模式(B2B/B2C、是否外贸、主要渠道)
5. 竞争优势与差异化
6. 潜在合作方向(什么类型的买家最匹配)

输出格式:markdown 中文。如果某个维度的信息不足,诚实注明"信息不足"而不是编造。`

// ─── Route handler ──────────────────────────────────────────────────────────
export async function POST(req) {
  const auth = authenticateService(req)
  if (!auth.ok) {
    log.warn('auth_fail', { status: auth.status, error: auth.error })
    return Response.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  let body
  try { body = await req.json() }
  catch {
    log.warn('body_parse_fail')
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { request_id, website_url, supplementary_info } = normalizeProfileRequest(body)
  if (!isValidHttpUrl(website_url)) {
    log.warn('invalid_url', { urlPreview: previewText(website_url, 80) })
    return Response.json(
      { ok: false, error: 'invalid_url', message: 'website_url must be a valid http/https URL' },
      { status: 400 },
    )
  }

  const encoder = new TextEncoder()
  const streamStart = Date.now()
  const HEARTBEAT_MS = 8000
  const requestId = request_id || newRequestId()

  const stream = new ReadableStream({
    async start(controller) {
      return runWithRequestContext({ requestId, route: 'v1/profile' }, () => streamBody(controller))
    },
    cancel() { /* client disconnected */ },
  })

  async function streamBody(controller) {
      let heartbeatTimer = null
      let currentStage = 'queued'
      let closed = false

      log.start({
        websiteUrlHash: hashUrl(website_url).slice(0, 12),
        host: (() => { try { return new URL(website_url).host } catch { return null } })(),
        hasSupplementary: !!supplementary_info,
        supplementaryLen: (supplementary_info || '').length,
      })

      const obs = {
        source: null,
        websiteAccessible: null,
        tokens: null,
        fired: false,
      }
      const recordObs = (status, errorCode) => {
        if (obs.fired) return
        obs.fired = true
        writeObservationLog(requestId, {
          request_id: requestId,
          timestamp: new Date().toISOString(),
          website_url_hash: hashUrl(website_url),
          source: obs.source,
          website_accessible: obs.websiteAccessible,
          tokens: obs.tokens,
          elapsed_ms: Date.now() - streamStart,
          status,
          error_code: errorCode,
        }, 'profile')
      }

      const emit = (event, data) => {
        if (closed) return
        const payload = typeof data === 'string' ? data : JSON.stringify(data)
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`))
        } catch { /* stream already closed */ }
      }

      const progress = (stage) => {
        currentStage = stage
        log.info('stage', { stage, elapsedMs: Date.now() - streamStart })
        emit('progress', { stage, elapsed_ms: Date.now() - streamStart })
      }

      const close = () => {
        if (closed) return
        closed = true
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
        try { controller.close() } catch {}
      }

      const fail = (code, message) => {
        log.fail({ stage: currentStage, code, message: previewText(message, 300) })
        emit('error', { code, message })
        close()
        recordObs('error', code)
      }

      progress('queued')
      heartbeatTimer = setInterval(() => {
        emit('progress', { stage: currentStage, elapsed_ms: Date.now() - streamStart })
      }, HEARTBEAT_MS)

      try {
        // ── Step 1: direct fetch ─────────────────────────────────────────
        progress('fetch_website')
        const direct = await directFetchWebsite(website_url)

        let sourceTag = 'direct_fetch'
        let websiteAccessible = true
        let extracted = null

        if (direct.ok) {
          extracted = direct.text
          log.info('source_decided', { source: 'direct_fetch', textLen: extracted.length })
        } else {
          log.fallback({ from: 'direct_fetch', reason: direct.reason })

          // ── Step 2: failure detected ──────────────────────────────────
          if (direct.reason === 'fetch_not_found') {
            return fail(
              'fetch_not_found',
              `Website not found or DNS failure (${direct.reason})`,
            )
          }

          // ── Step 3: SerpAPI fallback ──────────────────────────────────
          progress('fetch_fallback_serp')
          sourceTag = 'serp_fallback'
          websiteAccessible = false

          const globalSettings = await getGlobalSettings()
          const serpKey = globalSettings.serpApiKey?.trim()
          if (!serpKey) {
            return fail('config', 'SerpAPI key not configured on server')
          }

          const serp = await serpFallback(website_url, serpKey)
          if (!serp.ok) {
            return fail(
              'fetch_blocked',
              'Website blocked direct access and SerpAPI returned insufficient content',
            )
          }
          extracted = serp.text
          if ((extracted?.length || 0) < MIN_CONTENT_CHARS) {
            return fail(
              'content_too_short',
              'Aggregated content still under 200 chars after SerpAPI fallback',
            )
          }
          log.info('source_decided', { source: 'serp_fallback', textLen: extracted.length })
        }

        obs.source = sourceTag
        obs.websiteAccessible = websiteAccessible

        // ── Step 4: LLM generate company report ──────────────────────────
        progress('llm_generate')

        const globalSettings = await getGlobalSettings()
        const baseUrl = globalSettings.baseUrl?.trim()
        if (!baseUrl) return fail('config', 'Base URL not configured on server')

        const adminEmail = process.env.ADMIN_EMAIL
        const adminSettings = await getUserSettings(adminEmail)
        const apiKey = adminSettings.apiKey?.trim()
        if (!apiKey) return fail('config', 'Admin API Key not configured')
        const modelName = adminSettings.modelName?.trim() || 'gemini-3.1-pro-preview-vertex'

        const userPayload =
          `【网站原始抓取内容(来源:${sourceTag})】\n` +
          `网址:${website_url}\n\n` +
          `${extracted}\n\n` +
          (supplementary_info
            ? `---\n\n【用户补充资料】\n${supplementary_info}\n`
            : '')

        const endpoint = baseUrl.replace(/\/$/, '') + '/chat/completions'
        const tLlm = Date.now()
        log.info('llm_call', {
          model: modelName,
          source: sourceTag,
          payloadLen: userPayload.length,
        })

        let llmRes
        try {
          llmRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: modelName,
              stream: false,
              messages: [
                { role: 'system', content: PROFILE_SYSTEM_PROMPT },
                { role: 'user', content: userPayload },
              ],
            }),
          })
        } catch (e) {
          return fail('llm_error', `LLM connection failed: ${e.message}`)
        }

        if (!llmRes.ok) {
          let detail = ''
          try { detail = await llmRes.text() } catch {}
          try { detail = JSON.parse(detail)?.error?.message || detail } catch {}
          return fail('llm_error', `LLM API error ${llmRes.status}: ${String(detail).slice(0, 300)}`)
        }

        const llmJson = await llmRes.json()
        const report = llmJson.choices?.[0]?.message?.content || ''
        if (!report) return fail('llm_error', 'LLM returned empty content')
        log.info('llm_ok', {
          model: modelName,
          reportLen: report.length,
          tokens: {
            prompt: llmJson.usage?.prompt_tokens || null,
            completion: llmJson.usage?.completion_tokens || null,
          },
          llmMs: Date.now() - tLlm,
        })

        const tokens = {
          prompt: llmJson.usage?.prompt_tokens || null,
          completion: llmJson.usage?.completion_tokens || null,
        }
        obs.tokens = tokens

        emit('done', {
          ok: true,
          data: {
            profile_report: report,
            source: sourceTag,
            website_accessible: websiteAccessible,
            model: modelName,
            tokens,
            elapsed_ms: Date.now() - streamStart,
          },
        })
        log.ok({
          source: sourceTag,
          websiteAccessible,
          reportLen: report.length,
          tokens,
          totalMs: Date.now() - streamStart,
        })
        close()
        recordObs('success', null)
      } catch (e) {
        log.fail({ phase: 'internal', error: String(e?.message || e).slice(0, 300) })
        fail('internal', String(e?.message || e).slice(0, 300))
      }
  }

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  })
}

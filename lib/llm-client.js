// Unified LLM client that abstracts OpenAI and Anthropic protocol differences.
//
// Exports:
//   llmCall(config)   → string          (non-streaming, returns full text)
//   llmStream(config) → AsyncGenerator  (streaming, yields delta strings)
//
// Config shape:
// {
//   protocol:  'openai' | 'anthropic',
//   baseUrl:   string,
//   apiKey:    string,
//   model:     string,
//   system?:   string | null,
//   messages:  [{ role: string, content: string | array }],
//   images?:   [{ type: string, base64: string }] | null,
//   stream?:   boolean,
//   timeout?:  number | null,          // ms
//   maxTokens?: number | null,         // anthropic defaults to 4096
// }

// ─── Endpoint & URL helpers ──────────────────────────────────────────────────

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, '')
}

function buildEndpoint(protocol, baseUrl) {
  const base = normalizeBaseUrl(baseUrl)
  if (protocol === 'anthropic') {
    // Avoid double /v1 if user already included it
    if (base.endsWith('/v1')) return base + '/messages'
    return base + '/v1/messages'
  }
  // openai
  return base + '/chat/completions'
}

// ─── Image format translation ────────────────────────────────────────────────

function toOpenAIImages(images) {
  return images.map(img => ({
    type: 'image_url',
    image_url: {
      url: `data:${img.type || 'image/jpeg'};base64,${img.base64}`,
      detail: 'high',
    },
  }))
}

function toAnthropicImages(images) {
  return images.map(img => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: img.type || 'image/jpeg',
      data: img.base64,
    },
  }))
}

// Merge images into the last user message's content array.
// Returns a new messages array (does not mutate the input).
function attachImages(messages, images, imageFormatter) {
  if (!images || images.length === 0) return messages

  const msgs = messages.map(m => ({ ...m }))
  // Find the last user message
  let lastUserIdx = -1
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'user') { lastUserIdx = i; break }
  }
  if (lastUserIdx === -1) return msgs

  const msg = msgs[lastUserIdx]
  // Convert content to array format
  let parts = []
  if (typeof msg.content === 'string') {
    parts = [{ type: 'text', text: msg.content }]
  } else if (Array.isArray(msg.content)) {
    parts = [...msg.content]
  } else {
    parts = [{ type: 'text', text: String(msg.content ?? '') }]
  }
  parts.push(...imageFormatter(images))
  msgs[lastUserIdx] = { ...msg, content: parts }
  return msgs
}

// ─── Request builders ────────────────────────────────────────────────────────

function buildOpenAIRequest(config) {
  const { protocol, baseUrl, apiKey, model, system, messages, images, stream, timeout, maxTokens, temperature } = config
  const endpoint = buildEndpoint(protocol, baseUrl)

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }

  let msgs = attachImages(messages, images, toOpenAIImages)

  // Prepend system as a message role
  if (system) {
    msgs = [{ role: 'system', content: system }, ...msgs]
  }

  const body = { model, stream: !!stream, messages: msgs }
  if (temperature != null) body.temperature = temperature
  if (maxTokens != null) body.max_tokens = maxTokens

  return { endpoint, headers, body, timeout }
}

function buildAnthropicRequest(config) {
  const { protocol, baseUrl, apiKey, model, system, messages, images, stream, timeout, maxTokens, temperature } = config
  const endpoint = buildEndpoint(protocol, baseUrl)

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }

  let msgs = attachImages(messages, images, toAnthropicImages)

  const body = { model, stream: !!stream, messages: msgs }
  body.max_tokens = maxTokens || 4096
  if (system) body.system = system
  if (temperature != null) body.temperature = temperature

  return { endpoint, headers, body, timeout }
}

function buildRequest(config) {
  return config.protocol === 'anthropic'
    ? buildAnthropicRequest(config)
    : buildOpenAIRequest(config)
}

// ─── Stream parsers ──────────────────────────────────────────────────────────

// OpenAI SSE:  data: {"choices":[{"delta":{"content":"..."}}]}  →  yield "..."
//              data: [DONE]  →  stop
async function* parseOpenAIStream(reader, decoder) {
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch {}
    }
  }
}

// Anthropic SSE:
//   event: content_block_delta
//   data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
//   → yield "..."
//
//   event: message_stop  →  stop
async function* parseAnthropicStream(reader, decoder) {
  let buffer = ''
  let currentEvent = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim()
        continue
      }
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (currentEvent === 'message_stop') return
      if (currentEvent === 'content_block_delta') {
        try {
          const parsed = JSON.parse(data)
          const text = parsed.delta?.text
          if (text) yield text
        } catch {}
      }
    }
  }
}

function parseStream(protocol, reader, decoder) {
  return protocol === 'anthropic'
    ? parseAnthropicStream(reader, decoder)
    : parseOpenAIStream(reader, decoder)
}

// ─── Response parsers ────────────────────────────────────────────────────────

function parseOpenAIResponse(json) {
  return json.choices?.[0]?.message?.content ?? ''
}

function parseAnthropicResponse(json) {
  return json.content?.[0]?.text ?? ''
}

// ─── Error handling ──────────────────────────────────────────────────────────

export class LlmError extends Error {
  constructor(status, detail) {
    super(`API 错误 ${status}：${detail}`)
    this.name = 'LlmError'
    this.status = status
    this.detail = detail
  }
}

async function throwIfNotOk(res) {
  if (res.ok) return
  let detail = ''
  try { detail = await res.text() } catch {}
  try { detail = JSON.parse(detail)?.error?.message || detail } catch {}
  throw new LlmError(res.status, String(detail).slice(0, 500))
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Non-streaming LLM call. Returns the full text response as a string.
 */
export async function llmCall(config) {
  const { endpoint, headers, body, timeout } = buildRequest(config)

  const fetchOpts = { method: 'POST', headers, body: JSON.stringify(body) }
  if (timeout) fetchOpts.signal = AbortSignal.timeout(timeout)

  const res = await fetch(endpoint, fetchOpts)
  await throwIfNotOk(res)

  const json = await res.json()
  return config.protocol === 'anthropic'
    ? parseAnthropicResponse(json)
    : parseOpenAIResponse(json)
}

/**
 * Streaming LLM call. Returns an async generator that yields delta strings.
 * The caller owns the response lifecycle — the generator reads until the
 * stream ends or the protocol signals completion.
 */
export async function* llmStream(config) {
  const { endpoint, headers, body } = buildRequest({ ...config, stream: true })

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  await throwIfNotOk(res)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  try {
    yield* parseStream(config.protocol, reader, decoder)
  } finally {
    try { reader.releaseLock() } catch {}
  }
}

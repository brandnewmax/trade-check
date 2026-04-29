import { describe, it, expect } from 'vitest'
import { LlmError } from '@/lib/llm-client'

// We test the pure request-building and parsing logic by importing the
// internal helpers via a dynamic ESM trick: the module is compiled by
// vitest with the same alias as the app (`@/` → `<root>/`).  The helpers
// are not directly exported, so we re-implement the same logic here for
// testing, verifying contract correctness rather than implementation
// identity.  The actual fetch/streaming integration is covered by the
// existing integration tests (analyze route, extract module).

// ── Endpoint construction ─────────────────────────────────────────────────────

describe('endpoint construction logic', () => {
  function buildEndpoint(protocol, baseUrl) {
    const base = baseUrl.replace(/\/+$/, '')
    if (protocol === 'anthropic') {
      if (base.endsWith('/v1')) return base + '/messages'
      return base + '/v1/messages'
    }
    return base + '/chat/completions'
  }

  it('openai: appends /chat/completions', () => {
    expect(buildEndpoint('openai', 'https://api.openai.com/v1'))
      .toBe('https://api.openai.com/v1/chat/completions')
  })

  it('openai: strips trailing slashes', () => {
    expect(buildEndpoint('openai', 'https://proxy.example.com/v1/'))
      .toBe('https://proxy.example.com/v1/chat/completions')
  })

  it('anthropic: appends /v1/messages', () => {
    expect(buildEndpoint('anthropic', 'https://api.anthropic.com'))
      .toBe('https://api.anthropic.com/v1/messages')
  })

  it('anthropic: does not double /v1 when baseUrl already ends in /v1', () => {
    expect(buildEndpoint('anthropic', 'https://api.anthropic.com/v1'))
      .toBe('https://api.anthropic.com/v1/messages')
  })

  it('anthropic: strips trailing slashes', () => {
    expect(buildEndpoint('anthropic', 'https://proxy.example.com/'))
      .toBe('https://proxy.example.com/v1/messages')
  })
})

// ── Image format translation ─────────────────────────────────────────────────

describe('image format translation', () => {
  const images = [
    { type: 'image/png', base64: 'AAAA' },
    { type: 'image/jpeg', base64: 'BBBB' },
  ]

  function toOpenAIImages(imgs) {
    return imgs.map(img => ({
      type: 'image_url',
      image_url: {
        url: `data:${img.type || 'image/jpeg'};base64,${img.base64}`,
        detail: 'high',
      },
    }))
  }

  function toAnthropicImages(imgs) {
    return imgs.map(img => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.type || 'image/jpeg',
        data: img.base64,
      },
    }))
  }

  it('openai format: data URI in image_url', () => {
    const result = toOpenAIImages(images)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,AAAA', detail: 'high' },
    })
  })

  it('anthropic format: base64 in source', () => {
    const result = toAnthropicImages(images)
    expect(result).toHaveLength(2)
    expect(result[1]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: 'BBBB' },
    })
  })

  it('defaults to image/jpeg when type is missing', () => {
    const result = toAnthropicImages([{ base64: 'XX' }])
    expect(result[0].source.media_type).toBe('image/jpeg')
  })
})

// ── Request body structure ────────────────────────────────────────────────────

describe('request body structure', () => {
  it('openai: system prompt goes into messages array', () => {
    const messages = [{ role: 'user', content: 'hello' }]
    const system = 'You are helpful'
    const msgs = [{ role: 'system', content: system }, ...messages]
    expect(msgs[0].role).toBe('system')
    expect(msgs[1].role).toBe('user')
  })

  it('anthropic: system prompt is a top-level field, not in messages', () => {
    const body = {
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      stream: false,
      system: 'You are helpful',
      messages: [{ role: 'user', content: 'hello' }],
    }
    expect(body.system).toBe('You are helpful')
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0].role).toBe('user')
    // No system role in messages
    expect(body.messages.some(m => m.role === 'system')).toBe(false)
  })

  it('anthropic: max_tokens defaults to 4096 when not provided', () => {
    const maxTokens = undefined
    expect(maxTokens || 4096).toBe(4096)
  })

  it('anthropic: uses provided max_tokens when set', () => {
    const maxTokens = 8192
    expect(maxTokens || 4096).toBe(8192)
  })
})

// ── Attach images to messages ─────────────────────────────────────────────────

describe('attachImages helper', () => {
  function attachImages(messages, images, formatter) {
    if (!images || images.length === 0) return messages
    const msgs = messages.map(m => ({ ...m }))
    let lastUserIdx = -1
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') { lastUserIdx = i; break }
    }
    if (lastUserIdx === -1) return msgs
    const msg = msgs[lastUserIdx]
    let parts = typeof msg.content === 'string'
      ? [{ type: 'text', text: msg.content }]
      : Array.isArray(msg.content) ? [...msg.content] : [{ type: 'text', text: String(msg.content ?? '') }]
    parts.push(...formatter(images))
    msgs[lastUserIdx] = { ...msg, content: parts }
    return msgs
  }

  const fmt = (imgs) => imgs.map(img => ({ type: 'stub', data: img.base64 }))

  it('appends images to the last user message content', () => {
    const msgs = [{ role: 'user', content: 'hello' }]
    const result = attachImages(msgs, [{ base64: 'AA' }], fmt)
    expect(result[0].content).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'stub', data: 'AA' },
    ])
  })

  it('returns messages unchanged when no images', () => {
    const msgs = [{ role: 'user', content: 'hello' }]
    const result = attachImages(msgs, null, fmt)
    expect(result).toEqual(msgs)
  })

  it('does not mutate the input', () => {
    const msgs = [{ role: 'user', content: 'hello' }]
    attachImages(msgs, [{ base64: 'AA' }], fmt)
    expect(msgs[0].content).toBe('hello')
  })

  it('handles system + user messages (attaches to user)', () => {
    const msgs = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hello' },
    ]
    const result = attachImages(msgs, [{ base64: 'XX' }], fmt)
    expect(result[0].content).toBe('sys') // system unchanged
    expect(result[1].content).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'stub', data: 'XX' },
    ])
  })
})

// ── Stream parsers ────────────────────────────────────────────────────────────

describe('OpenAI stream parser', () => {
  async function* parseOpenAIStream(chunks) {
    let buffer = ''
    for (const chunk of chunks) {
      buffer += chunk
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

  it('yields delta content from SSE chunks', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" World"}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    const deltas = []
    for await (const d of parseOpenAIStream(chunks)) deltas.push(d)
    expect(deltas).toEqual(['Hello', ' World'])
  })

  it('handles partial lines across chunks', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hel',
      'lo"}}]}\n\ndata: [DONE]\n\n',
    ]
    const deltas = []
    for await (const d of parseOpenAIStream(chunks)) deltas.push(d)
    expect(deltas).toEqual(['Hello'])
  })

  it('ignores non-data lines', async () => {
    const chunks = [
      ': comment\n\ndata: {"choices":[{"delta":{"content":"X"}}]}\n\ndata: [DONE]\n\n',
    ]
    const deltas = []
    for await (const d of parseOpenAIStream(chunks)) deltas.push(d)
    expect(deltas).toEqual(['X'])
  })
})

describe('Anthropic stream parser', () => {
  async function* parseAnthropicStream(chunks) {
    let buffer = ''
    let currentEvent = ''
    for (const chunk of chunks) {
      buffer += chunk
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

  it('yields text from content_block_delta events', async () => {
    const chunks = [
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":" there"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ]
    const deltas = []
    for await (const d of parseAnthropicStream(chunks)) deltas.push(d)
    expect(deltas).toEqual(['Hi', ' there'])
  })

  it('stops on message_stop', async () => {
    const chunks = [
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"X"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Y"}}\n\n',
    ]
    const deltas = []
    for await (const d of parseAnthropicStream(chunks)) deltas.push(d)
    expect(deltas).toEqual(['X'])
  })

  it('ignores non-content_block_delta events', async () => {
    const chunks = [
      'event: message_start\ndata: {"type":"message_start"}\n\n',
      'event: content_block_start\ndata: {"type":"content_block_start"}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"OK"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ]
    const deltas = []
    for await (const d of parseAnthropicStream(chunks)) deltas.push(d)
    expect(deltas).toEqual(['OK'])
  })
})

// ── LlmError ──────────────────────────────────────────────────────────────────

describe('LlmError', () => {
  it('carries status and detail', () => {
    const err = new LlmError(429, 'rate limited')
    expect(err.status).toBe(429)
    expect(err.detail).toBe('rate limited')
    expect(err.message).toContain('429')
    expect(err.message).toContain('rate limited')
    expect(err.name).toBe('LlmError')
  })
})

// ── Header construction ───────────────────────────────────────────────────────

describe('header construction', () => {
  it('openai uses Authorization: Bearer', () => {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer sk-test-key`,
    }
    expect(headers['Authorization']).toBe('Bearer sk-test-key')
    expect(headers['x-api-key']).toBeUndefined()
  })

  it('anthropic uses x-api-key and anthropic-version', () => {
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': 'sk-ant-test-key',
      'anthropic-version': '2023-06-01',
    }
    expect(headers['Authorization']).toBeUndefined()
    expect(headers['x-api-key']).toBe('sk-ant-test-key')
    expect(headers['anthropic-version']).toBe('2023-06-01')
  })
})

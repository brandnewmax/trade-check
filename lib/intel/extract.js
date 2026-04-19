// Calls the lightweight extraction LLM and parses a structured JSON result.
// Pure parser (`parseExtractionJson`) and email-derivation helper are
// exported for testing.

const FIELDS = [
  'companyName',
  'companyUrl',
  'personName',
  'personTitle',
  'email',
  'phone',
  'country',
  'address',
  'products',
]

// Public/free email providers — if the extracted email uses one of these
// domains, we cannot treat the domain as a corporate website.
const FREE_EMAIL_DOMAINS = new Set([
  // Western
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'live.co.uk', 'msn.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.co.jp', 'yahoo.co.in', 'yahoo.fr', 'yahoo.de',
  'ymail.com', 'rocketmail.com',
  'aol.com', 'aim.com',
  'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me', 'pm.me',
  'zoho.com', 'zohomail.com',
  'yandex.com', 'yandex.ru',
  'mail.com', 'email.com',
  'gmx.com', 'gmx.net', 'gmx.de', 'gmx.us',
  'web.de', 't-online.de',
  'fastmail.com', 'fastmail.fm',
  'tutanota.com', 'tutanota.de', 'tuta.io',
  // Chinese
  '163.com', '126.com', 'yeah.net', '139.com', '189.cn', '188.com',
  'qq.com', 'foxmail.com', 'vip.qq.com',
  'sina.com', 'sina.cn', 'vip.sina.com',
  'sohu.com', 'tom.com', 'aliyun.com',
  // Korean
  'naver.com', 'daum.net', 'hanmail.net', 'kakao.com',
  // Indian
  'rediffmail.com',
  // Japanese
  'nifty.com', 'biglobe.ne.jp', 'excite.co.jp',
  // Russian
  'mail.ru', 'bk.ru', 'list.ru', 'inbox.ru', 'rambler.ru',
])

// Domains that, even when pasted in an inquiry, don't describe the sender's
// own corporate website — social, search, marketplaces, messaging, customs DBs,
// and AI assistants (which leak in via screenshots when senders draft inquiries
// through ChatGPT/Claude/Doubao etc.).
const NON_COMPANY_DOMAINS = new Set([
  // Search
  'google.com', 'google.co.uk', 'bing.com', 'baidu.com', 'yahoo.com', 'duckduckgo.com',
  // Social
  'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com',
  'linkedin.com', 'tiktok.com', 'youtube.com', 'youtu.be', 'pinterest.com',
  'reddit.com', 'wikipedia.org', 'wikimedia.org',
  // Marketplaces
  'alibaba.com', 'aliexpress.com', '1688.com', 'taobao.com', 'tmall.com', 'made-in-china.com',
  'amazon.com', 'amazon.co.uk', 'amazon.de', 'ebay.com', 'walmart.com',
  // Messaging
  'whatsapp.com', 'wa.me', 'wechat.com', 'weixin.qq.com', 'telegram.org', 't.me', 'signal.org',
  // Trade DBs
  'panjiva.com', 'importgenius.com',
  // Code hosting
  'github.com', 'gitlab.com',
  // AI assistants — Western (gemini.* / bard.* covered by google.com via parent match)
  'chatgpt.com', 'openai.com',
  'claude.ai', 'anthropic.com',
  'copilot.microsoft.com',
  'perplexity.ai',
  'character.ai',
  'poe.com',
  // AI image / video
  'midjourney.com',
  'runwayml.com',
  // AI assistants — Chinese (yiyan.baidu.com covered by baidu.com)
  'doubao.com',
  'kimi.com', 'moonshot.cn',
  'deepseek.com',
  'tongyi.aliyun.com',
  'xinghuo.xfyun.cn', 'xfyun.cn',
  'chatglm.cn', 'zhipuai.cn',
  '01.ai',
  'minimax.chat',
  'baichuan-ai.com',
])

export function deriveCompanyUrlFromEmail(email) {
  if (!email || typeof email !== 'string') return null
  const match = email.toLowerCase().trim().match(/@([a-z0-9][a-z0-9.-]*\.[a-z]{2,})$/i)
  if (!match) return null
  const domain = match[1]
  if (FREE_EMAIL_DOMAINS.has(domain)) return null
  if (NON_COMPANY_DOMAINS.has(domain)) return null
  const last2 = domain.split('.').slice(-2).join('.')
  if (NON_COMPANY_DOMAINS.has(last2)) return null
  return `https://${domain}`
}

// Strip protocol / www / path to a bare host, lowercased. Used by the
// post-LLM defensive filter to compare against blacklists.
function extractDomain(url) {
  if (!url || typeof url !== 'string') return null
  const d = url.toLowerCase().trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]
  return d || null
}

// Defensive post-LLM filter for `extracted.companyUrl`. Returns the URL
// unchanged if acceptable, or null if it should be cleared so the fallback
// chain (regex → email derivation) can attempt to find a better candidate.
//
// Clears in two cases:
//   1. The URL points at the USER'S OWN domain (LLM confused us with sender)
//   2. The URL is in NON_COMPANY_DOMAINS (chatgpt.com / linkedin.com / ...) —
//      leaks in via OCR'd screenshots when senders use ChatGPT etc. to draft
//      inquiries; the URL belongs to a tool, not the sender's company.
export function cleanExtractedCompanyUrl(url, userUrl) {
  const d = extractDomain(url)
  if (!d) return null

  if (userUrl) {
    const userD = extractDomain(userUrl)
    if (userD && d === userD) return null
  }

  if (NON_COMPANY_DOMAINS.has(d)) return null
  const last2 = d.split('.').slice(-2).join('.')
  if (NON_COMPANY_DOMAINS.has(last2)) return null

  return url
}

// Common corporate / ccTLD set used by the bare-domain fallback. Kept
// intentionally tight to reduce false positives on ambiguous tokens.
const CORPORATE_TLD_ALTERNATION = [
  'com', 'net', 'org', 'io', 'ai', 'co', 'us', 'uk', 'de', 'fr',
  'cn', 'jp', 'kr', 'au', 'ca', 'in', 'br', 'mx', 'es', 'it',
  'nl', 'pl', 'ru', 'tr', 'ae', 'sg', 'hk', 'tw', 'my', 'th',
  'id', 'ph', 'vn', 'za', 'biz', 'info', 'shop', 'store', 'tech',
  'asia', 'eu', 'me', 'pro', 'dev', 'app', 'xyz', 'ltd', 'group',
  'company', 'global', 'trade', 'industry', 'tools', 'world',
].join('|')

// Extract the first plausible corporate URL from free-form text.
// Passes, in priority order:
//   1. Strong — text contains an explicit http(s)://… or www.… prefix
//   2. Bare   — unprefixed domain surrounded by non-word chars, limited to
//               a curated corporate TLD whitelist (reduces false positives
//               on email addresses, filenames, and natural-language noise)
//
// Always filters against FREE_EMAIL_DOMAINS, NON_COMPANY_DOMAINS, and the
// `excludeDomain` (typically the user's own site).
export function deriveCompanyUrlFromText(text, excludeDomain) {
  if (!text || typeof text !== 'string') return null

  const excluded = new Set([...FREE_EMAIL_DOMAINS, ...NON_COMPANY_DOMAINS])
  if (excludeDomain && typeof excludeDomain === 'string') {
    const d = excludeDomain
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
    if (d) {
      excluded.add(d)
      const parts = d.split('.')
      if (parts.length > 2) excluded.add(parts.slice(-2).join('.'))
    }
  }

  const lower = text.toLowerCase()
  const seen = new Set()

  const tryDomain = (raw) => {
    let d = raw.toLowerCase().replace(/^www\./, '')
    if (seen.has(d)) return null
    seen.add(d)
    const parts = d.split('.')
    if (parts.length < 2) return null
    const sld = parts[parts.length - 2]
    if (!sld || sld.length < 2 || /^\d+$/.test(sld)) return null
    if (excluded.has(d)) return null
    const last2 = parts.slice(-2).join('.')
    if (excluded.has(last2)) return null
    return `https://${d}`
  }

  // Pass 1: strong — explicit http(s):// or www. prefix.
  const STRONG = /(?:https?:\/\/|\bwww\.)([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi
  for (const m of lower.matchAll(STRONG)) {
    const out = tryDomain(m[1])
    if (out) return out
  }

  // Pass 2: bare domain. Lookbehind excludes @, word chars, and dots (so
  // email addresses and subdomain fragments don't trigger stray matches).
  // Lookahead excludes @, word chars, and hyphens (but allows `.` so
  // trailing sentence periods are OK). TLD restricted to the whitelist.
  const BARE = new RegExp(
    `(?<![@\\w.-])([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\\.(?:${CORPORATE_TLD_ALTERNATION}))(?![@\\w-])`,
    'gi'
  )
  for (const m of lower.matchAll(BARE)) {
    const out = tryDomain(m[1])
    if (out) return out
  }

  return null
}

export function parseExtractionJson(raw) {
  if (!raw || typeof raw !== 'string') return null

  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) text = fence[1].trim()

  let obj = null
  try { obj = JSON.parse(text) } catch {}

  if (!obj) {
    const m = text.match(/\{[\s\S]*\}/)
    if (m) {
      try { obj = JSON.parse(m[0]) } catch {}
    }
  }

  if (!obj || typeof obj !== 'object') return null

  const out = {}
  for (const f of FIELDS) {
    if (f === 'products') out.products = Array.isArray(obj.products) ? obj.products.map(String) : []
    else out[f] = obj[f] ?? null
  }
  return out
}

// Dedicated OCR pre-pass. Some strong models (Claude, Gemini Pro) will
// correctly READ text off a business card during the main analysis stage
// but silently omit it from a structured JSON extraction call — presumably
// because they're being conservative about what they're "sure" of in
// strict-JSON mode. Running a free-form transcription call first and
// feeding the transcribed text into the extraction prompt (and the regex
// fallbacks) side-steps that reticence entirely.
async function transcribeImages({ images, baseUrl, apiKey, model }) {
  if (!Array.isArray(images) || images.length === 0) return null
  const endpoint = baseUrl.replace(/\/$/, '') + '/chat/completions'
  const prompt =
    'Please transcribe ALL visible text from the attached image(s), verbatim, in reading order. ' +
    'Include every name, title, email address, phone number, website/URL, company name, address, ' +
    'and any other printed or handwritten text — do not summarize, do not skip anything. ' +
    'Return only the transcribed text, no commentary, no headings, no JSON, no markdown. ' +
    'If there are multiple images, separate each with "---".'
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...images.map(img => ({
                type: 'image_url',
                image_url: {
                  url: `data:${img.type || 'image/jpeg'};base64,${img.base64}`,
                  detail: 'high',
                },
              })),
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) {
      let t = ''
      try { t = await res.text() } catch {}
      console.error('[intel/extract] OCR pre-pass HTTP', res.status, t.slice(0, 300))
      return null
    }
    const json = await res.json()
    const text = json?.choices?.[0]?.message?.content ?? ''
    console.log('[intel/extract] OCR transcript', { len: text.length, preview: text.slice(0, 200) })
    return text || null
  } catch (e) {
    console.error('[intel/extract] OCR pre-pass threw', e.message || e)
    return null
  }
}

// Identifies the INQUIRY SENDER (investigation target), NOT the user's own company.
// Accepts images (business cards, email screenshots) as multimodal input.
// `userUrl` is the user's own site URL — passed so the fallback URL-regex
// doesn't accidentally pick up the exporter's own domain from the inquiry.
export async function extractEntities({ inquiry, websiteText, images, userUrl, baseUrl, apiKey, model, systemPrompt }) {
  if (!baseUrl || !apiKey) {
    console.warn('[intel/extract] skipped: missing baseUrl or apiKey')
    return { status: 'skipped', error: 'missing baseUrl or apiKey', extracted: null }
  }
  console.log('[intel/extract] call', {
    model,
    hasImages: Array.isArray(images) && images.length > 0,
    imageCount: Array.isArray(images) ? images.length : 0,
    inquiryLen: (inquiry || '').length,
    websiteTextLen: (websiteText || '').length,
  })

  const hasImages = Array.isArray(images) && images.length > 0

  // Pre-pass: transcribe the images with the SAME model in free-form text
  // mode. Required because strict-JSON extraction tends to drop fields the
  // model is unsure about, even when the image clearly shows them.
  let imageTranscript = null
  if (hasImages) {
    imageTranscript = await transcribeImages({ images, baseUrl, apiKey, model })
  }

  const textPart =
    (websiteText
      ? `【我方公司背景(收件方,仅供参考,不要抽取为发件方)】\n${websiteText.slice(0, 1500)}\n\n`
      : '') +
    `【询盘文本】\n${inquiry || '(无)'}` +
    (imageTranscript
      ? `\n\n【图片转录(已 OCR,请把里面的公司名 / 网址 / 邮箱 / 电话 / 姓名提取到对应 JSON 字段)】\n${imageTranscript}`
      : hasImages
        ? `\n\n【图片附件】共 ${images.length} 张,请 OCR 识别其中的发件方姓名/公司/邮箱/电话/网址。`
        : '')

  const userContent = hasImages
    ? [
        { type: 'text', text: textPart },
        ...images.map(img => ({
          type: 'image_url',
          image_url: {
            url: `data:${img.type || 'image/jpeg'};base64,${img.base64}`,
            detail: 'high',
          },
        })),
      ]
    : textPart

  const endpoint = baseUrl.replace(/\/$/, '') + '/chat/completions'

  let res
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      // Intentionally NOT sending `response_format: { type: 'json_object' }`.
      // Some Vertex/proxy setups reject that field with HTTP 400, silently
      // breaking extraction. The prompt + parseExtractionJson (which strips
      // fenced code blocks and falls back to greedy JSON-match) is enough.
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(hasImages ? 45000 : 20000),
    })
  } catch (e) {
    console.error('[intel/extract] fetch threw', e.message || e)
    return { status: 'failed', error: e.message || String(e), extracted: null }
  }

  if (!res.ok) {
    let detail = ''
    try { detail = await res.text() } catch {}
    console.error('[intel/extract] HTTP', res.status, detail.slice(0, 400))
    return { status: 'failed', error: `HTTP ${res.status}: ${detail.slice(0, 200)}`, extracted: null }
  }

  let json
  try { json = await res.json() } catch (e) {
    console.error('[intel/extract] non-json response')
    return { status: 'failed', error: 'non-json response', extracted: null }
  }

  const content = json?.choices?.[0]?.message?.content ?? ''
  const extracted = parseExtractionJson(content)
  if (!extracted) {
    console.error('[intel/extract] parse failed; raw content:', content.slice(0, 500))
    return { status: 'failed', error: 'parse failed', extracted: null, raw: content }
  }
  console.log('[intel/extract] ok', {
    companyName: extracted.companyName,
    companyUrl: extracted.companyUrl,
    email: extracted.email,
    personName: extracted.personName,
  })

  // Defensive: clear `companyUrl` when the LLM extracted (a) our own domain
  // or (b) a known non-company domain (AI tools, social, marketplaces). The
  // fallback chain below will then try to find a better candidate.
  if (extracted.companyUrl) {
    const cleaned = cleanExtractedCompanyUrl(extracted.companyUrl, userUrl)
    if (!cleaned) {
      console.log('[intel/extract] companyUrl cleared (matched user/blacklist):', extracted.companyUrl)
      extracted.companyUrl = null
    }
  }

  // Fallback chain — run in priority order:
  //   1. LLM already extracted a good companyUrl → keep it
  //   2. Regex scan the combined (inquiry + image transcript) for URLs
  //   3. Derive from a corporate email domain
  if (!extracted.companyUrl) {
    const combinedText = [inquiry || '', imageTranscript || ''].filter(Boolean).join('\n')
    const fromText = deriveCompanyUrlFromText(combinedText, userUrl)
    if (fromText) {
      extracted.companyUrl = fromText
      console.log('[intel/extract] companyUrl recovered via regex fallback:', fromText)
    }
  }
  if (!extracted.companyUrl && extracted.email) {
    const fromEmail = deriveCompanyUrlFromEmail(extracted.email)
    if (fromEmail) {
      extracted.companyUrl = fromEmail
      console.log('[intel/extract] companyUrl derived from email:', fromEmail)
    }
  }

  return { status: 'ok', extracted }
}

# trade-check

外贸背调工具 — 收到询盘后自动从多个公开数据源采集情报，结合 LLM 生成证据驱动的风险分析报告。

## Tech Stack

- **Framework**: Next.js 14 (App Router, API Routes)
- **Frontend**: React 18, Tailwind CSS 3 (Stripe-inspired design system)
- **Database**: Upstash Redis (serverless)
- **Auth**: jose JWT (httpOnly cookie, 7-day expiry)
- **AI**: OpenAI-compatible + Anthropic Messages dual protocol
- **Search**: SerpAPI (Google search for intel gathering)
- **Deploy**: Vercel or Railway

## Project Structure

```
src/app/
  page.js                 # Full SPA — login, query, history, settings (single file ~2000 lines)
  layout.js               # Root layout with Geist fonts
  globals.css             # Tailwind base
  api/
    auth/route.js          # Login (POST) + logout (DELETE)
    me/route.js            # Current user info
    analyze/route.js       # Core: SSE streaming analysis (intel + LLM)
    queries/route.js       # Query history list (paginated)
    queries/[id]/route.js  # Single query detail (lazy-loaded)
    settings/route.js      # Global + user settings CRUD

lib/
  llm-client.js           # Protocol abstraction (OpenAI + Anthropic)
  auth.js                 # JWT sign/verify, session helpers
  kv.js                   # Upstash Redis — users, settings, queries, SerpAPI counter
  intel/
    index.js              # gatherIntel() orchestrator + resolveExtractionEndpoint()
    extract.js            # LLM entity extraction + OCR pre-pass + URL derivation
    format.js             # Intel → markdown briefing for main LLM prompt
    fetchWebsite.js       # Scrape company websites
    wayback.js            # Wayback Machine first-snapshot lookup
    serpapi.js            # SerpAPI search wrapper
    searches/
      linkedin.js         # LinkedIn company/person search
      facebook.js         # Facebook page search
      panjiva.js          # Panjiva customs/trade records
      maps.js             # Google Maps places lookup
      negative.js         # Negative/scam keyword search
      phone.js            # Phone number public record search
      general.js          # General web search

test/
  llm-client.test.js      # Protocol abstraction tests
  kv.test.js              # Redis/storage tests
  intel/
    extract.test.js       # Entity extraction + URL derivation
    format.test.js        # Briefing formatter
    resolve.test.js       # Endpoint resolution logic
    searches.test.js      # Search module tests
```

## Architecture

### Analysis Pipeline (4 stages in analyze/route.js)

1. **Stage 1**: Fetch user's own website + Serper brand search (silent context for LLM)
2. **Stage 2**: LLM extracts sender entity from inquiry text + images (OCR pre-pass → structured JSON)
3. **Stage 3**: 8-way parallel search on extracted entity (LinkedIn, Facebook, Panjiva, Maps, negative, phone, general, wayback)
4. **Stage 4**: Main LLM generates risk analysis report with intel briefing injected

### LLM Protocol (lib/llm-client.js)

Dual protocol support via `llmCall()` (non-streaming) and `llmStream()` (streaming generator):
- **OpenAI**: `POST {baseUrl}/chat/completions`, `Authorization: Bearer`, `choices[0].delta.content`
- **Anthropic**: `POST {baseUrl}/v1/messages`, `x-api-key`, `anthropic-version: 2023-06-01`, `content_block_delta` events

Key differences handled automatically:
- System prompt: in messages array (OpenAI) vs top-level field (Anthropic)
- Images: `image_url` format (OpenAI) vs `image` + `source.base64` (Anthropic)
- `max_tokens`: optional (OpenAI) vs required, default 4096 (Anthropic)

### Extraction Endpoint Resolution

Two independent protocol/endpoint configs:
- `protocol` + `baseUrl` + `apiKey` — main analysis
- `extractionProtocol` + `extractionBaseUrl` + `extractionApiKey` — extraction (falls back to main if empty)

Model selection: `extractionModelVision` when images present, `extractionModel` otherwise.

### Data Storage (Upstash Redis)

- `user:{email}` — user accounts (email, password, role, name)
- `user_settings:{email}` — per-user apiKey + modelName
- `global_settings` — admin config (baseUrl, protocol, prompts, SerpAPI key, extraction config)
- `query:{ts}:{rand}` — analysis records (result, riskLevel, scores, intel blob)
- `queries:all` / `queries:user:{email}` — list indexes
- `serpapi:usage:{YYYY-MM}` — monthly SerpAPI counter

History list uses `LIST_FIELDS` (lean payload excluding `intel` and `result` blobs). Full data fetched on-demand via `/api/queries/:id`.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm test             # Run all tests (vitest run)
npm run test:watch   # Watch mode
```

## Environment Variables

```
UPSTASH_REDIS_REST_URL     # Upstash Redis endpoint
UPSTASH_REDIS_REST_TOKEN   # Upstash Redis token
JWT_SECRET                  # JWT signing secret
ADMIN_EMAIL                 # Auto-created admin account
ADMIN_PASSWORD              # Admin password
TEST_EMAIL                  # Auto-created test user
TEST_PASSWORD               # Test user password
```

## Testing

Tests use vitest with `@/` path alias (maps to project root). Run `npm test` to execute all 6 test suites (~126 tests). Tests are pure unit tests — no Redis or network required.

## Key Conventions

- **Chinese UI**: All user-facing strings are zh-CN
- **Admin vs User**: Admin sees global settings (baseUrl, prompts, SerpAPI, extraction config). User only sees personal apiKey + modelName.
- **Images via config**: LLM calls pass images as `[{type, base64}]` in the `images` config field. The `llm-client` handles format translation per protocol.
- **SSE streaming**: Main analysis uses server-sent events with heartbeat pings every 8s. Client has 60s watchdog timeout.
- **Intel degradation**: If SerpAPI unavailable or intel collection fails, falls back to `fallbackSystemPrompt` (no intel data).
- **Vision models required for image extraction**: The extraction model must support multimodal input (vision). Pure text models (e.g. DeepSeek) cannot process uploaded images.

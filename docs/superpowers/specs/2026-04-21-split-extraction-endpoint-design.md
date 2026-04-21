# Split Extraction Endpoint — Design

> Status: approved in conversation 2026-04-21 · scope: single hotfix-style change

## Problem

Structured entity extraction (`lib/intel/extract.js`) currently shares the main analysis `baseUrl` + per-user `apiKey`, and hotfix ⑪ forces extraction to the main model whenever images are present. Consequences:

1. When a user sets `extractionModel = gemini-3.1-flash-lite-preview` and uploads a screenshot, the model silently switches to their main model (e.g., Sonnet 4.6). The configured value is not respected in the vision case.
2. Extraction cannot be routed to a different provider (cheaper, faster, better JSON adherence).
3. There is no explicit place to configure a vision-specialised extraction model — the choice is binary (configured vs. main).

The goal is to make extraction endpoint + model explicitly user-controlled, while keeping existing users unaffected.

## Design

### New global settings fields

Added to `global_settings` hash (Upstash Redis, admin-only):

| Key | Purpose | Required | Default on blank |
|-----|---------|----------|------------------|
| `extractionModel` | Model for text-only inquiries | Always | `gemini-2.5-flash` (existing) |
| `extractionModelVision` | Model for inquiries with images | Always | — (must be filled on first save) |
| `extractionBaseUrl` | Separate endpoint URL | Optional, paired | Falls back to main `baseUrl` |
| `extractionApiKey` | Separate API key | Optional, paired | Falls back to user's `apiKey` |

`extractionBaseUrl` and `extractionApiKey` are atomic — both filled or both blank. Any other combination is rejected on save.

### Save validation (`/api/settings` POST, admin path)

Pure validator `validateGlobalExtractionSettings(data)` returns first error (if any):

| Condition | Error response |
|-----------|---------------|
| `extractionModel` blank | `请填写:抽取模型(无图片)` |
| `extractionModelVision` blank | `请填写:抽取模型(有图片)` |
| `extractionBaseUrl` set, `extractionApiKey` blank | `填写独立抽取端点时,Base URL 和 API Key 必须同时填写(缺 API Key)` |
| `extractionApiKey` set, `extractionBaseUrl` blank | `填写独立抽取端点时,Base URL 和 API Key 必须同时填写(缺 Base URL)` |

Only one error returned per save — users fix one at a time. Returns HTTP 400 with `{ error: '...' }`. Frontend already renders a red banner for save errors.

### Resolution at call time (`lib/intel/index.js`)

New pure function `resolveExtractionEndpoint(globalSettings, userApiKey, hasImages)` returns `{ baseUrl, apiKey, model }`:

```
useSeparate = !!(globalSettings.extractionBaseUrl && globalSettings.extractionApiKey)
baseUrl     = useSeparate ? globalSettings.extractionBaseUrl : globalSettings.baseUrl
apiKey      = useSeparate ? globalSettings.extractionApiKey  : userApiKey
model       = hasImages
                ? globalSettings.extractionModelVision
                : globalSettings.extractionModel
```

`gatherIntel` calls this once, passes the resolved triple to both `transcribeImages` and `extractEntities`. The hotfix ⑪ override ("images → main model") is removed — the vision model comes from `extractionModelVision` instead.

### UI changes (`src/app/page.js` SettingsPage, admin only)

Under the existing "实时情报" card, extend the extraction block:

- Rename existing input "结构化抽取模型" → "抽取模型(无图片)"
- Add "抽取模型(有图片)" input below it, same styling
- Add "独立抽取 Base URL" input (placeholder: `留空则使用主 Base URL`)
- Add "独立抽取 API Key" input using `PasswordInput` (placeholder: `留空则使用主 API Key`)

No visual/layout changes beyond new fields in the same card.

### Data migration

Zero migration. `hgetall` returns `undefined` for new keys on existing records. On the next admin save, validation forces `extractionModelVision` to be filled (copy from `extractionModel` is the obvious quick fix). Existing `extractionModel` value is untouched.

### Error surfacing

Unchanged — `extractEntities` already writes `status` / `error` / `extractionModel` into `intel.meta`, which `IntelPanel` renders as a red banner on extraction failure (hotfix ⑬).

## Test plan (TDD)

### `resolveExtractionEndpoint` (new pure function)

- returns main endpoint + main apiKey when separate fields blank, text model when no images
- returns main endpoint + main apiKey when separate fields blank, vision model when images
- returns separate endpoint + separate apiKey when both filled, text model when no images
- returns separate endpoint + separate apiKey when both filled, vision model when images
- treats empty string as blank (falls back to main)

### `validateGlobalExtractionSettings` (new pure function)

- returns null when all required filled and pair consistent
- returns null when extractionBaseUrl and extractionApiKey both blank
- returns error when extractionModel blank
- returns error when extractionModelVision blank
- returns error when only extractionBaseUrl filled
- returns error when only extractionApiKey filled
- returns first error when multiple fields invalid (model validation before endpoint pairing)

### Full suite

All 83+ existing tests still pass; `npm run build` clean.

## Out of scope

- `extractionPrompt` behavior unchanged
- `userSettings.apiKey` / `userSettings.modelName` semantics unchanged (main analysis only)
- No UI for clearing the extraction pair once set (admin simply blanks both fields)
- No per-user extraction overrides (global-only, matches existing extraction model pattern)

## Rollout

1. Failing tests for both pure functions
2. Implement `kv.js` schema additions, `index.js` resolver, `extract.js` signature change, route validation, UI fields
3. Full suite + build
4. Commit + push to main (Railway auto-deploy)
5. Admin must visit `/settings` and fill `extractionModelVision` on first save after deploy
6. Notebook entry ㉖ added in follow-up commit

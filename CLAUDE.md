# Claude Rules for This Project

## Code Style
- Use conservative, deterministic code — temperature 0.1 to 0.2 max.
- No experimental patterns, creative abstractions, or novel approaches.
- When multiple valid solutions exist, choose the most conventional and widely-accepted one.

## Before Writing Code or Running Commands
- Always output your thought process first: what you're building, why you made each key decision, and what you're uncertain about.
- Do not act before the plan is stated.

## Sources and Uncertainty
- Verify package versions, API compatibility, and dependency requirements from official sources (npm, GitHub releases, official docs) before using them.
- Do not guess version numbers, API signatures, or compatibility — check first.
- If something is unknown or uncertain, ask rather than assume.

---

## Project: Ticket Tracker
React 18 + Vite 5 SPA. Restaurant ops dashboard: daily/monthly sales (delivery vs pickup), platform breakdown (DoorDash / Uber Eats / Grubhub), food-cost imports (OCR + spreadsheet), menu analytics, and a P&L view. Offline-first, no backend, no API keys.

### Aliases (vite.config.js)
`@components` `@hooks` `@utils` `@styles` → `/src/...`

### Persistence
All persisted state goes through `useLocalStore(namespace, { version, initial, migrate })` in `src/hooks/useLocalStore.js`. Keys prefixed `ticket-tracker:`. Writes are debounced 50ms; private-browsing/quota errors are swallowed silently.

| Store hook | localStorage key | Shape |
|---|---|---|
| `useOrderStore` | `days` | `{ 'YYYY-MM-DD': dayRecord }` |
| `useMonthlyStore` | `months` | `{ 'YYYY-MM': monthRecord }` |
| `useFoodCostStore` | `foodcost-groups` | `[{ id, name, date, status, items, importedAt }]` |
| `useOperatingCostsStore` | `operating-costs` | `{ labor: { 'YYYY-MM': number }, fixed: { 'YYYY-MM': [{ id, category, amount, notes }] } }` |
| `useInventoryStore` | `inventory` | `{ items: [{ id, name, unit, parLevel }], movements: [{ id, itemId, date, type: 'restock'\|'usage'\|'waste', quantity, note, source, sourceGroupId? }] }` — on-hand is derived by summing movements, never stored; `sourceGroupId` guards food-cost imports against double-entry |
| (read in P&L + Dashboard) | `pl-targets` | `{ laborPct, overheadPct, otherPct }` |

### Data-model gotchas
- **`totalRevenue` override**: on a day/month record, when `> 0` it replaces the `delivery+pickup` sum. `useOrderStore.dailySummary` applies this; the form has a dedicated input. The Sheets export preserves this in a "Total Revenue (Manual)" column for round-tripping.
- **Food cost has two sources**: `useFoodCostStore` derives `foodCostByDay` / `foodCostByMonth` (only `status === 'done'` groups count). Monthly records also have an optional `foodCost` field set by the FoodCost → Monthly export. P&L and Dashboard prefer the live `foodCostByMonth[m]` and fall back to `months[m].foodCost`.
- **`source` field** on records is `'manual' | 'imported' | 'demo'` and drives UI badges. Importer always tags as `'imported'` regardless of what the file says.
- **`pl-targets` is shared** between [ProfitLossTab](src/components/ProfitLossTab/ProfitLossTab.jsx) (writes) and [Dashboard](src/components/Dashboard/Dashboard.jsx) (reads). Both call `useLocalStore('pl-targets', …)`. They each hold their own in-memory copy but sync through localStorage on next mount — the Dashboard reads fresh values whenever you navigate to it.
- **Operating costs actuals override pl-targets** when present. P&L `computePL` and Dashboard `totals` prefer `laborByMonth[m]` over `revenue * laborPct / 100`, and `fixedByMonth[m]` over `revenue * overheadPct / 100`. Other stays as % only. Lines marked with an `actual` badge in both views when sourced from actuals. Dashboard sums any month overlapping the active date range — partial-month overlaps still count the full month's actual (pragmatic, documented).

### UI conventions
- **Tabs**: registered in [navConfig.js](src/components/Navbar/navConfig.js). Drives both Navbar and MobileDrawer. Adding a tab is a one-line `NAV_GROUPS` edit + a render block in App.jsx.
- **i18n**: every user-visible string goes through `useLang().t.<key>`. Translations live in [src/i18n/translations.js](src/i18n/translations.js) — keys MUST be added to all three locales (en / zh / es).
- **Theme-aware colors**: derive colors per render via `useTheme()` inside the component, NOT as module-level constants. There was a real bug where dark hex constants leaked into light mode (Dashboard accent invisible on white). Pattern: build a `C = { accent, delivery, pickup, foodCost, grid, tick }` object inside the component and reference `C.x` from JSX.
- **CSS variables**: actual project tokens are `--surface`, `--surface2`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-dim`, `--accent-on`, `--danger`. Don't invent names like `--card-bg` — the fallback will silently fail.
- **Native `<select>` and `<input type="date">`** are OS-rendered; JS/CSS cannot inject controls into their open panels. For long option lists use [components/ui/Dropdown.jsx](src/components/ui/Dropdown.jsx) (scrollable, jump-to-bottom arrow, keyboard nav, themed via CSS vars).

### Tier 1 roadmap — ALL DONE
Reference for future planning; don't re-implement.
1. Date-anchored food cost + Food % on summary cards
2. Net profit per platform
3. Menu Analytics (top-seller aggregation)
4. Menu Engineering Matrix (Stars/Plowhorses/Puzzles/Dogs)
5. Food Cost → Monthly Summary export
6. WoW / MoM / YoY comparison overlays on Dashboard
7. Profit & Loss view

### Sheets export — round-trip contract
[src/utils/sheetIO.js](src/utils/sheetIO.js). `exportToXlsx({ dailySummary, deliveryRates, months, foodCostByDay, foodCostByMonth, foodCostGroups, plTargets })` writes up to 5 sheets: Daily Summary, Monthly Summary, Delivery Fees, Food Cost Detail, P&L Targets. The importer (`importFromXlsx`) only reads Daily/Monthly Summary sheets and preserves `totalRevenue` override + monthly `foodCost` field for round-tripping.

### Demo mode
[src/utils/demoData.js](src/utils/demoData.js). All loaded by the "Load Demo Data" button on the Daily Summary empty state; every generator uses deterministic IDs so re-loads replace instead of duplicating.
- `generateDemoDays()` — 90 days of plausible records (weekend bumps, upward trend, ~$450–550/day, platform split DD 40 / Uber 35 / Grubhub 25).
- `generateDemoFoodCostGroups()` — ~26 import groups, realistic SKUs from 4 rotating suppliers (Sysco / US Foods / Restaurant Depot / Performance Food) at ~28% of demo revenue. IDs `demo-fc-YYYY-MM-DD`.
- `generateDemoLabor(demoDays)` — monthly labor at ~28–32% of that month's demo revenue (keyed `YYYY-MM`, overwritten via `setLaborForMonth`).
- `generateDemoFixedCosts(demoDays)` — six fixed-cost lines per month (~$5,100 total), IDs `demo-fixed-YYYY-MM-<slug>`, replaced via `setFixedForMonth`.
- `generateDemoRecipes()` — five recipes (pizzas, pastas, salad) whose ingredient names exactly match the food-cost catalog so import-driven autofill suggestions line up; plate costs land at 16–28% of sell price. IDs `demo-recipe-<slug>`, merged via `upsertRecipes` (replaces demo ids, leaves user recipes untouched).
- `generateDemoInventory()` — eight stocked items matching catalog SKUs with three weeks of dated movements (weekly restocks + usage, one waste entry per item); three items land at/below par so the low-stock badge shows. IDs `demo-inv-*`, merged via `upsertDemo`.

### Destructive actions
Clear-all-data lives in the **Sheets tab → bottom danger zone** (inline two-click `DangerConfirmButton`). Wipes order/monthly/food-cost/operating-costs/recipe/inventory stores plus the extra data keys (`pl-targets`, `item-costs`, `menu-item-costs`, all `scanner-*`), then `window.location.reload()` so components reading their own `useLocalStore` slices come back clean. **Preference keys survive on purpose**: `dashboard-colors` (like theme/language). Gotcha: a key owned by an always-mounted `useLocalStore` (e.g. App-level `item-costs`) must also have its in-memory state reset — the hook's `beforeunload` flush would otherwise write the old value back after `removeItem`.

### Build
`npm run build` (Vite). Lazy-loaded route chunks per tab. Lint/type-check is part of the build.

---

## Audit Findings (2026-05-21)

Full audit across correctness, accessibility, i18n, and performance. Items grouped by priority.

### Tier 1 — Correctness bugs (fix before next release)

**#1 — Sheets round-trip corruption** ✅ FIXED (`cb404ba`)
- `parseSummarySheet` legacy delivery fallback double-counted `totalRevenue` override as delivery revenue. Fixed with `isLegacySheet = totalManCol === -1` guard.
- Daily food cost was dropped on import. Now preserved on daily records too.
- Dashboard `foodCostTotal` / `rawChartData` and DailySummaryTable food-cost pill fall back to `days[date].foodCost`.

**#2 — P&L double-counting mixed-source months** ✅ FIXED (`19c327e`)
- File: [src/components/ProfitLossTab/ProfitLossTab.jsx](src/components/ProfitLossTab/ProfitLossTab.jsx) ~line 32
- `computePL` sums `dailyRevenue + manualRevenue` unconditionally. When a month has both daily records AND a manual `months[key]` record (e.g. from an older import), both sources stack.
- Dashboard avoids this with a `dailyMonthKeys` guard: months covered by daily data exclude the manual record. Apply the same guard in `computePL`.
- Fix: `const hasDailyData = dailyEntries.length > 0; const manualRevenue = hasDailyData ? 0 : (manualRec?.totalRevenue || manualRec?.deliveryRevenue + manualRec?.pickupRevenue || 0);`

**#3 — Month-overlap off-by-one** ✅ FIXED (`19c327e`)
- Files: [src/components/Dashboard/Dashboard.jsx](src/components/Dashboard/Dashboard.jsx) ~lines 223, 347 (the `-28` pattern was only in Dashboard; sheetIO.js had no such comparison).
- Pattern `m + '-28' >= fromDate` used to check if a month falls within a date range. Failed for February (no day 29 in common years) and for ranges starting on the 29th–31st.
- Fixed: both filters now use `m.month <= toDate.slice(0, 7) && m.month >= fromDate.slice(0, 7)` — a `YYYY-MM` prefix comparison.

**#4 — Missing translation keys** ✅ FIXED (`19c327e`)
- File: [src/i18n/translations.js](src/i18n/translations.js)
- 5 keys exist in JSX but are absent from all three locales (en / zh / es), causing silent `undefined` render:
  - `labelMonth` — used in OperatingCostsTab month label
  - `colDate` — used in food cost detail table header
  - `removeBtn` — used in fixed-cost line item remove button
  - `plMonthPicker` — used as aria-label on P&L month `<select>`
  - `opCostsMonthPicker` — used as aria-label on OperatingCosts month picker
- Fix: add all 5 keys to `en`, `zh`, and `es` objects in translations.js.

**#5 — Mobile drawer accessibility** ✅ FIXED (`19c327e`)
- File: [src/components/Navbar/MobileDrawer.jsx](src/components/Navbar/MobileDrawer.jsx)
- Was missing `role="dialog"`, `aria-modal="true"`, and a focus trap. Screen readers and keyboard users could tab through background content while the drawer was open.
- Fixed: added `role="dialog" aria-modal="true"` to the `<aside>`; a `useEffect` moves focus into the drawer on open and cycles Tab/Shift-Tab within it (instead of disabling outside elements).

**#6 — Silent localStorage write failures** ✅ FIXED (`19c327e`)
- File: [src/hooks/useLocalStore.js](src/hooks/useLocalStore.js)
- `try/catch` around `localStorage.setItem` swallowed quota errors and private-browsing `SecurityError` with no user feedback. In private mode the store silently accepted writes but data was lost on close.
- Fixed: on catch, `writeToStorage` dispatches a `tt:storage-error` CustomEvent (once per session). App.jsx listens for it and renders a dismissible `.storage-warning-banner` ("Storage unavailable — data will not be saved.", i18n'd across en/zh/es).

**#7 — useMemo used as side-effect in OperatingCostsTab** ✅ FIXED (`19c327e`)
- File: [src/components/OperatingCostsTab/OperatingCostsTab.jsx](src/components/OperatingCostsTab/OperatingCostsTab.jsx)
- A `useMemo` block called `setLaborInput(...)` — a state setter — which is a side effect, not a derived value. React may run `useMemo` multiple times in StrictMode/Concurrent Mode.
- Fixed: replaced that `useMemo` block with a `useEffect` with the same dependency array (`useEffect` added to the React import; the legitimate `monthOptions` useMemo stays):
  ```js
  useEffect(() => {
    setLaborInput(laborByMonth[selectedMonth] != null ? String(laborByMonth[selectedMonth]) : '');
  }, [selectedMonth, laborByMonth]);
  ```

### Tier 2 — Quality / UX issues — ALL DONE ✅

All nine items shipped (June 2026): locale-aware `formatCurrency` via `useLang()`,
icon-button aria-labels, iOS 16px input rule, `DangerConfirmButton` inline confirm,
memoized `dailySummary`, xlsx/pdfjs manual chunks, shared `RevenueForm`,
Dashboard split (718→~350 lines, chart sub-components), ResultsTable split
(853→630, `ItemRow` + `ExportSummaryPanel`).

---

## Audit Findings (2026-06-10)

Second audit pass, covering code added after the May audit (dashboard color
customization, Recipe tab, Excel export) plus a UX/perf sweep. Work is batched
into three PRs; status updated as each lands.

### PR batch 1 — Color customization fixes (#1, #2, #5, #7) — ✅ MERGED (PR #5, `0c302fa`)

**#1 — Custom colors ignore theme (documented bug class)**
- [src/components/Dashboard/useDashboardColors.js](src/components/Dashboard/useDashboardColors.js) `getColor` returns the same custom hex for dark AND light themes. A color picked in dark mode (e.g. neon yellow) is illegible in light mode — exactly the "dark hex leaked into light mode" bug class from the May audit.
- Fix: store custom colors per-theme — `dashboard-colors` shape becomes `{ dark: {...}, light: {...} }`; custom override only applies to the theme it was set in. Migrate the flat v1 shape into `dark`.

**#2 — Color editor UI entirely hardcoded English**
- [ColorEditor.jsx](src/components/Dashboard/ColorEditor.jsx) ("Customize Dashboard Colors", "Reset to Default", "Chart Colors", "Platform Colors"), [Dashboard.jsx](src/components/Dashboard/Dashboard.jsx) ("Edit Colors"/"Done" button + title), [ColorPicker.jsx](src/components/Dashboard/ColorPicker.jsx) (`Edit {label} color` title), and all 8 labels in `getEditableColors()`.
- Fix: ~12 new keys × 3 locales (en/zh/es); pass `t` through or call `useLang()` in each component.

**#5 — ColorPicker accepts invalid hex**
- Free-text input pushes unvalidated text into chart strokes and `<input type="color">` (accepts only `#rrggbb`).
- Fix: validate `/^#[0-9a-f]{6}$/i` before committing; keep local draft state for partial typing.

**#7 — `updateColor` stale-closure spread**
- `setCustomColors({ ...customColors, [key]: value })` drops writes during rapid native-picker drags.
- Fix: functional form `prev => ({ ...prev, [key]: value })`.

### PR batch 2 — Recipe locale + demo-load UX (#3, #6) — ✅ MERGED (PR #6, `b28fb2a`)

**#3 — RecipeTab regressed to raw `formatCurrency`**
- [RecipeTab.jsx](src/components/RecipeTab/RecipeTab.jsx) imports from `@utils/helpers` instead of destructuring the locale-bound version from `useLang()` (the pattern every other component uses). Plate costs don't follow the active locale.

**#6 — `alert()` on demo load**
- [DailySummaryTable.jsx](src/components/DailySummaryTable/DailySummaryTable.jsx) `handleLoadDemo` calls blocking, unstyled `alert()`. Replace with an inline success banner (same pattern as sheet-feedback).

### PR batch 3 — Clear-all completeness + chunk naming (#4, #8) — ✅ MERGED (PR #7, `474034a`)

**#4 — Clear-all leaves data behind**
- `handleClearAll` in [App.jsx](src/App.jsx) misses: all nine `scanner-*` keys (results, manual-items, edits, removed, order, rawtext, file-name, detected-date, show-results), `item-costs`, `menu-item-costs`. Danger-zone copy promises a full wipe.
- Decision: `dashboard-colors` is a **preference** (like theme/language) and intentionally survives clear-all. Everything else above gets wiped.

**#8 — recharts chunk naming**
- Vite auto-splits recharts (375 KB) but with an unstable hashed name. Add `recharts: ['recharts']` to `manualChunks` for a stable cacheable chunk, matching xlsx/pdfjs.

### Verified clean (no action)
- `useMonthlyStore` / `useRecipeStore`: no derived data, no memoization needed.
- `useFoodCostStore`: memoizes correctly.
- Excel Dashboard-sheet export code: clean.
- RecipeTab a11y (aria-labels, keyboard-expandable cards): done well.
- Recipe i18n keys: present in all three locales.

---

## Backend Plan (2026-06-14) — NOT STARTED

Optional sync/backup layer. The app stays **offline-first**: `useLocalStore` remains the
local source of truth, the backend is a replica. Both backends are **$0** and **opt-in** —
signed-out behavior is byte-for-byte today's app.

### Core insight
Persistence is already backend-shaped: every store serializes to a versioned JSON envelope
(`{ v, data }`) under ~10 known namespaces (`days`, `months`, `foodcost-groups`, `inventory`,
`recipes`, `operating-costs`, …). The backend is a **per-namespace blob sync**, NOT a relational
remodel. One serialization contract, two pluggable adapters.

```
useLocalStore (unchanged, local-first)
        │  envelope { v, data } per namespace
        ▼
   syncEngine.js  ──► SupabaseAdapter  (auto, live, last-write-wins)
                  └─► DriveAdapter      (manual or auto, whole-bundle)
```
Adapter contract: `pull()` / `push(namespace, envelope)` / `pushAll()`. Restoring an older backup
flows through `useLocalStore`'s existing `migrate()` because the envelope carries `version`.

### Two backends, different roles (a user can enable either/both)
- **Supabase** — live multi-device sync replica; data lives in *our* project. Convenience layer.
- **Google Drive** — user-owned backup / restore / portability; data lives in the *user's* Drive.
  Trust + disaster-recovery layer (the app currently has none beyond the Excel export).

### Supabase specifics
- Single table `store_blobs (user_id, namespace, version, data jsonb, updated_at)`, PK
  `(user_id, namespace)`, **row-level security** `auth.uid() = user_id`. Auto-generated REST API —
  no server code. Magic-link email auth (no passwords, no mail server).
- Free tier (verified 2026-06): 500MB DB, 50K MAU, unlimited API requests. **Pauses after 1 week
  of DB inactivity** — mitigated by daily restaurant writes + an optional GitHub Actions weekly
  keep-alive cron. Our data volume is ~0.1% of the cap.
- Conflict policy v1: last-write-wins per namespace (one owner, 2–3 devices). v2 if needed:
  per-key merge for `days`/`months` (keyed objects).

### Google Drive specifics
- **Scope `drive.file` ONLY** — this is the load-bearing decision. It is **non-sensitive**, grants
  access only to app-created files, and therefore **skips Google's paid security assessment**. A
  broader scope (e.g. listing existing files) flips the app into restricted/sensitive territory and
  triggers verification — **never widen it**.
- Google Identity Services token client in-browser (SPA flow, no client secret, no backend).
- One bundle file `tickettracker-backup.json` holding all envelopes (simpler than per-namespace).
- Manual first: "Back up / Restore to Google Drive" buttons in the **Sheets tab** beside the Excel
  export. Restore = sign in, pull bundle, rehydrate every namespace, reload. Optional auto-backup
  later (same debounced hook as Supabase).

### Phased rollout
1. **Phase 1 (½ day + ~1 day)** — shared `syncEngine` + envelope contract, then `DriveAdapter`
   first (lowest risk: OAuth + file read/write, no DB/auth/RLS). Ship backup/restore buttons.
2. **Phase 2 (1–2 days)** — Supabase project, `store_blobs` + RLS, magic-link auth,
   `SupabaseAdapter`, live auto-sync, signed-in/out UI.
3. **Phase 3 (1 day)** — auto-backup toggles, sync-status indicator (reuse `tt:storage-error`
   event pattern), keep-alive cron, docs. i18n ×3 throughout (~10–15 new keys).
4. **Phase 4 (optional, depends on Phase 2)** — cloud image analysis for the Scanner (below).

### Image analysis APIs (Scanner upgrade path) — free options + rate limits
Today the Scanner runs Tesseract.js fully client-side (free, offline, but raw-text OCR + brittle
regex parsing). With the backend in place, cloud image analysis becomes possible — the enabler is
**key custody**: these API keys are SECRET (unlike the anon key / OAuth client ID) and must never
ship in the SPA. A **Supabase Edge Function** (free tier: 500K invocations/month) holds the key and
proxies `image → structured JSON` for signed-in users.

**Recommended: Gemini Flash free tier** (no credit card required). Multimodal + JSON mode means the
model returns structured line items (`{ name, cost, quantity, date }`) directly — replacing BOTH the
OCR step and the regex parsing, which is where most Scanner bugs live. Verified 2026-07:

| Provider (free tier) | Rate limits | Notes |
|---|---|---|
| **Gemini Flash** ✅ | ~10 req/min · 250K tokens/min · **1,500 req/day**, resets midnight PT | Multimodal, JSON mode, no card. Limits are **per project, not per user**, and Google revises them without notice (Pro models were dropped from free tier Apr 2026) |
| OCR.space | 25,000 req/month (~500/day), **1MB file cap** | Pure OCR — keeps the existing regex parser; simplest swap-in |
| Google Cloud Vision | 1,000 units/month | Rejected: requires a billing account (card on file) |

**Rate-limit issues & mitigations (design these in from day one):**
- **Shared-quota problem**: free-tier RPD is per API key/project — every user of the app drains the
  same 1,500/day. Fine for a handful of restaurants (~30 scans/day each); a real multi-tenant
  rollout needs the paid tier (~$0.10/1K receipt images at Flash pricing) or per-user keys.
- **429 handling**: Edge Function returns the provider's `retry-after`; client queues the scan and
  retries with exponential backoff. Scans are already async with a progress UI — reuse it.
- **Per-user cap**: enforce a daily per-user counter in the Edge Function (e.g. 50 scans/user/day)
  so one user can't drain the shared project quota.
- **Shrink requests**: downscale/compress images client-side before upload (canvas already exists
  for the preview); one request per ticket, batching multi-page PDFs into a single call.
- **Fallback chain keeps offline-first intact**: Gemini → OCR.space → **local Tesseract** (already
  shipped). Rate-limited, offline, or signed-out users silently get today's behavior — cloud
  analysis is an enhancement, never a dependency.
- **Limits drift**: free tiers change without notice; the Edge Function proxy means swapping
  providers never touches the client.

### Notes / risks
- Introduces the project's first env config: Supabase URL + anon key, Google OAuth client ID. **All
  three are public-by-design and client-safe** (RLS / `drive.file` do the enforcement) — but this
  ends the "no API keys" line in the Project header; update it when Phase 1 lands.
- Portability preserved: the blob contract ports to Cloudflare D1 / PocketBase (replacing Supabase)
  or Dropbox / local-file (replacing Drive) without touching any store.
- Cheaper alternatives considered and rejected for now: Cloudflare D1 (must hand-roll auth + email),
  Firebase (NoSQL remodel, lock-in), PocketBase on a VPS (~$4/mo, you babysit a server).

---

## Third-Party API Integration Plan (2026-07-04) — NOT STARTED

Auto-import sales data from delivery platforms and POS systems, replacing manual entry /
scanner OCR as the primary data path. **Depends on Backend Plan Phase 2** (Supabase auth +
Edge Functions) — same key-custody argument as the image-analysis plan: platform OAuth
client secrets and API keys are SECRET and must never ship in the SPA, and none of these
APIs serve CORS to browsers. Every connector runs server-side in an Edge Function.

### Access reality check (verified 2026-07 from official portals)

| Provider | Self-serve for one restaurant? | Notes |
|---|---|---|
| **Square POS** ✅ | Yes, free | Open developer platform, unlimited free sandbox, Orders/Payments APIs; personal access token for own merchant account. Easiest first connector. |
| **Clover POS** ✅ | Yes, free | Self-serve dev account, sandbox + production, OAuth REST API for own-merchant orders/payments. |
| **Toast POS** ⚠️ | Yes, with caveats | "Standard API access" = self-serve **read-only** credentials for your own location, but requires an active Toast RMS Essentials+ subscription. Write/multi-merchant needs the vetted partner program. |
| **DoorDash** ⚠️ | Request form, approval-gated | Reporting API (Financials/Operations/Menu reports) is open to individual merchant developers via a signup form; access team reviews; free once approved; US/CA/AU. The full Marketplace API is partner-only (quarterly backlog review). |
| **Uber Eats** ⚠️ | Portal exists, agreement needed | Developer portal + OAuth 2.0 client credentials; Reporting API requires "an aligned business agreement with Uber" (enterprise-oriented, 2–4 week integration). Uncertain for a single restaurant — apply and see. |
| **Grubhub** ❌ | No | No public API. Partner program is for POS vendors / ordering providers only. Fallback: merchant-portal CSV/statement download → file import (reuse sheetIO pipeline). |
| Aggregators (KitchenHub, Chowly, Otter, Cuboh, Deliverect) ❌ | Paid, custom pricing | One API for all platforms, but violates the $0 constraint and targets order management, not reporting. Rejected for now; revisit if the app ever goes multi-tenant commercial. |

### Architecture — connector layer

```
Platform / POS APIs  ──►  Supabase Edge Function (per-provider connector)
     (secret creds)          │  OAuth handshake + token refresh + normalize
                             ▼
                   normalized dayRecord patches
                             │  { date, deliveryRevenue, pickupRevenue,
                             │    platforms: { doordash, ubereats, grubhub },
                             ▼    source: 'api', connector: 'square' | ... }
                     client merges via upsertDay
```

- **Connector contract** (mirrors the sync-adapter pattern): `connect()` (OAuth flow),
  `fetchRange(from, to) → dayRecord[]`, `disconnect()`. One Edge Function per provider.
- **Token custody**: provider refresh tokens stored in a Supabase `connector_tokens`
  table (`user_id, provider, tokens jsonb, updated_at`), RLS `auth.uid() = user_id`,
  encrypted at rest. The SPA never sees provider tokens — only its own Supabase JWT.
- **Merge policy**: API data lands as `source: 'api'` (new value alongside
  `manual`/`imported`/`demo`) with a per-record `connector` tag. Manual edits win: if a
  day already has `source: 'manual'`, the connector never overwrites it silently — the
  UI shows a conflict badge and the user picks. Deterministic upsert keys (the date)
  make re-syncs idempotent, same as demo data.
- **Offline-first preserved**: connectors are an enhancement, never a dependency.
  Signed-out / unapproved / rate-limited users keep today's manual + Excel + scanner
  paths byte-for-byte. Sync is pull-on-demand ("Sync now" button + optional daily pull),
  not a live stream.

### Phased rollout (order = least-gated first, each phase independently shippable)

1. **Phase A — Square connector** (~2–3 days once Backend Phase 2 exists). Self-serve,
   free, sandboxed, best docs. Proves the whole chain: OAuth in Edge Function, token
   table, normalize Orders → dayRecord (pickup/in-store revenue), conflict badges,
   Connections UI (new section in Sheets tab or Settings). Get this fully working
   before touching any gated provider.
2. **Phase B — DoorDash Reporting API** (~2 days + approval wait). Owner submits the
   merchant-developer request form (free). Connector maps Financials reports →
   `platforms.doordash` daily revenue. Build only after approval email lands.
3. **Phase C — Uber Eats Reporting** (timeline unknown — agreement-gated). Apply via
   developer portal; if a business agreement is offered, map transaction reports →
   `platforms.ubereats`. If stalled, fall back to Phase D for Uber too.
4. **Phase D — CSV statement importers (no API, works today)**. Grubhub (and any stalled
   platform) via merchant-portal CSV export → extend `importFromXlsx` with per-platform
   column mappings. Zero approval, zero backend — can even ship BEFORE Phase A as a
   quick win. Tag records `source: 'imported'`, `connector: 'grubhub-csv'`.
5. **Phase E — Toast/Clover POS connectors (on demand)**. Only if the restaurant
   actually runs Toast or Clover; same connector contract as Square. Toast needs the
   RMS subscription box ticked; Clover is self-serve.

### Risks / notes
- **Approval risk is the schedule risk**: DoorDash review and Uber agreement timelines
  are outside our control. That's why Square (ungated) proves the architecture and
  Phase D (CSV) guarantees every platform has *a* path regardless of approvals.
- **API terms drift**: delivery platforms revise access programs without notice (same
  lesson as Gemini free-tier limits). The Edge Function boundary means a provider change
  never touches the client; worst case a connector degrades to the CSV path.
- **Rate limits**: reporting endpoints are low-volume (one restaurant, daily pulls) —
  orders of magnitude below any published cap. Still: exponential backoff + surface
  `tt:storage-error`-style toast on repeated failure.
- **New i18n surface**: Connections UI ≈ 15–20 keys × 3 locales (connect/disconnect,
  sync status, conflict dialog, per-provider names stay untranslated).
- **`source` enum widens** to `'manual' | 'imported' | 'demo' | 'api'` — audit every
  switch on `source` (badges, importer, demo replace logic) when Phase A lands.

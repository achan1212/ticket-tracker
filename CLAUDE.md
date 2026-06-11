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

# Ticket Tracker — Feature Roadmap

A working list of restaurant back-of-house features that build naturally on the
data the app already collects (sales, platform reports, scanned items, food
cost imports).

**Tier 1 is in active development** — see commits tagged with the feature
number for status. Tiers 2–4 are documented here as the next horizons.

---

## Tier 2 — mid-effort, high adoption for a one-person operator

### 8. Recipe costing (BOM)
Define menu items as a list of `{ ingredient × portion size × waste % }`. Pull
ingredient unit costs from the food-cost importer (Tier 1 #1). Output per
menu item: theoretical food cost, plate cost, recommended sell price for a
target food cost %.

Single biggest leverage feature in any BOH tool — every downstream variance
analysis depends on it.

### 9. Theoretical vs actual variance
Once #3 (item-level sales) and #8 (recipe costs) both exist:
- Theoretical food cost = Σ(item sold × recipe cost)
- Actual food cost = Σ(receipts in the period)
- Variance = Actual − Theoretical

Variance > 3 % usually means waste, theft, over-portioning, or a costing
error. This single metric typically uncovers 3–5 % of revenue in savings for
restaurants that don't already track it.

### 10. Vendor directory
Auto-populate from food-cost imports (filename → vendor heuristic, or first
header row of supplier invoices). Per-vendor view:
- Total spend over time
- SKU price drift (catch a 12 % beef increase before it hits margin)
- Average lead time (if user enters order/receive dates)

### 11. Waste log
Minimal entry form: date, item, qty, reason (spoilage, comp, drop, employee
meal). Third source of food-cost truth and feeds variance reporting.

### 12. Labor cost %
Start simple — no time clock. User enters scheduled hours × hourly rate per
day. Then `labor cost ÷ revenue` overlays on Dashboard. Tip pooling/payroll
prep deferred to Tier 3.

### 13. Cash reconciliation
Daily: declared cash deposits vs cash sales reported in POS scans. Running
over/short tally. Catches the most common skim pattern.

### 14. Sales tax summary
Per-period taxable revenue and tax collected, formatted for state filings.
Computable from existing sales data plus a tax-rate setting.

---

## Tier 3 — bigger features, only if the operation grows

### 15. Inventory tracking with par levels
Ingredient-level counts, weekly counts, low-stock alerts. Pairs with #8 to
enable usage-based ordering. Heavy lift for a single operator — only worth
building when there's a second person counting.

### 16. Time clock + scheduling
Full labor management with shift drag/drop, clock-in/out, hour totals,
overtime warnings. Realistic only at 5+ employees.

### 17. POS integration
Direct sync with Square / Toast / Clover replaces the OCR scanner entirely.
Best ROI of any feature if the POS exposes a free read-API; otherwise
expensive to maintain across vendor API churn.

### 18. Daily checklists / SOPs
Open/close lists, prep sheets, temperature logs, signed off by staff on
mobile. Real value only with staff doing them — not for solo operators.

### 19. Multi-location
Segregate every metric by location, add a location-level breakdown and
cross-location benchmarking view. Only build when there's actually a
second location.

---

## Tier 4 — nice-to-haves

### 20. Tip pooling / distribution calculator
Divides a tip pool by hours worked or sales contribution, exports per-staff
breakdown.

### 21. Reservations / cover-count tracking
Only useful if reservations are taken and comparing cover trends to revenue
matters. Most takeout/delivery shops can skip.

### 22. HACCP / health-inspection log
Temperature checks, cleaning schedules, signed-off by staff. Mostly required
where regulators audit; offer as a compliance add-on.

### 23. Loyalty / promo analysis
If discounts/promos are run, measure redemption impact on revenue and
margin. Requires promo codes in the sales data.

---

## Notes on sequencing

- Tier 2 → start with **#8 (recipe costing)**; it unblocks #9 entirely and
  meaningfully improves #4 (menu engineering) from Tier 1.
- Variance reporting (#9) is the highest-impact analytical feature once #8
  exists.
- Vendor directory (#10) is largely "free" — falls out of structured food
  cost imports with one new field.

## Notes on architecture

- Persistence in Tier 1 lands as a generic `useLocalStore(namespace, schema)`
  hook so new Tier 2/3 features can opt in without rewiring.
- Recipe costing (#8) introduces the first link between two stores
  (menu items ↔ ingredients ↔ food cost imports). Plan for that join via
  a small relational layer (likely just normalized IDs in localStorage).
- POS integration (#17) probably becomes its own importer module mirroring
  the platform-report importer's plug-in shape (one parser per POS).

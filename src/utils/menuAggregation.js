// Roll up the categories field across every day + month entry into a flat
// list of menu items with usage stats. The categories field is keyed by
// item name (e.g. "Sliders") with the corresponding revenue contribution
// as the value — both manual entries in the Daily/Monthly Summary forms
// and scanner pushes contribute to it.

export function aggregateMenuItems({ days = {}, months = {}, dailySummary = [] }) {
  const byName = new Map();

  const touch = (name, amount, periodKey, periodType) => {
    if (!name || !Number.isFinite(amount)) return;
    const key = name.trim();
    if (!key) return;
    let row = byName.get(key);
    if (!row) {
      row = {
        name: key,
        totalRevenue: 0,
        occurrences: 0,
        firstSeen: periodKey,
        lastSeen: periodKey,
        bestPeriod: { periodKey, amount: -Infinity, periodType },
        perPeriod: [],
      };
      byName.set(key, row);
    }
    row.totalRevenue += amount;
    row.occurrences += 1;
    row.perPeriod.push({ periodKey, amount, periodType });
    if (periodKey < row.firstSeen) row.firstSeen = periodKey;
    if (periodKey > row.lastSeen)  row.lastSeen = periodKey;
    if (amount > row.bestPeriod.amount) row.bestPeriod = { periodKey, amount, periodType };
  };

  // Pull from raw days (categories are user-entered + scanner-pushed).
  for (const date of Object.keys(days)) {
    const cats = days[date]?.categories;
    if (!cats || typeof cats !== 'object') continue;
    for (const [name, amount] of Object.entries(cats)) touch(name, amount, date, 'day');
  }

  // Pull from manual monthly entries.
  for (const monthKey of Object.keys(months)) {
    const cats = months[monthKey]?.categories;
    if (!cats || typeof cats !== 'object') continue;
    for (const [name, amount] of Object.entries(cats)) touch(name, amount, monthKey, 'month');
  }

  // Round + derive averages.
  const list = [];
  for (const row of byName.values()) {
    const totalRevenue = Math.round(row.totalRevenue * 100) / 100;
    const avgPerOccurrence = row.occurrences > 0
      ? Math.round((row.totalRevenue / row.occurrences) * 100) / 100
      : 0;
    list.push({
      ...row,
      totalRevenue,
      avgPerOccurrence,
    });
  }
  return list;
}

// Compute the total food cost % for everything aggregated so the analytics
// view can show how each item compares against the global rate. Re-uses the
// foodCostByDay map already exposed by useFoodCostStore.
export function totalRevenueAcrossPeriods({ days = {}, months = {} }) {
  let total = 0;
  for (const d of Object.values(days)) {
    total += (d.deliveryRevenue || 0) + (d.pickupRevenue || 0);
  }
  for (const m of Object.values(months)) {
    total += (m.deliveryRevenue || 0) + (m.pickupRevenue || 0);
  }
  return total;
}

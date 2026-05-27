// Shared helpers + constants for the Dashboard tab.

// Dark-mode platform colors. Light-mode overrides happen per-render in the
// caller (Dashboard pulls a theme-aware `C` object out of useTheme).
export const PLATFORM_COLORS = {
  doordash: '#FF3008',
  ubereats: '#06C167',
  grubhub:  '#F63440',
  direct:   '#e8ff47',
};

export const PLATFORM_LABELS = {
  doordash: 'DoorDash',
  ubereats: 'Uber Eats',
  grubhub:  'Grubhub',
  direct:   'Direct',
  other:    'Other',
};

// Fast-casual food-cost health bands. Receives theme-aware colors.
export function foodCostPctColor(pct, C) {
  if (!Number.isFinite(pct) || pct <= 0) return 'var(--text-muted)';
  if (pct <= 32) return C.delivery;   // healthy (≤32%)
  if (pct <= 38) return C.accent;     // elevated (32–38%)
  return '#ef4444';                   // concerning (>38%)
}

export function todayISO() { return new Date().toISOString().slice(0, 10); }

export function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function yearsAgoISO(n) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
}

export function startOfYearISO(year) { return `${year}-01-01`; }
export function endOfYearISO(year)   { return `${year}-12-31`; }

// Format date label based on range span.
export function fmtLabel(iso, spanDays) {
  const [year, month, day] = iso.split('-');
  if (spanDays > 365) return `${month}/${year.slice(2)}`;            // MM/YY for multi-year
  if (spanDays > 90)  return `${month}/${day}/${year.slice(2)}`;     // MM/DD/YY for 90d+
  return `${month}/${day}`;                                          // MM/DD default
}

// Shift a date back by comparison period (WoW = 7 days, MoM = 1 month, YoY = 1 year).
export function shiftDate(isoDate, mode) {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (mode === 'wow') {
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 7);
    return dt.toISOString().slice(0, 10);
  }
  if (mode === 'mom') {
    const dt = new Date(y, m - 1, d);
    dt.setMonth(dt.getMonth() - 1);
    return dt.toISOString().slice(0, 10);
  }
  if (mode === 'yoy') {
    return `${y - 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

// Look up revenue for any date from either store. Returns null (not 0) when no
// record exists so Recharts renders a gap rather than a zero-point.
export function getRevenueForDate(dateStr, days, months) {
  if (days[dateStr]) {
    const rec = days[dateStr];
    const breakdown = (rec.deliveryRevenue || 0) + (rec.pickupRevenue || 0);
    return (rec.totalRevenue || 0) > 0 ? rec.totalRevenue : breakdown;
  }
  const monthKey = dateStr.slice(0, 7);
  if (months[monthKey]) {
    const m = months[monthKey];
    return (m.deliveryRevenue || 0) + (m.pickupRevenue || 0);
  }
  return null;
}

// For long ranges, aggregate by month to keep the chart readable.
export function aggregateData(data, spanDays) {
  if (spanDays <= 90 || data.length <= 60) return data; // daily is fine

  const byMonth = {};
  data.forEach(d => {
    const key = d.fullDate.slice(0, 7); // YYYY-MM
    if (!byMonth[key]) byMonth[key] = { date: key + '-01', fullDate: key, revenue: 0, delivery: 0, pickup: 0, foodCost: 0, prevRevenue: 0, prevFoodCost: 0, orders: 0, avgSum: 0, count: 0 };
    byMonth[key].revenue      += d.revenue;
    byMonth[key].delivery     += d.delivery;
    byMonth[key].pickup       += d.pickup;
    byMonth[key].foodCost     += d.foodCost || 0;
    byMonth[key].prevRevenue  += d.prevRevenue  || 0;
    byMonth[key].prevFoodCost += d.prevFoodCost || 0;
    byMonth[key].orders       += d.orders;
    byMonth[key].avgSum       += d.avg * d.orders;
    byMonth[key].count        += d.orders;
  });
  return Object.values(byMonth)
    .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
    .map(m => ({
      ...m,
      date: new Date(m.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      avg: m.count > 0 ? parseFloat((m.avgSum / m.count).toFixed(2)) : 0,
      revenue:      parseFloat(m.revenue.toFixed(2)),
      delivery:     parseFloat(m.delivery.toFixed(2)),
      pickup:       parseFloat(m.pickup.toFixed(2)),
      foodCost:     parseFloat(m.foodCost.toFixed(2)),
      prevRevenue:  parseFloat(m.prevRevenue.toFixed(2)),
      prevFoodCost: parseFloat(m.prevFoodCost.toFixed(2)),
    }));
}

// Quick preset definitions. Functions so "today" is evaluated at click time,
// not at module load.
const currentYear = new Date().getFullYear();
export const PRESETS = [
  { label: '7d',   from: () => daysAgoISO(7),                   to: () => todayISO() },
  { label: '14d',  from: () => daysAgoISO(14),                  to: () => todayISO() },
  { label: '30d',  from: () => daysAgoISO(30),                  to: () => todayISO() },
  { label: '90d',  from: () => daysAgoISO(90),                  to: () => todayISO() },
  { label: '1yr',  from: () => yearsAgoISO(1),                  to: () => todayISO() },
  { label: '2yr',  from: () => yearsAgoISO(2),                  to: () => todayISO() },
  { label: `${currentYear}`,     from: () => startOfYearISO(currentYear),     to: () => endOfYearISO(currentYear) },
  { label: `${currentYear - 1}`, from: () => startOfYearISO(currentYear - 1), to: () => endOfYearISO(currentYear - 1) },
  { label: `${currentYear - 2}`, from: () => startOfYearISO(currentYear - 2), to: () => endOfYearISO(currentYear - 2) },
];

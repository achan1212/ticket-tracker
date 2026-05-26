import { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { useLang } from '../../i18n/LangContext.jsx';
import { useTheme } from '../../hooks/useTheme.js';
import { useLocalStore } from '@hooks/useLocalStore.js';
import './Dashboard.css';

// Dark-mode defaults (overridden per-render for light theme)
const PLATFORM_COLORS = { doordash: '#FF3008', ubereats: '#06C167', grubhub: '#F63440', direct: '#e8ff47' };
const PLATFORM_LABELS = { doordash: 'DoorDash', ubereats: 'Uber Eats', grubhub: 'Grubhub', direct: 'Direct', other: 'Other' };

// Fast-casual food-cost health bands. Receives theme-aware colors.
function foodCostPctColor(pct, C) {
  if (!Number.isFinite(pct) || pct <= 0) return 'var(--text-muted)';
  if (pct <= 32) return C.delivery;   // healthy (≤32%)
  if (pct <= 38) return C.accent;     // elevated (32–38%)
  return '#ef4444';                   // concerning (>38%)
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function yearsAgoISO(n) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
}
function startOfYearISO(year) { return `${year}-01-01`; }
function endOfYearISO(year)   { return `${year}-12-31`; }

// Format date label based on range span
function fmtLabel(iso, spanDays) {
  const [year, month, day] = iso.split('-');
  if (spanDays > 365) return `${month}/${year.slice(2)}`; // MM/YY for multi-year
  if (spanDays > 90)  return `${month}/${day}/${year.slice(2)}`; // MM/DD/YY for 90d+
  return `${month}/${day}`; // MM/DD default
}

// Shift a date back by comparison period (WoW = 7 days, MoM = 1 month, YoY = 1 year)
function shiftDate(isoDate, mode) {
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

// Look up revenue for any date from either store. Returns null (not 0) when
// no record exists so Recharts renders a gap rather than a zero-point.
function getRevenueForDate(dateStr, days, months) {
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

// For long ranges, aggregate by week or month to keep chart readable
function aggregateData(data, spanDays) {
  if (spanDays <= 90 || data.length <= 60) return data; // daily is fine

  // Monthly aggregation for > 90 days
  const byMonth = {};
  data.forEach(d => {
    const key = d.fullDate.slice(0, 7); // YYYY-MM
    if (!byMonth[key]) byMonth[key] = { date: key + '-01', fullDate: key, revenue: 0, delivery: 0, pickup: 0, foodCost: 0, prevRevenue: 0, prevFoodCost: 0, orders: 0, avgSum: 0, count: 0 };
    byMonth[key].revenue  += d.revenue;
    byMonth[key].delivery += d.delivery;
    byMonth[key].pickup   += d.pickup;
    byMonth[key].foodCost += d.foodCost || 0;
    byMonth[key].prevRevenue += d.prevRevenue || 0;
    byMonth[key].prevFoodCost += d.prevFoodCost || 0;
    byMonth[key].orders   += d.orders;
    byMonth[key].avgSum   += d.avg * d.orders;
    byMonth[key].count    += d.orders;
  });
  return Object.values(byMonth)
    .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
    .map(m => ({
      ...m,
      date: new Date(m.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      avg: m.count > 0 ? parseFloat((m.avgSum / m.count).toFixed(2)) : 0,
      revenue: parseFloat(m.revenue.toFixed(2)),
      delivery: parseFloat(m.delivery.toFixed(2)),
      pickup: parseFloat(m.pickup.toFixed(2)),
      foodCost: parseFloat(m.foodCost.toFixed(2)),
      prevRevenue: parseFloat(m.prevRevenue.toFixed(2)),
      prevFoodCost: parseFloat(m.prevFoodCost.toFixed(2)),
    }));
}

// Quick preset definitions
const currentYear = new Date().getFullYear();
const PRESETS = [
  { label: '7d',   from: () => daysAgoISO(7),              to: () => todayISO() },
  { label: '14d',  from: () => daysAgoISO(14),             to: () => todayISO() },
  { label: '30d',  from: () => daysAgoISO(30),             to: () => todayISO() },
  { label: '90d',  from: () => daysAgoISO(90),             to: () => todayISO() },
  { label: '1yr',  from: () => yearsAgoISO(1),             to: () => todayISO() },
  { label: '2yr',  from: () => yearsAgoISO(2),             to: () => todayISO() },
  { label: `${currentYear}`,     from: () => startOfYearISO(currentYear),     to: () => endOfYearISO(currentYear) },
  { label: `${currentYear - 1}`, from: () => startOfYearISO(currentYear - 1), to: () => endOfYearISO(currentYear - 1) },
  { label: `${currentYear - 2}`, from: () => startOfYearISO(currentYear - 2), to: () => endOfYearISO(currentYear - 2) },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="ct-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="ct-row" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span>{p.dataKey === 'orders' ? p.value : formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export default function Dashboard({ dailySummary, days, months, foodCostByDay = {}, foodCostByMonth = {}, laborByMonth = {}, fixedByMonth = {} }) {
  const { t, formatCurrency } = useLang();
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  // Same pl-targets the Profit & Loss view writes to — keeps the Dashboard's
  // labor/overhead/other estimates in sync with the P&L tab.
  const [plTargets] = useLocalStore('pl-targets', {
    version: 1,
    initial: { laborPct: 30, overheadPct: 16, otherPct: 5 },
  });

  // Theme-aware chart colors. Light mode needs higher-contrast alternatives
  // because the dark-mode neon yellow (#e8ff47) is illegible on white.
  const C = {
    accent:   isDark ? '#e8ff47' : '#5a8a17',
    delivery: isDark ? '#06C167' : '#059669',
    pickup:   isDark ? '#3b82f6' : '#2563eb',
    foodCost: isDark ? '#f97316' : '#c2410c',
    grid:     isDark ? '#2a2a2a' : '#e5e7eb',
    tick:     isDark ? '#666'    : '#555',
  };

  const [fromDate, setFromDate] = useState(daysAgoISO(30));
  const [toDate, setToDate] = useState(todayISO());
  const [activePreset, setActivePreset] = useState('30d');
  const [comparisonMode, setComparisonMode] = useState('none');

  const applyPreset = (preset) => {
    setFromDate(preset.from());
    setToDate(preset.to());
    setActivePreset(preset.label);
  };

  const handleFromChange = (val) => {
    setFromDate(val);
    setActivePreset('custom');
  };

  const handleToChange = (val) => {
    setToDate(val);
    setActivePreset('custom');
  };

  const spanDays = useMemo(() => {
    // Inclusive day count: 2025-01-01 → 2025-12-31 should read 365, not 364.
    const diff = new Date(toDate) - new Date(fromDate);
    return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
  }, [fromDate, toDate]);

  // Filter + sort daily data, then append manual monthly entries for months
  // that have no daily records (prevents double-counting).
  const rawChartData = useMemo(() => {
    const dailyPoints = [...dailySummary]
      .filter(d => d.date >= fromDate && d.date <= toDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => {
        const point = {
          date:     fmtLabel(d.date, spanDays),
          fullDate: d.date,
          revenue:  parseFloat(d.revenue.toFixed(2)),
          delivery: parseFloat(d.deliveryRevenue.toFixed(2)),
          pickup:   parseFloat(d.pickupRevenue.toFixed(2)),
          foodCost: parseFloat(((foodCostByDay[d.date] ?? days[d.date]?.foodCost ?? 0)).toFixed(2)),
          orders:   d.orderCount,
          avg:      parseFloat(d.avgOrderValue.toFixed(2)),
        };
        if (comparisonMode !== 'none') {
          const shifted = shiftDate(d.date, comparisonMode);
          point.prevRevenue = shifted ? getRevenueForDate(shifted, days, months) : undefined;
          point.prevFoodCost = shifted ? (foodCostByDay[shifted] ?? null) : undefined;
        }
        return point;
      });

    const dailyMonthKeys = new Set(dailySummary.map(d => d.date.slice(0, 7)));

    const monthlyPoints = Object.values(months)
      .filter(m => !dailyMonthKeys.has(m.month))
      .filter(m => m.month <= toDate.slice(0, 7) && m.month >= fromDate.slice(0, 7))
      .map(m => {
        const revenue    = (m.deliveryRevenue || 0) + (m.pickupRevenue || 0);
        const orderCount = (m.deliveryOrders  || 0) + (m.pickupOrders  || 0);
        const fullDate   = m.month + '-01';
        const point = {
          date:     fmtLabel(fullDate, spanDays),
          fullDate,
          revenue:  parseFloat(revenue.toFixed(2)),
          delivery: parseFloat((m.deliveryRevenue || 0).toFixed(2)),
          pickup:   parseFloat((m.pickupRevenue   || 0).toFixed(2)),
          foodCost: parseFloat(((foodCostByMonth[m.month]) || 0).toFixed(2)),
          orders:   orderCount,
          avg:      orderCount > 0 ? parseFloat((revenue / orderCount).toFixed(2)) : 0,
        };
        if (comparisonMode !== 'none') {
          const shifted = shiftDate(fullDate, comparisonMode);
          point.prevRevenue = shifted ? getRevenueForDate(shifted, days, months) : undefined;
          point.prevFoodCost = shifted ? (foodCostByMonth[shifted.slice(0, 7)] ?? null) : undefined;
        }
        return point;
      });

    return [...dailyPoints, ...monthlyPoints].sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  }, [dailySummary, months, fromDate, toDate, spanDays, foodCostByDay, foodCostByMonth, comparisonMode, days]);

  const chartData = useMemo(() => aggregateData(rawChartData, spanDays), [rawChartData, spanDays]);
  const isAggregated = chartData.length < rawChartData.length;

  // Period-level food cost spend. Summed from the source map (not chart points)
  // so imports on dates without sales records still count toward gross profit.
  // Days without a live foodCostByDay entry fall back to the day record's
  // foodCost field — populated by Sheets imports so restored data still
  // contributes to gross profit math.
  const foodCostTotal = useMemo(() => {
    let total = 0;
    const counted = new Set();
    for (const [date, amt] of Object.entries(foodCostByDay)) {
      if (date >= fromDate && date <= toDate) {
        total += amt;
        counted.add(date);
      }
    }
    for (const [date, day] of Object.entries(days)) {
      if (counted.has(date)) continue;
      if (date < fromDate || date > toDate) continue;
      total += day.foodCost || 0;
    }
    return total;
  }, [foodCostByDay, days, fromDate, toDate]);

  // Operating-costs actuals are stored per month. Sum any month that overlaps
  // the active date range — pragmatic; partial-month overlaps still count the
  // full month's actual.
  const fromMonth = fromDate.slice(0, 7);
  const toMonth   = toDate.slice(0, 7);
  const laborActualTotal = useMemo(() => {
    let total = 0;
    for (const [m, amt] of Object.entries(laborByMonth)) {
      if (m >= fromMonth && m <= toMonth) total += (amt || 0);
    }
    return total;
  }, [laborByMonth, fromMonth, toMonth]);
  const fixedActualTotal = useMemo(() => {
    let total = 0;
    for (const [m, amt] of Object.entries(fixedByMonth)) {
      if (m >= fromMonth && m <= toMonth) total += (amt || 0);
    }
    return total;
  }, [fixedByMonth, fromMonth, toMonth]);

  const totals = useMemo(() => {
    const revenue     = rawChartData.reduce((s, d) => s + d.revenue, 0);
    const deliveryRev = rawChartData.reduce((s, d) => s + d.delivery, 0);
    const pickupRev   = rawChartData.reduce((s, d) => s + d.pickup, 0);
    const orderCount  = rawChartData.reduce((s, d) => s + d.orders, 0);
    const avg = orderCount > 0 ? revenue / orderCount : 0;
    const bestDay = rawChartData.reduce((best, d) => (!best || d.revenue > best.revenue) ? d : best, null);
    const foodCost = foodCostTotal;
    const foodCostPct = revenue > 0 ? (foodCost / revenue) * 100 : 0;
    const grossProfit = revenue - foodCost;
    const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const laborCost    = laborActualTotal > 0 ? laborActualTotal : revenue * (plTargets.laborPct    / 100);
    const overheadCost = fixedActualTotal > 0 ? fixedActualTotal : revenue * (plTargets.overheadPct / 100);
    const otherCost    = revenue * (plTargets.otherPct / 100);
    const netIncome    = grossProfit - laborCost - overheadCost - otherCost;
    const netMarginPct = revenue > 0 ? (netIncome / revenue) * 100 : 0;
    return {
      revenue, deliveryRev, pickupRev, orderCount, avg, bestDay,
      foodCost, foodCostPct, grossProfit, grossMarginPct,
      laborCost, overheadCost, otherCost, netIncome, netMarginPct,
      laborIsActual:    laborActualTotal > 0,
      overheadIsActual: fixedActualTotal > 0,
    };
  }, [rawChartData, foodCostTotal, plTargets, laborActualTotal, fixedActualTotal]);

  const hasFoodCost = totals.foodCost > 0;

  const platformData = useMemo(() => {
    const byPlatform = {};

    const addPlatforms = (d) => {
      [
        { key: 'doordash', revenue: d.doordash || 0, count: d.doordashOrders || 0 },
        { key: 'ubereats',  revenue: d.ubereats  || 0, count: d.ubereatsOrders  || 0 },
        { key: 'grubhub',  revenue: d.grubhub   || 0, count: d.grubhubOrders   || 0 },
      ].forEach(({ key, revenue, count }) => {
        if (revenue > 0 || count > 0) {
          if (!byPlatform[key]) byPlatform[key] = { name: key, revenue: 0, count: 0 };
          byPlatform[key].revenue += revenue;
          byPlatform[key].count  += count;
        }
      });
    };

    // Daily records
    Object.values(days)
      .filter(d => d.date >= fromDate && d.date <= toDate)
      .forEach(addPlatforms);

    // Manual monthly entries for months without daily records
    const dailyMonthKeys = new Set(Object.keys(days).map(d => d.slice(0, 7)));
    Object.values(months)
      .filter(m => !dailyMonthKeys.has(m.month))
      .filter(m => m.month <= toDate.slice(0, 7) && m.month >= fromDate.slice(0, 7))
      .forEach(addPlatforms);

    return Object.values(byPlatform).sort((a, b) => b.revenue - a.revenue);
  }, [days, months, fromDate, toDate]);

  const noData = rawChartData.length === 0;

  const rangeLabel = useMemo(() => {
    if (activePreset !== 'custom') return null;
    return `${fromDate} → ${toDate}`;
  }, [activePreset, fromDate, toDate]);

  return (
    <div className="dashboard">
      <h2 className="page-title">{t.tabDashboard}</h2>

      {/* ── DATE RANGE SELECTOR ── */}
      <div className="dash-range-card">
        <div className="dash-range-top">
          <span className="dash-range-label">{t.dashDateRange}</span>
          {rangeLabel && <span className="dash-range-custom-label">{t.dashCustom} {rangeLabel}</span>}
        </div>

        <div className="dash-range-pills">
          {PRESETS.map(p => (
            <button key={p.label}
              className={`range-pill ${activePreset === p.label ? 'active' : ''}`}
              onClick={() => applyPreset(p)}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="dash-custom-range">
          <div className="dash-date-field">
            <label className="target-label">{t.dashFrom}</label>
            <input type="date" className="form-input date-input"
              value={fromDate} max={toDate}
              onChange={(e) => handleFromChange(e.target.value)}
              onClick={e => e.currentTarget.showPicker?.()} />
          </div>
          <span className="dash-date-sep">→</span>
          <div className="dash-date-field">
            <label className="target-label">{t.dashTo}</label>
            <input type="date" className="form-input date-input"
              value={toDate} min={fromDate} max={todayISO()}
              onChange={(e) => handleToChange(e.target.value)}
              onClick={e => e.currentTarget.showPicker?.()} />
          </div>
          <div className="dash-span-info">
            <span className="dash-span-value">{spanDays}</span>
            <span className="dash-span-unit">{t.daysPlural}</span>
          </div>
        </div>
      </div>

      {/* COMPARISON SELECTOR */}
      <div className="db-compare-row">
        <span className="db-compare-label">{t.compareLabel || 'Compare:'}</span>
        {[
          { key: 'none', label: t.compareNone || 'None' },
          { key: 'wow',  label: t.compareWow || 'WoW' },
          { key: 'mom',  label: t.compareMom || 'MoM' },
          { key: 'yoy',  label: t.compareYoy || 'YoY' },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`filter-pill ${comparisonMode === key ? 'active' : ''}`}
            onClick={() => setComparisonMode(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {noData ? (
        <div className="ca-empty">{t.dashNoData}</div>
      ) : (
        <>
          {isAggregated && (
            <div className="dash-agg-notice">{t.dashMonthlyAgg}</div>
          )}

          {/* SUMMARY CARDS */}
          <div className="dash-cards">
            <div className="dash-card">
              <p className="dash-card-label">{t.totalRevenue}</p>
              <p className="dash-card-value">{formatCurrency(totals.revenue)}</p>
              <p className="dash-card-sub">{spanDays} {t.dashDayRange}</p>
            </div>
            <div className="dash-card">
              <p className="dash-card-label">{t.labelOrders}</p>
              <p className="dash-card-value">{totals.orderCount}</p>
              <p className="dash-card-sub">{spanDays} {t.dashDayRange}</p>
            </div>
            <div className="dash-card">
              <p className="dash-card-label">{t.dashAvgOrderValue}</p>
              <p className="dash-card-value">{formatCurrency(totals.avg)}</p>
              <p className="dash-card-sub">{t.dashPerOrder}</p>
            </div>
            <div className="dash-card highlight">
              <p className="dash-card-label">{t.dashDeliveryRev}</p>
              <p className="dash-card-value" style={{ color: C.delivery }}>{formatCurrency(totals.deliveryRev)}</p>
              <p className="dash-card-sub">{totals.revenue > 0 ? ((totals.deliveryRev / totals.revenue) * 100).toFixed(1) : 0}{t.dashOfTotal}</p>
            </div>
            <div className="dash-card highlight">
              <p className="dash-card-label">{t.dashPickupRev}</p>
              <p className="dash-card-value" style={{ color: C.pickup }}>{formatCurrency(totals.pickupRev)}</p>
              <p className="dash-card-sub">{totals.revenue > 0 ? ((totals.pickupRev / totals.revenue) * 100).toFixed(1) : 0}{t.dashOfTotal}</p>
            </div>
            {totals.bestDay && (
              <div className="dash-card">
                <p className="dash-card-label">{t.dashBestDay}</p>
                <p className="dash-card-value">{formatCurrency(totals.bestDay.revenue)}</p>
                <p className="dash-card-sub">{totals.bestDay.fullDate}</p>
              </div>
            )}
            {hasFoodCost && (
              <>
                <div className="dash-card">
                  <p className="dash-card-label">{t.dashFoodCost || 'Food Cost'}</p>
                  <p className="dash-card-value" style={{ color: C.foodCost }}>−{formatCurrency(totals.foodCost)}</p>
                  <p className="dash-card-sub">{totals.foodCostPct.toFixed(1)}{t.dashOfTotal}</p>
                </div>
                <div className="dash-card">
                  <p className="dash-card-label">{t.dashFoodCostPct || 'Food Cost %'}</p>
                  <p className="dash-card-value" style={{ color: foodCostPctColor(totals.foodCostPct, C) }}>
                    {totals.foodCostPct.toFixed(1)}%
                  </p>
                  <p className="dash-card-sub">{t.dashFoodCostTarget || 'Target 25–32%'}</p>
                </div>
              </>
            )}
            {totals.revenue > 0 && (
              <>
                <div className="dash-card">
                  <p className="dash-card-label">
                    {t.plLabor || 'Labor'}
                    {totals.laborIsActual && <span className="dash-actual-badge">{t.plActual || 'actual'}</span>}
                  </p>
                  <p className="dash-card-value" style={{ color: C.foodCost }}>−{formatCurrency(totals.laborCost)}</p>
                  <p className="dash-card-sub">
                    {totals.revenue > 0 ? ((totals.laborCost / totals.revenue) * 100).toFixed(1) : 0}{t.dashOfTotal}
                  </p>
                </div>
                <div className="dash-card">
                  <p className="dash-card-label">
                    {t.plOverhead || 'Overhead'}
                    {totals.overheadIsActual && <span className="dash-actual-badge">{t.plActual || 'actual'}</span>}
                  </p>
                  <p className="dash-card-value" style={{ color: C.foodCost }}>−{formatCurrency(totals.overheadCost)}</p>
                  <p className="dash-card-sub">
                    {totals.revenue > 0 ? ((totals.overheadCost / totals.revenue) * 100).toFixed(1) : 0}{t.dashOfTotal}
                  </p>
                </div>
                <div className="dash-card">
                  <p className="dash-card-label">{t.plOther || 'Other'}</p>
                  <p className="dash-card-value" style={{ color: C.foodCost }}>−{formatCurrency(totals.otherCost)}</p>
                  <p className="dash-card-sub">{plTargets.otherPct}{t.dashOfTotal}</p>
                </div>
                <div className="dash-card highlight">
                  <p className="dash-card-label">{t.plNetIncome || 'Net Operating Income'}</p>
                  <p
                    className="dash-card-value"
                    style={{ color: totals.netIncome >= 0 ? C.delivery : '#ef4444' }}
                  >
                    {totals.netIncome < 0 ? '−' : ''}{formatCurrency(Math.abs(totals.netIncome))}
                  </p>
                  <p className="dash-card-sub">{totals.netMarginPct.toFixed(1)}% {t.dashMarginSuffix || 'margin'}</p>
                </div>
              </>
            )}
          </div>

          {/* REVENUE OVER TIME */}
          <div className="chart-card">
            <h4 className="chart-title">{t.dashRevenueOverTime}</h4>
            <p className="chart-sub">{t.dashDeliveryVsPickupLabel} {isAggregated ? t.dashMonthly : t.dashDaily} {t.dashBreakdownSuffix}</p>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gDelivery" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.delivery} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={C.delivery} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gPickup" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.pickup} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={C.pickup} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                <XAxis dataKey="date" tick={{ fill: C.tick, fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={v => `$${v}`} tick={{ fill: C.tick, fontSize: 11 }} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#888' }} />
                <Area type="monotone" dataKey="delivery" name={t.chartDelivery} stroke={C.delivery} fill="url(#gDelivery)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="pickup" name={t.chartPickup} stroke={C.pickup} fill="url(#gPickup)" strokeWidth={2} dot={false} />
                {comparisonMode !== 'none' && (
                  <Line
                    type="monotone"
                    dataKey="prevRevenue"
                    name={t.comparePriorPeriod || 'Prior Period'}
                    stroke={C.delivery}
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    strokeOpacity={0.55}
                    dot={false}
                    connectNulls={false}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* REVENUE VS FOOD COST */}
          {hasFoodCost && (
            <div className="chart-card">
              <h4 className="chart-title">{t.dashFoodCostVsRev || 'Revenue vs Food Cost'}</h4>
              <p className="chart-sub">{t.dashFoodCostVsRevSub || 'Gap between the lines is gross profit'}</p>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.accent} stopOpacity={0.35}/>
                      <stop offset="95%" stopColor={C.accent} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gFoodCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.foodCost} stopOpacity={0.45}/>
                      <stop offset="95%" stopColor={C.foodCost} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="date" tick={{ fill: C.tick, fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tickFormatter={v => `$${v}`} tick={{ fill: C.tick, fontSize: 11 }} width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#888' }} />
                  <Area type="monotone" dataKey="revenue" name={t.totalRevenue} stroke={C.accent} fill="url(#gRevenue)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="foodCost" name={t.chartFoodCost || 'Food Cost'} stroke={C.foodCost} fill="url(#gFoodCost)" strokeWidth={2} dot={false} />
                  {comparisonMode !== 'none' && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="prevRevenue"
                        name={t.comparePriorPeriod || 'Prior Period'}
                        stroke={C.accent}
                        strokeWidth={1.5}
                        strokeDasharray="5 3"
                        strokeOpacity={0.5}
                        dot={false}
                        connectNulls={false}
                      />
                      {hasFoodCost && (
                        <Line
                          type="monotone"
                          dataKey="prevFoodCost"
                          name={t.compareFoodCostPrior || 'Prior Food Cost'}
                          stroke={C.foodCost}
                          strokeWidth={1.5}
                          strokeDasharray="5 3"
                          strokeOpacity={0.5}
                          dot={false}
                          connectNulls={false}
                        />
                      )}
                    </>
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ORDER COUNT + AVG ORDER VALUE */}
          <div className="chart-row">
            <div className="chart-card">
              <h4 className="chart-title">{t.dashOrderCountTitle}</h4>
              <p className="chart-sub">{isAggregated ? t.dashMonthly : t.dashDaily} {t.dashOrdersUnit}</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="date" tick={{ fill: C.tick, fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: C.tick, fontSize: 10 }} width={30} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="orders" name={t.chartOrders} fill={C.accent} radius={[3, 3, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h4 className="chart-title">{t.dashAvgOrderValue}</h4>
              <p className="chart-sub">{t.dashAvgPerOrder}</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="date" tick={{ fill: C.tick, fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tickFormatter={v => `$${v}`} tick={{ fill: C.tick, fontSize: 10 }} width={45} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="avg" name={t.chartAvgValue} stroke={C.accent} strokeWidth={2} dot={spanDays <= 30} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* DELIVERY VS PICKUP */}
          <div className="chart-card">
            <h4 className="chart-title">{t.dashDeliveryVsPickupRevTitle}</h4>
            <p className="chart-sub">{t.dashSideBySide} {isAggregated ? t.dashMonthly : t.dashDaily} {t.dashComparisonSuffix}</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                <XAxis dataKey="date" tick={{ fill: C.tick, fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={v => `$${v}`} tick={{ fill: C.tick, fontSize: 11 }} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#888' }} />
                <Bar dataKey="delivery" name={t.chartDelivery} fill={C.delivery} radius={[3, 3, 0, 0]} opacity={0.85} />
                <Bar dataKey="pickup" name={t.chartPickup} fill={C.pickup} radius={[3, 3, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* PLATFORM BREAKDOWN */}
          {platformData.length > 0 && (
            <div className="chart-row">
              <div className="chart-card">
                <h4 className="chart-title">{t.dashRevByPlatform}</h4>
                <p className="chart-sub">{t.dashWhereFrom}</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={platformData} dataKey="revenue" nameKey="name"
                      cx="50%" cy="50%" outerRadius={80}
                      label={({ name, percent }) => `${PLATFORM_LABELS[name] || name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}>
                      {platformData.map((entry, i) => (
                        <Cell key={i} fill={PLATFORM_COLORS[entry.name] || '#888'} opacity={0.9} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => formatCurrency(val)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h4 className="chart-title">{t.dashPlatformBreakdown}</h4>
                <p className="chart-sub">{t.dashOrdersRevPerChannel}</p>
                <div className="platform-breakdown-list">
                  {platformData.map(p => (
                    <div key={p.name} className="pb-row">
                      <div className="pb-info">
                        <span className="pb-dot" style={{ background: PLATFORM_COLORS[p.name] || '#888' }} />
                        <span className="pb-name">{PLATFORM_LABELS[p.name] || p.name}</span>
                        <span className="pb-count">{p.count} {t.dashOrdersUnit}</span>
                      </div>
                      <div className="pb-right">
                        <span className="pb-rev">{formatCurrency(p.revenue)}</span>
                        <div className="pb-bar-track">
                          <div className="pb-bar-fill" style={{
                            width: `${platformData[0].revenue > 0 ? (p.revenue / platformData[0].revenue) * 100 : 0}%`,
                            background: PLATFORM_COLORS[p.name] || '#888'
                          }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';
import { useTheme } from '../../hooks/useTheme.js';
import { useLocalStore } from '@hooks/useLocalStore.js';
import { useDashboardColors } from './useDashboardColors.js';
import KPICards from './KPICards.jsx';
import RevenueChart from './RevenueChart.jsx';
import FoodCostChart from './FoodCostChart.jsx';
import OrderCharts from './OrderCharts.jsx';
import PlatformCharts from './PlatformCharts.jsx';
import ColorEditor from './ColorEditor.jsx';
import {
  PRESETS,
  todayISO,
  daysAgoISO,
  fmtLabel,
  shiftDate,
  getRevenueForDate,
  aggregateData,
} from './dashboardUtils.js';
import './Dashboard.css';

export default function Dashboard({ dailySummary, days, months, foodCostByDay = {}, foodCostByMonth = {}, laborByMonth = {}, fixedByMonth = {} }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  // Same pl-targets the Profit & Loss view writes to — keeps the Dashboard's
  // labor/overhead/other estimates in sync with the P&L tab.
  const [plTargets] = useLocalStore('pl-targets', {
    version: 1,
    initial: { laborPct: 30, overheadPct: 16, otherPct: 5 },
  });

  // Color customization hook - replaces hardcoded colors with customizable ones
  const { C, platformColors, updateColor, resetColors, getEditableColors, hasCustomColors } = useDashboardColors(isDark);

  // Edit mode state for color customization
  const [isEditingColors, setIsEditingColors] = useState(false);

  const [fromDate, setFromDate] = useState(daysAgoISO(30));
  const [toDate, setToDate]     = useState(todayISO());
  const [activePreset, setActivePreset]     = useState('30d');
  const [comparisonMode, setComparisonMode] = useState('none');

  const applyPreset = (preset) => {
    setFromDate(preset.from());
    setToDate(preset.to());
    setActivePreset(preset.label);
  };

  const handleFromChange = (val) => { setFromDate(val); setActivePreset('custom'); };
  const handleToChange   = (val) => { setToDate(val);   setActivePreset('custom'); };

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
          point.prevRevenue  = shifted ? getRevenueForDate(shifted, days, months) : undefined;
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
          point.prevRevenue  = shifted ? getRevenueForDate(shifted, days, months) : undefined;
          point.prevFoodCost = shifted ? (foodCostByMonth[shifted.slice(0, 7)] ?? null) : undefined;
        }
        return point;
      });

    return [...dailyPoints, ...monthlyPoints].sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  }, [dailySummary, months, fromDate, toDate, spanDays, foodCostByDay, foodCostByMonth, comparisonMode, days]);

  const chartData    = useMemo(() => aggregateData(rawChartData, spanDays), [rawChartData, spanDays]);
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
          byPlatform[key].count   += count;
        }
      });
    };

    Object.values(days)
      .filter(d => d.date >= fromDate && d.date <= toDate)
      .forEach(addPlatforms);

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
      <div className="dash-header">
        <h2 className="page-title">{t.tabDashboard}</h2>
        <button
          className={`dash-edit-colors-btn ${isEditingColors ? 'active' : ''}`}
          onClick={() => setIsEditingColors(!isEditingColors)}
          title={t.colorEditTooltip || 'Customize dashboard colors'}
        >
          <span className="edit-icon">🎨</span>
          {isEditingColors ? (t.colorDoneBtn || 'Done') : (t.colorEditBtn || 'Edit Colors')}
        </button>
      </div>

      {isEditingColors && (
        <ColorEditor
          editableColors={getEditableColors()}
          onColorChange={updateColor}
          onReset={resetColors}
          hasCustomColors={hasCustomColors}
        />
      )}

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
          {isAggregated && <div className="dash-agg-notice">{t.dashMonthlyAgg}</div>}

          <KPICards
            totals={totals}
            plTargets={plTargets}
            hasFoodCost={hasFoodCost}
            spanDays={spanDays}
            C={C}
          />

          <RevenueChart
            chartData={chartData}
            comparisonMode={comparisonMode}
            isAggregated={isAggregated}
            C={C}
          />

          {hasFoodCost && (
            <FoodCostChart
              chartData={chartData}
              comparisonMode={comparisonMode}
              hasFoodCost={hasFoodCost}
              C={C}
            />
          )}

          <OrderCharts
            chartData={chartData}
            spanDays={spanDays}
            isAggregated={isAggregated}
            C={C}
          />

          <PlatformCharts platformData={platformData} platformColors={platformColors} />
        </>
      )}
    </div>
  );
}

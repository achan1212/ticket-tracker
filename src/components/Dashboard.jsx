import { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { formatCurrency } from '@utils/helpers';

const ACCENT = '#e8ff47';
const DELIVERY_COLOR = '#06C167';
const PICKUP_COLOR = '#3b82f6';
const PLATFORM_COLORS = { doordash: '#FF3008', ubereats: '#06C167', grubhub: '#F63440', direct: '#e8ff47' };
const PLATFORM_LABELS = { doordash: 'DoorDash', ubereats: 'Uber Eats', grubhub: 'Grubhub', direct: 'Direct', other: 'Other' };

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

// For long ranges, aggregate by week or month to keep chart readable
function aggregateData(data, spanDays) {
  if (spanDays <= 90 || data.length <= 60) return data; // daily is fine

  // Monthly aggregation for > 90 days
  const byMonth = {};
  data.forEach(d => {
    const key = d.fullDate.slice(0, 7); // YYYY-MM
    if (!byMonth[key]) byMonth[key] = { date: key + '-01', fullDate: key, revenue: 0, delivery: 0, pickup: 0, orders: 0, avgSum: 0, count: 0 };
    byMonth[key].revenue  += d.revenue;
    byMonth[key].delivery += d.delivery;
    byMonth[key].pickup   += d.pickup;
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
          <span>{p.name === 'Orders' ? p.value : formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export default function Dashboard({ dailySummary, days, months }) {
  const [fromDate, setFromDate] = useState(daysAgoISO(30));
  const [toDate, setToDate] = useState(todayISO());
  const [activePreset, setActivePreset] = useState('30d');

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
    const diff = new Date(toDate) - new Date(fromDate);
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [fromDate, toDate]);

  // Filter + sort daily data, then append manual monthly entries for months
  // that have no daily records (prevents double-counting).
  const rawChartData = useMemo(() => {
    const dailyPoints = [...dailySummary]
      .filter(d => d.date >= fromDate && d.date <= toDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        date:     fmtLabel(d.date, spanDays),
        fullDate: d.date,
        revenue:  parseFloat(d.revenue.toFixed(2)),
        delivery: parseFloat(d.deliveryRevenue.toFixed(2)),
        pickup:   parseFloat(d.pickupRevenue.toFixed(2)),
        orders:   d.orderCount,
        avg:      parseFloat(d.avgOrderValue.toFixed(2)),
      }));

    const dailyMonthKeys = new Set(dailySummary.map(d => d.date.slice(0, 7)));

    const monthlyPoints = Object.values(months)
      .filter(m => !dailyMonthKeys.has(m.month))
      .filter(m => m.month + '-01' <= toDate && m.month + '-28' >= fromDate)
      .map(m => {
        const revenue    = (m.deliveryRevenue || 0) + (m.pickupRevenue || 0);
        const orderCount = (m.deliveryOrders  || 0) + (m.pickupOrders  || 0);
        const fullDate   = m.month + '-01';
        return {
          date:     fmtLabel(fullDate, spanDays),
          fullDate,
          revenue:  parseFloat(revenue.toFixed(2)),
          delivery: parseFloat((m.deliveryRevenue || 0).toFixed(2)),
          pickup:   parseFloat((m.pickupRevenue   || 0).toFixed(2)),
          orders:   orderCount,
          avg:      orderCount > 0 ? parseFloat((revenue / orderCount).toFixed(2)) : 0,
        };
      });

    return [...dailyPoints, ...monthlyPoints].sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  }, [dailySummary, months, fromDate, toDate, spanDays]);

  const chartData = useMemo(() => aggregateData(rawChartData, spanDays), [rawChartData, spanDays]);
  const isAggregated = chartData.length < rawChartData.length;

  const totals = useMemo(() => {
    const revenue     = rawChartData.reduce((s, d) => s + d.revenue, 0);
    const deliveryRev = rawChartData.reduce((s, d) => s + d.delivery, 0);
    const pickupRev   = rawChartData.reduce((s, d) => s + d.pickup, 0);
    const orderCount  = rawChartData.reduce((s, d) => s + d.orders, 0);
    const avg = orderCount > 0 ? revenue / orderCount : 0;
    const bestDay = rawChartData.reduce((best, d) => (!best || d.revenue > best.revenue) ? d : best, null);
    return { revenue, deliveryRev, pickupRev, orderCount, avg, bestDay };
  }, [rawChartData]);

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
      .filter(m => m.month + '-01' <= toDate && m.month + '-28' >= fromDate)
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

      {/* ── DATE RANGE SELECTOR ── */}
      <div className="dash-range-card">
        <div className="dash-range-top">
          <span className="dash-range-label">Date Range</span>
          {rangeLabel && <span className="dash-range-custom-label">Custom: {rangeLabel}</span>}
        </div>

        {/* PRESET PILLS */}
        <div className="dash-range-pills">
          {PRESETS.map(p => (
            <button key={p.label}
              className={`range-pill ${activePreset === p.label ? 'active' : ''}`}
              onClick={() => applyPreset(p)}>
              {p.label}
            </button>
          ))}
        </div>

        {/* CUSTOM DATE INPUTS */}
        <div className="dash-custom-range">
          <div className="dash-date-field">
            <label className="target-label">From</label>
            <input type="date" className="form-input date-input"
              value={fromDate} max={toDate}
              onChange={(e) => handleFromChange(e.target.value)} />
          </div>
          <span className="dash-date-sep">→</span>
          <div className="dash-date-field">
            <label className="target-label">To</label>
            <input type="date" className="form-input date-input"
              value={toDate} min={fromDate} max={todayISO()}
              onChange={(e) => handleToChange(e.target.value)} />
          </div>
          <div className="dash-span-info">
            <span className="dash-span-value">{spanDays}</span>
            <span className="dash-span-unit">days</span>
          </div>
        </div>
      </div>

      {noData ? (
        <div className="ca-empty">No order data for this period. Add orders in the Daily Summary tab.</div>
      ) : (
        <>
          {isAggregated && (
            <div className="dash-agg-notice">
              📅 Showing monthly aggregates for this date range
            </div>
          )}

          {/* SUMMARY CARDS */}
          <div className="dash-cards">
            <div className="dash-card">
              <p className="dash-card-label">Total Revenue</p>
              <p className="dash-card-value">{formatCurrency(totals.revenue)}</p>
              <p className="dash-card-sub">{spanDays} day range</p>
            </div>
            <div className="dash-card">
              <p className="dash-card-label">Total Orders</p>
              <p className="dash-card-value">{totals.orderCount}</p>
              <p className="dash-card-sub">{spanDays} day range</p>
            </div>
            <div className="dash-card">
              <p className="dash-card-label">Avg Order Value</p>
              <p className="dash-card-value">{formatCurrency(totals.avg)}</p>
              <p className="dash-card-sub">Per order</p>
            </div>
            <div className="dash-card highlight">
              <p className="dash-card-label">🛵 Delivery Rev</p>
              <p className="dash-card-value" style={{ color: DELIVERY_COLOR }}>{formatCurrency(totals.deliveryRev)}</p>
              <p className="dash-card-sub">{totals.revenue > 0 ? ((totals.deliveryRev / totals.revenue) * 100).toFixed(1) : 0}% of total</p>
            </div>
            <div className="dash-card highlight">
              <p className="dash-card-label">🏪 Pickup Rev</p>
              <p className="dash-card-value" style={{ color: PICKUP_COLOR }}>{formatCurrency(totals.pickupRev)}</p>
              <p className="dash-card-sub">{totals.revenue > 0 ? ((totals.pickupRev / totals.revenue) * 100).toFixed(1) : 0}% of total</p>
            </div>
            {totals.bestDay && (
              <div className="dash-card">
                <p className="dash-card-label">Best Day</p>
                <p className="dash-card-value">{formatCurrency(totals.bestDay.revenue)}</p>
                <p className="dash-card-sub">{totals.bestDay.fullDate}</p>
              </div>
            )}
          </div>

          {/* REVENUE OVER TIME */}
          <div className="chart-card">
            <h4 className="chart-title">Revenue Over Time</h4>
            <p className="chart-sub">Delivery vs Pickup {isAggregated ? 'monthly' : 'daily'} breakdown</p>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gDelivery" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={DELIVERY_COLOR} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={DELIVERY_COLOR} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gPickup" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PICKUP_COLOR} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={PICKUP_COLOR} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={v => `$${v}`} tick={{ fill: '#666', fontSize: 11 }} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#888' }} />
                <Area type="monotone" dataKey="delivery" name="Delivery" stroke={DELIVERY_COLOR} fill="url(#gDelivery)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="pickup" name="Pickup" stroke={PICKUP_COLOR} fill="url(#gPickup)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ORDER COUNT + AVG ORDER VALUE */}
          <div className="chart-row">
            <div className="chart-card">
              <h4 className="chart-title">Order Count</h4>
              <p className="chart-sub">{isAggregated ? 'Monthly' : 'Daily'} orders</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#666', fontSize: 10 }} width={30} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="orders" name="Orders" fill={ACCENT} radius={[3, 3, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h4 className="chart-title">Avg Order Value</h4>
              <p className="chart-sub">Average revenue per order</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tickFormatter={v => `$${v}`} tick={{ fill: '#666', fontSize: 10 }} width={45} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="avg" name="Avg Value" stroke={ACCENT} strokeWidth={2} dot={spanDays <= 30} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* DELIVERY VS PICKUP */}
          <div className="chart-card">
            <h4 className="chart-title">Delivery vs Pickup Revenue</h4>
            <p className="chart-sub">Side-by-side {isAggregated ? 'monthly' : 'daily'} comparison</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={v => `$${v}`} tick={{ fill: '#666', fontSize: 11 }} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#888' }} />
                <Bar dataKey="delivery" name="Delivery" fill={DELIVERY_COLOR} radius={[3, 3, 0, 0]} opacity={0.85} />
                <Bar dataKey="pickup" name="Pickup" fill={PICKUP_COLOR} radius={[3, 3, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* PLATFORM BREAKDOWN */}
          {platformData.length > 0 && (
            <div className="chart-row">
              <div className="chart-card">
                <h4 className="chart-title">Revenue by Platform</h4>
                <p className="chart-sub">Where your orders come from</p>
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
                <h4 className="chart-title">Platform Breakdown</h4>
                <p className="chart-sub">Orders and revenue per channel</p>
                <div className="platform-breakdown-list">
                  {platformData.map(p => (
                    <div key={p.name} className="pb-row">
                      <div className="pb-info">
                        <span className="pb-dot" style={{ background: PLATFORM_COLORS[p.name] || '#888' }} />
                        <span className="pb-name">{PLATFORM_LABELS[p.name] || p.name}</span>
                        <span className="pb-count">{p.count} orders</span>
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

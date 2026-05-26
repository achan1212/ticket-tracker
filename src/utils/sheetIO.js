import { utils, writeFile, read } from 'xlsx';

const PLATFORMS = {
  doordash: { name: 'DoorDash', commissionPct: 25, paymentProcessingPct: 2.5, flatFeePerOrder: 0, marketingPct: 0 },
  ubereats:  { name: 'Uber Eats', commissionPct: 27, paymentProcessingPct: 2.5, flatFeePerOrder: 0, marketingPct: 0 },
  grubhub:   { name: 'Grubhub', commissionPct: 20, paymentProcessingPct: 3.05, flatFeePerOrder: 0.30, marketingPct: 0 },
};

const BASE_COLS = [
  { wch: 14 }, // period
  { wch: 16 }, // Total Revenue
  { wch: 18 }, // Total Revenue (Manual)
  { wch: 14 }, // Total Orders
  { wch: 12 }, // Avg/Order
  { wch: 14 }, // Food Cost
  { wch: 12 }, // Food Cost %
  { wch: 18 }, { wch: 16 }, // delivery
  { wch: 16 }, { wch: 14 }, // pickup
  { wch: 18 }, { wch: 18 }, { wch: 16 }, // platform rev
  { wch: 16 }, { wch: 16 }, { wch: 16 }, // platform orders
];

function effectiveRevenue(r) {
  const breakdown = (r.deliveryRevenue || 0) + (r.pickupRevenue || 0);
  const override  = r.totalRevenue || 0;
  return override > 0 ? override : breakdown;
}

function buildSummarySheet(records, periodKey, periodLabel, exportedAt, foodCostMap = {}) {
  const allCategories = [
    ...new Set(records.flatMap(r => Object.keys(r.categories || {})))
  ].sort();

  const headers = [
    periodLabel,
    'Total Revenue',
    'Total Revenue (Manual)',
    'Total Orders',
    'Avg/Order',
    'Food Cost',
    'Food Cost %',
    'Delivery Revenue', 'Delivery Orders',
    'Pickup Revenue', 'Pickup Orders',
    'DoorDash Revenue', 'Uber Eats Revenue', 'Grubhub Revenue',
    'DoorDash Orders', 'Uber Eats Orders', 'Grubhub Orders',
    ...allCategories,
    'Notes',
  ];

  const dataRows = records.map(r => {
    const total    = effectiveRevenue(r);
    const override = (r.totalRevenue || 0) > 0 ? r.totalRevenue : '';
    const orders   = (r.deliveryOrders || 0) + (r.pickupOrders || 0);
    const cats     = r.categories || {};
    const foodCost = foodCostMap[r[periodKey]] ?? (r.foodCost || 0);
    const foodPct  = (foodCost > 0 && total > 0) ? foodCost / total : '';
    return [
      r[periodKey],
      total,
      override,
      orders,
      orders > 0 ? total / orders : 0,
      foodCost || '',
      foodPct,
      r.deliveryRevenue || 0, r.deliveryOrders || 0,
      r.pickupRevenue   || 0, r.pickupOrders   || 0,
      r.doordash || 0, r.ubereats || 0, r.grubhub || 0,
      r.doordashOrders || 0, r.ubereatsOrders || 0, r.grubhubOrders || 0,
      ...allCategories.map(c => cats[c] || 0),
      r.notes || '',
    ];
  });

  const sumField = (k) => records.reduce((s, r) => s + (r[k] || 0), 0);
  const sumEffectiveRevenue = records.reduce((s, r) => s + effectiveRevenue(r), 0);
  const sumFoodCost = records.reduce((s, r) => s + (foodCostMap[r[periodKey]] ?? r.foodCost ?? 0), 0);
  const totalsRow = [
    'TOTAL',
    sumEffectiveRevenue,
    '',
    sumField('deliveryOrders') + sumField('pickupOrders'),
    '',
    sumFoodCost || '',
    (sumFoodCost > 0 && sumEffectiveRevenue > 0) ? sumFoodCost / sumEffectiveRevenue : '',
    sumField('deliveryRevenue'), sumField('deliveryOrders'),
    sumField('pickupRevenue'),   sumField('pickupOrders'),
    sumField('doordash'), sumField('ubereats'), sumField('grubhub'),
    sumField('doordashOrders'), sumField('ubereatsOrders'), sumField('grubhubOrders'),
    ...allCategories.map(c =>
      records.reduce((s, r) => s + ((r.categories || {})[c] || 0), 0)
    ),
    '',
  ];

  const ws = utils.aoa_to_sheet([
    [`Exported: ${exportedAt}`],
    [],
    headers,
    ...dataRows,
    [],
    totalsRow,
  ]);
  ws['!cols'] = [
    ...BASE_COLS,
    ...allCategories.map(() => ({ wch: 16 })),
    { wch: 30 },
  ];

  // Force the period column to text so Excel doesn't auto-convert YYYY-MM into a date
  for (let i = 0; i < records.length; i++) {
    const cellAddr = utils.encode_cell({ r: 3 + i, c: 0 });
    if (ws[cellAddr]) {
      ws[cellAddr].t = 's';
      ws[cellAddr].v = String(ws[cellAddr].v);
    }
  }

  // Format Food Cost % column (col index 6 = G) as percentage
  for (let i = 0; i < records.length + 1; i++) {
    const cellAddr = utils.encode_cell({ r: 3 + i, c: 6 });
    if (ws[cellAddr] && typeof ws[cellAddr].v === 'number') {
      ws[cellAddr].z = '0.0%';
    }
  }
  // Totals row pct cell (after blank row separator)
  const totalsRowIdx = 3 + records.length + 1;
  const totalsPctAddr = utils.encode_cell({ r: totalsRowIdx, c: 6 });
  if (ws[totalsPctAddr] && typeof ws[totalsPctAddr].v === 'number') {
    ws[totalsPctAddr].z = '0.0%';
  }

  return ws;
}

function buildFoodCostDetailSheet(groups, exportedAt) {
  const headers = [
    'Group Date', 'Source File', 'Status', 'Item', 'Unit Cost', 'Qty', 'Subtotal', 'Imported At',
  ];
  const rows = [];
  for (const g of groups) {
    for (const it of (g.items || [])) {
      const qty = Number(it.quantity) || 0;
      const cost = Number(it.cost) || 0;
      rows.push([
        g.date || '',
        g.name || it.sourceFile || '',
        g.status || '',
        it.name || '',
        cost,
        qty,
        cost * qty,
        g.importedAt ? new Date(g.importedAt).toLocaleString('en-US') : '',
      ]);
    }
    if (!g.items || g.items.length === 0) {
      rows.push([
        g.date || '',
        g.name || '',
        g.status || '',
        '(no items)',
        '', '', '',
        g.importedAt ? new Date(g.importedAt).toLocaleString('en-US') : '',
      ]);
    }
  }

  const ws = utils.aoa_to_sheet([
    [`Exported: ${exportedAt}`],
    [],
    headers,
    ...rows,
  ]);
  ws['!cols'] = [
    { wch: 14 }, { wch: 26 }, { wch: 12 }, { wch: 32 },
    { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 20 },
  ];
  // Force date column (col 0) to text so Excel doesn't auto-convert ISO dates
  for (let i = 0; i < rows.length; i++) {
    const cellAddr = utils.encode_cell({ r: 3 + i, c: 0 });
    if (ws[cellAddr]) {
      ws[cellAddr].t = 's';
      ws[cellAddr].v = String(ws[cellAddr].v);
    }
  }
  return ws;
}

function buildPLTargetsSheet(plTargets, exportedAt) {
  const t = plTargets || {};
  const rows = [
    [`Exported: ${exportedAt}`],
    [],
    ['Setting', 'Value (%)'],
    ['Labor',    Number(t.laborPct)    || 0],
    ['Overhead', Number(t.overheadPct) || 0],
    ['Other',    Number(t.otherPct)    || 0],
  ];
  const ws = utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 16 }, { wch: 14 }];
  return ws;
}

/**
 * Build a "Dashboard" summary sheet — laid out as three discrete tables
 * (Key Metrics, Monthly Trend, Platform Comparison) so the user can select
 * any table in Excel and Insert → Chart to visualize it instantly.
 */
function buildDashboardSheet({ sortedDaily, sortedMonthly, foodCostByDay, foodCostByMonth }, exportedAt) {
  // Avoid double-counting: when a month has daily records, use those and
  // skip the manual monthly entry for that same month.
  const dailyMonthKeys = new Set(sortedDaily.map(d => d.date.slice(0, 7)));
  const monthlyEffective = sortedMonthly.filter(m => !dailyMonthKeys.has(m.month));

  // ── Aggregate key metrics ─────────────────────────────────────
  const totalRevenue =
    sortedDaily.reduce((s, d) => s + effectiveRevenue(d), 0) +
    monthlyEffective.reduce((s, m) => s + effectiveRevenue(m), 0);

  const totalOrders =
    sortedDaily.reduce((s, d) => s + (d.deliveryOrders || 0) + (d.pickupOrders || 0), 0) +
    monthlyEffective.reduce((s, m) => s + (m.deliveryOrders || 0) + (m.pickupOrders || 0), 0);

  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  let totalFoodCost = 0;
  for (const d of sortedDaily) totalFoodCost += foodCostByDay[d.date] ?? d.foodCost ?? 0;
  for (const m of monthlyEffective) totalFoodCost += foodCostByMonth[m.month] ?? m.foodCost ?? 0;
  const foodCostPct = totalRevenue > 0 ? totalFoodCost / totalRevenue : 0;

  const allPeriods = [
    ...sortedDaily.map(d => d.date),
    ...monthlyEffective.map(m => m.month + '-01'),
  ].sort();
  const dateRange = allPeriods.length > 0
    ? `${allPeriods[0]} → ${allPeriods[allPeriods.length - 1]}`
    : '—';

  // ── Monthly trend (daily records aggregated up + monthly fallback) ──
  const monthlyMap = new Map();
  for (const d of sortedDaily) {
    const month = d.date.slice(0, 7);
    const entry = monthlyMap.get(month) || { month, revenue: 0, orders: 0, foodCost: 0 };
    entry.revenue  += effectiveRevenue(d);
    entry.orders   += (d.deliveryOrders || 0) + (d.pickupOrders || 0);
    entry.foodCost += foodCostByDay[d.date] ?? d.foodCost ?? 0;
    monthlyMap.set(month, entry);
  }
  for (const m of monthlyEffective) {
    monthlyMap.set(m.month, {
      month: m.month,
      revenue: effectiveRevenue(m),
      orders: (m.deliveryOrders || 0) + (m.pickupOrders || 0),
      foodCost: foodCostByMonth[m.month] ?? m.foodCost ?? 0,
    });
  }
  const monthlyTrend = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));

  // ── Platform comparison ───────────────────────────────────────
  const allRecords = [...sortedDaily, ...monthlyEffective];
  const sumKey = (k) => allRecords.reduce((s, r) => s + (r[k] || 0), 0);
  const platforms = [
    { name: 'DoorDash',  revenue: sumKey('doordash'), orders: sumKey('doordashOrders') },
    { name: 'Uber Eats', revenue: sumKey('ubereats'), orders: sumKey('ubereatsOrders') },
    { name: 'Grubhub',   revenue: sumKey('grubhub'),  orders: sumKey('grubhubOrders')  },
    { name: 'Pickup',    revenue: sumKey('pickupRevenue'), orders: sumKey('pickupOrders') },
  ];
  const platformTotal = platforms.reduce((s, p) => s + p.revenue, 0);

  // ── Build the sheet, tracking row indices for number formatting ──
  const rows = [];
  rows.push([`Dashboard — Exported: ${exportedAt}`]);
  rows.push([]);
  rows.push(['TIP: Select any table below (including its header row), then Insert → Chart in Excel to visualize it.']);
  rows.push([]);

  rows.push(['KEY METRICS']);
  rows.push(['Metric', 'Value']);
  const metricsStart = rows.length;
  rows.push(['Total Revenue',       totalRevenue]);
  rows.push(['Total Orders',        totalOrders]);
  rows.push(['Average Order Value', avgOrderValue]);
  rows.push(['Total Food Cost',     totalFoodCost]);
  rows.push(['Food Cost %',         foodCostPct]);
  rows.push(['Date Range',          dateRange]);
  rows.push([]);

  rows.push(['MONTHLY TREND']);
  rows.push(['Month', 'Revenue', 'Orders', 'Avg/Order', 'Food Cost', 'Food Cost %']);
  const monthlyStart = rows.length;
  for (const m of monthlyTrend) {
    rows.push([
      m.month,
      m.revenue,
      m.orders,
      m.orders  > 0 ? m.revenue  / m.orders  : 0,
      m.foodCost,
      m.revenue > 0 ? m.foodCost / m.revenue : 0,
    ]);
  }
  rows.push([]);

  rows.push(['PLATFORM COMPARISON']);
  rows.push(['Platform', 'Revenue', 'Orders', '% of Total Revenue']);
  const platformStart = rows.length;
  for (const p of platforms) {
    rows.push([
      p.name,
      p.revenue,
      p.orders,
      platformTotal > 0 ? p.revenue / platformTotal : 0,
    ]);
  }

  const ws = utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];

  // ── Number formatting via cell .z (works with xlsx community edition) ──
  const CURRENCY = '"$"#,##0.00';
  const PCT      = '0.0%';

  const setFmt = (r, c, fmt) => {
    const addr = utils.encode_cell({ r, c });
    if (ws[addr] && typeof ws[addr].v === 'number') ws[addr].z = fmt;
  };

  // Key metrics value column (col B = 1)
  setFmt(metricsStart + 0, 1, CURRENCY); // Total Revenue
  setFmt(metricsStart + 2, 1, CURRENCY); // Avg Order Value
  setFmt(metricsStart + 3, 1, CURRENCY); // Total Food Cost
  setFmt(metricsStart + 4, 1, PCT);      // Food Cost %

  // Monthly trend rows
  for (let i = 0; i < monthlyTrend.length; i++) {
    const r = monthlyStart + i;
    // Force month col to text so Excel doesn't auto-convert YYYY-MM into a date
    const monthAddr = utils.encode_cell({ r, c: 0 });
    if (ws[monthAddr]) {
      ws[monthAddr].t = 's';
      ws[monthAddr].v = String(ws[monthAddr].v);
    }
    setFmt(r, 1, CURRENCY); // Revenue
    setFmt(r, 3, CURRENCY); // Avg/Order
    setFmt(r, 4, CURRENCY); // Food Cost
    setFmt(r, 5, PCT);      // Food Cost %
  }

  // Platform comparison rows
  for (let i = 0; i < platforms.length; i++) {
    const r = platformStart + i;
    setFmt(r, 1, CURRENCY); // Revenue
    setFmt(r, 3, PCT);      // % of Total Revenue
  }

  return ws;
}

/**
 * Export every persisted store to a multi-sheet .xlsx file.
 *
 * @param {Object} opts
 * @param {Array}  [opts.dailySummary]   - day records (from useOrderStore.dailySummary)
 * @param {Object} [opts.deliveryRates]  - per-platform rate overrides
 * @param {Object} [opts.months]         - month records keyed by 'YYYY-MM'
 * @param {Object} [opts.foodCostByDay]  - 'YYYY-MM-DD' → number
 * @param {Object} [opts.foodCostByMonth]- 'YYYY-MM' → number
 * @param {Array}  [opts.foodCostGroups] - raw food cost import groups
 * @param {Object} [opts.plTargets]      - { laborPct, overheadPct, otherPct }
 */
export function exportToXlsx(opts = {}) {
  const {
    dailySummary    = [],
    deliveryRates   = {},
    months          = {},
    foodCostByDay   = {},
    foodCostByMonth = {},
    foodCostGroups  = [],
    plTargets       = null,
  } = opts;

  const sortedDaily   = [...dailySummary].sort((a, b) => a.date.localeCompare(b.date));
  const sortedMonthly = Object.values(months || {}).sort((a, b) => a.month.localeCompare(b.month));

  const hasAnything =
    sortedDaily.length > 0 ||
    sortedMonthly.length > 0 ||
    foodCostGroups.length > 0 ||
    plTargets != null;
  if (!hasAnything) return;

  const wb = utils.book_new();
  const exportedAt = new Date().toLocaleString('en-US');

  // Dashboard goes first so it's the active sheet when the file opens.
  if (sortedDaily.length > 0 || sortedMonthly.length > 0) {
    utils.book_append_sheet(
      wb,
      buildDashboardSheet({ sortedDaily, sortedMonthly, foodCostByDay, foodCostByMonth }, exportedAt),
      'Dashboard'
    );
  }

  if (sortedDaily.length > 0) {
    utils.book_append_sheet(
      wb,
      buildSummarySheet(sortedDaily, 'date', 'Date', exportedAt, foodCostByDay),
      'Daily Summary'
    );
  }
  if (sortedMonthly.length > 0) {
    utils.book_append_sheet(
      wb,
      buildSummarySheet(sortedMonthly, 'month', 'Month', exportedAt, foodCostByMonth),
      'Monthly Summary'
    );
  }

  // Delivery Fees — aggregate from both daily and monthly platform revenue
  const allRecords = [...sortedDaily, ...sortedMonthly];
  if (allRecords.length > 0) {
    const deliveryRows = [
      [`Exported: ${exportedAt}`],
      [],
      [
        'Platform', 'Gross Revenue', 'Orders',
        'Commission %', 'Processing %', 'Flat Fee/Order', 'Marketing %',
        'Total Commission', 'Total Processing', 'Total Flat Fees', 'Total Marketing',
        'Total Deductions', 'Net Revenue', 'Effective Rate %', 'You Keep %',
      ],
      ...['doordash', 'ubereats', 'grubhub'].map(key => {
        const defaults = PLATFORMS[key];
        const rates = deliveryRates[key] || defaults;
        const rev    = allRecords.reduce((s, r) => s + (r[key] || 0), 0);
        const orders = allRecords.reduce((s, r) => s + (r[`${key}Orders`] || 0), 0);
        const commAmt = rev * (rates.commissionPct / 100);
        const procAmt = rev * (rates.paymentProcessingPct / 100);
        const flatAmt = (rates.flatFeePerOrder || 0) * orders;
        const mktAmt  = rev * ((rates.marketingPct || 0) / 100);
        const total   = commAmt + procAmt + flatAmt + mktAmt;
        const net     = rev - total;
        const effRate = rev > 0 ? total / rev : 0;
        return [
          defaults.name, rev, orders,
          rates.commissionPct / 100,
          rates.paymentProcessingPct / 100,
          rates.flatFeePerOrder || 0,
          (rates.marketingPct || 0) / 100,
          commAmt, procAmt, flatAmt, mktAmt,
          total, net, effRate, 1 - effRate,
        ];
      }),
    ];
    const wsDelivery = utils.aoa_to_sheet(deliveryRows);
    wsDelivery['!cols'] = [
      { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
      { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
    ];
    ['D', 'E', 'G', 'N', 'O'].forEach(col => {
      for (let r = 4; r <= 6; r++) {
        const cell = `${col}${r}`;
        if (wsDelivery[cell]) wsDelivery[cell].z = '0.0%';
      }
    });
    utils.book_append_sheet(wb, wsDelivery, 'Delivery Fees');
  }

  if (foodCostGroups.length > 0) {
    utils.book_append_sheet(wb, buildFoodCostDetailSheet(foodCostGroups, exportedAt), 'Food Cost Detail');
  }

  if (plTargets) {
    utils.book_append_sheet(wb, buildPLTargetsSheet(plTargets, exportedAt), 'P&L Targets');
  }

  const dateSlug = new Date().toISOString().slice(0, 10);
  writeFile(wb, `tracker-export-${dateSlug}.xlsx`);
}

// Recover a YYYY-MM-DD or YYYY-MM string from a cell value that Excel may
// have auto-converted into a serial date number or a Date object.
function coercePeriod(raw, periodKey) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'string') return raw.trim();

  let dateObj = null;
  if (raw instanceof Date) {
    dateObj = raw;
  } else if (typeof raw === 'number') {
    // Excel epoch: serial 1 = 1900-01-01 (with the Lotus 1-2-3 leap-year bug)
    const ms = (raw - 25569) * 86400 * 1000;
    dateObj = new Date(ms);
  }
  if (!dateObj || isNaN(dateObj.getTime())) return '';

  const y  = dateObj.getUTCFullYear();
  const m  = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const d  = String(dateObj.getUTCDate()).padStart(2, '0');
  return periodKey === 'date' ? `${y}-${m}-${d}` : `${y}-${m}`;
}

function parseSummarySheet(ws, periodKey, defaultSource) {
  if (!ws) return [];
  const rows = utils.sheet_to_json(ws, { header: 1, defval: '' });

  const headerIdx = rows.findIndex(row => {
    const v = String(row[0] || '').toLowerCase().trim();
    return v === 'date' || v === 'month';
  });
  if (headerIdx === -1) return [];

  const headers = rows[headerIdx].map(h => String(h).toLowerCase().trim());
  const col = (exact) => headers.indexOf(exact);
  const has = (a, b) => headers.findIndex(h => h.includes(a) && h.includes(b));

  const delRevCol    = col('delivery revenue');
  const delOrdCol    = col('delivery orders');
  const pkRevCol     = col('pickup revenue');
  const pkOrdCol     = col('pickup orders');
  const totalRevCol  = col('total revenue');
  const totalManCol  = has('total revenue', 'manual');
  const totalOrdCol  = col('total orders');
  const foodCostCol  = headers.findIndex(h => h === 'food cost'); // exact match — avoid "food cost %"
  const ddRevCol     = has('doordash', 'revenue');
  const ueRevCol     = has('uber', 'revenue');
  const ghRevCol     = has('grubhub', 'revenue');
  const ddOrdCol     = has('doordash', 'orders');
  const ueOrdCol     = has('uber', 'orders');
  const ghOrdCol     = has('grubhub', 'orders');
  const notesCol     = col('notes');

  const periodRegex = periodKey === 'date' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}$/;

  const records = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[0] || '').trim().toUpperCase() === 'TOTAL') continue;

    const period = coercePeriod(row[0], periodKey);
    if (!period || !periodRegex.test(period)) continue;

    const totalOverride = totalManCol >= 0 ? parseFloat(row[totalManCol]) || 0 : 0;
    const foodCostVal   = foodCostCol >= 0 ? parseFloat(row[foodCostCol]) || 0 : 0;

    // Legacy fallback: sheets exported before the "Total Revenue (Manual)"
    // column existed had no delivery/pickup breakdown at all, so we dump
    // Total Revenue into deliveryRevenue to preserve the value. Newer sheets
    // always carry both an explicit Delivery column AND a Manual override
    // column — using the same fallback there would stuff the override total
    // back into deliveryRevenue, double-counting on the next export. Detect
    // the legacy case by the absence of the Manual column.
    const isLegacySheet = totalManCol === -1;
    const fallbackDelRev = isLegacySheet && delRevCol === -1 ? (parseFloat(row[totalRevCol]) || 0) : 0;
    const fallbackDelOrd = isLegacySheet && delOrdCol === -1 ? (parseInt(row[totalOrdCol])   || 0) : 0;

    const record = {
      [periodKey]:     period,
      deliveryRevenue: delRevCol >= 0 ? (parseFloat(row[delRevCol]) || 0) : fallbackDelRev,
      pickupRevenue:   parseFloat(pkRevCol >= 0 ? row[pkRevCol] : 0) || 0,
      deliveryOrders:  delOrdCol >= 0 ? (parseInt(row[delOrdCol]) || 0)   : fallbackDelOrd,
      pickupOrders:    parseInt(pkOrdCol >= 0 ? row[pkOrdCol] : 0) || 0,
      doordash:        parseFloat(ddRevCol >= 0 ? row[ddRevCol] : 0) || 0,
      ubereats:        parseFloat(ueRevCol >= 0 ? row[ueRevCol] : 0) || 0,
      grubhub:         parseFloat(ghRevCol >= 0 ? row[ghRevCol] : 0) || 0,
      doordashOrders:  parseInt(ddOrdCol >= 0 ? row[ddOrdCol] : 0) || 0,
      ubereatsOrders:  parseInt(ueOrdCol >= 0 ? row[ueOrdCol] : 0) || 0,
      grubhubOrders:   parseInt(ghOrdCol >= 0 ? row[ghOrdCol] : 0) || 0,
      notes:           notesCol >= 0 ? String(row[notesCol] || '').trim() : '',
      categories:      {},
      // Anything pulled from a file is always tagged 'imported' — we ignore any
      // Source column the file may carry, since past exports wrote "Manual" there
      // and that would re-introduce the manual badge after a round-trip.
      source:          defaultSource || 'imported',
    };
    if (totalOverride > 0) record.totalRevenue = totalOverride;
    // Preserve the Food Cost column on both daily and monthly imports. The
    // monthly record uses this field directly; for daily records, consumers
    // (Dashboard, DailySummaryTable) fall back to it when the live
    // useFoodCostStore mapping has no entry for that date.
    if (foodCostVal > 0) record.foodCost = foodCostVal;
    records.push(record);
  }
  return records;
}

/**
 * Import an .xlsx file. Reads "Daily Summary" and "Monthly Summary" sheets if present.
 * Returns { days, months } — both arrays may be empty independently, but at least one will have data.
 */
export function importFromXlsx(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = read(data, { type: 'array' });

        const dailyName = wb.SheetNames.find(n => n.toLowerCase() === 'daily summary');
        const monthlyName = wb.SheetNames.find(n => n.toLowerCase() === 'monthly summary');

        let days = [];
        let months = [];

        if (dailyName) {
          days = parseSummarySheet(wb.Sheets[dailyName], 'date', 'imported');
        }
        if (monthlyName) {
          // Records pulled from a file are tagged as 'imported' so the UI can
          // distinguish them from records the user typed into the form.
          months = parseSummarySheet(wb.Sheets[monthlyName], 'month', 'imported');
        }

        // Backwards-compat: if neither named sheet exists, try the first sheet as daily
        if (!dailyName && !monthlyName && wb.SheetNames.length > 0) {
          days = parseSummarySheet(wb.Sheets[wb.SheetNames[0]], 'date', 'imported');
        }

        if (days.length === 0 && months.length === 0) {
          reject(new Error('No valid records found in the file.'));
          return;
        }
        resolve({ days, months });
      } catch {
        reject(new Error('Could not read this file. Make sure it is a valid .xlsx file.'));
      }
    };
    reader.onerror = () => reject(new Error('File read failed.'));
    reader.readAsArrayBuffer(file);
  });
}

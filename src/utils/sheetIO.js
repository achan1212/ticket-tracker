import { utils, writeFile, read } from 'xlsx';

const PLATFORMS = {
  doordash: { name: 'DoorDash', commissionPct: 25, paymentProcessingPct: 2.5, flatFeePerOrder: 0, marketingPct: 0 },
  ubereats:  { name: 'Uber Eats', commissionPct: 27, paymentProcessingPct: 2.5, flatFeePerOrder: 0, marketingPct: 0 },
  grubhub:   { name: 'Grubhub', commissionPct: 20, paymentProcessingPct: 3.05, flatFeePerOrder: 0.30, marketingPct: 0 },
};

const BASE_COLS = [
  { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 12 },
  { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
  { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
];

function buildSummarySheet(records, periodKey, periodLabel, exportedAt) {
  const allCategories = [
    ...new Set(records.flatMap(r => Object.keys(r.categories || {})))
  ].sort();

  const headers = [
    periodLabel,
    'Total Revenue', 'Total Orders', 'Avg/Order',
    'Delivery Revenue', 'Delivery Orders',
    'Pickup Revenue', 'Pickup Orders',
    'DoorDash Revenue', 'Uber Eats Revenue', 'Grubhub Revenue',
    'DoorDash Orders', 'Uber Eats Orders', 'Grubhub Orders',
    ...allCategories,
    'Notes',
  ];

  const dataRows = records.map(r => {
    const total  = (r.deliveryRevenue || 0) + (r.pickupRevenue || 0);
    const orders = (r.deliveryOrders  || 0) + (r.pickupOrders  || 0);
    const cats   = r.categories || {};
    return [
      r[periodKey],
      total, orders, orders > 0 ? total / orders : 0,
      r.deliveryRevenue || 0, r.deliveryOrders || 0,
      r.pickupRevenue   || 0, r.pickupOrders   || 0,
      r.doordash || 0, r.ubereats || 0, r.grubhub || 0,
      r.doordashOrders || 0, r.ubereatsOrders || 0, r.grubhubOrders || 0,
      ...allCategories.map(c => cats[c] || 0),
      r.notes || '',
    ];
  });

  const sumField = (k) => records.reduce((s, r) => s + (r[k] || 0), 0);
  const totalsRow = [
    'TOTAL',
    sumField('deliveryRevenue') + sumField('pickupRevenue'),
    sumField('deliveryOrders')  + sumField('pickupOrders'),
    '',
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

  return ws;
}

/**
 * Export daily and monthly records to a multi-sheet .xlsx file.
 * @param {Array}  dailySummary  - day records from useOrderStore
 * @param {Object} deliveryRates - platform rate overrides keyed by platform key
 * @param {Object} months        - month records from useMonthlyStore (keyed by 'YYYY-MM')
 */
export function exportToXlsx(dailySummary = [], deliveryRates = {}, months = {}) {
  const sortedDaily   = [...dailySummary].sort((a, b) => a.date.localeCompare(b.date));
  const sortedMonthly = Object.values(months || {}).sort((a, b) => a.month.localeCompare(b.month));

  if (sortedDaily.length === 0 && sortedMonthly.length === 0) return;

  const wb = utils.book_new();
  const exportedAt = new Date().toLocaleString('en-US');

  if (sortedDaily.length > 0) {
    utils.book_append_sheet(wb, buildSummarySheet(sortedDaily, 'date', 'Date', exportedAt), 'Daily Summary');
  }
  if (sortedMonthly.length > 0) {
    utils.book_append_sheet(wb, buildSummarySheet(sortedMonthly, 'month', 'Month', exportedAt), 'Monthly Summary');
  }

  // Delivery Fees — aggregate from both daily and monthly platform revenue
  const allRecords = [...sortedDaily, ...sortedMonthly];
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

  const delRevCol   = col('delivery revenue');
  const delOrdCol   = col('delivery orders');
  const pkRevCol    = col('pickup revenue');
  const pkOrdCol    = col('pickup orders');
  const totalRevCol = col('total revenue');
  const totalOrdCol = col('total orders');
  const ddRevCol    = has('doordash', 'revenue');
  const ueRevCol    = has('uber', 'revenue');
  const ghRevCol    = has('grubhub', 'revenue');
  const ddOrdCol    = has('doordash', 'orders');
  const ueOrdCol    = has('uber', 'orders');
  const ghOrdCol    = has('grubhub', 'orders');
  const notesCol    = col('notes');

  const periodRegex = periodKey === 'date' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}$/;

  const records = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[0] || '').trim().toUpperCase() === 'TOTAL') continue;

    const period = coercePeriod(row[0], periodKey);
    if (!period || !periodRegex.test(period)) continue;

    records.push({
      [periodKey]:     period,
      deliveryRevenue: parseFloat(delRevCol >= 0 ? row[delRevCol] : row[totalRevCol]) || 0,
      pickupRevenue:   parseFloat(pkRevCol  >= 0 ? row[pkRevCol]  : 0) || 0,
      deliveryOrders:  parseInt(delOrdCol   >= 0 ? row[delOrdCol] : row[totalOrdCol]) || 0,
      pickupOrders:    parseInt(pkOrdCol    >= 0 ? row[pkOrdCol]  : 0) || 0,
      doordash:        parseFloat(ddRevCol  >= 0 ? row[ddRevCol]  : 0) || 0,
      ubereats:        parseFloat(ueRevCol  >= 0 ? row[ueRevCol]  : 0) || 0,
      grubhub:         parseFloat(ghRevCol  >= 0 ? row[ghRevCol]  : 0) || 0,
      doordashOrders:  parseInt(ddOrdCol    >= 0 ? row[ddOrdCol]  : 0) || 0,
      ubereatsOrders:  parseInt(ueOrdCol    >= 0 ? row[ueOrdCol]  : 0) || 0,
      grubhubOrders:   parseInt(ghOrdCol    >= 0 ? row[ghOrdCol]  : 0) || 0,
      notes:           notesCol >= 0 ? String(row[notesCol] || '').trim() : '',
      categories:      {},
      // Anything pulled from a file is always tagged 'imported' — we ignore any
      // Source column the file may carry, since past exports wrote "Manual" there
      // and that would re-introduce the manual badge after a round-trip.
      source:          defaultSource || 'imported',
    });
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

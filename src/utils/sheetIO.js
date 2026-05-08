import { utils, writeFile, read } from 'xlsx';

const PLATFORMS = {
  doordash: { name: 'DoorDash', commissionPct: 25, paymentProcessingPct: 2.5, flatFeePerOrder: 0, marketingPct: 0 },
  ubereats:  { name: 'Uber Eats', commissionPct: 27, paymentProcessingPct: 2.5, flatFeePerOrder: 0, marketingPct: 0 },
  grubhub:   { name: 'Grubhub', commissionPct: 20, paymentProcessingPct: 3.05, flatFeePerOrder: 0.30, marketingPct: 0 },
};

function fmt(date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Export all app data to a multi-sheet .xlsx file
 * @param {Array} items         - order items [{name, cost, quantity, addedAt}]
 * @param {Object} itemCosts    - cost data keyed by item index
 * @param {Object} deliveryRates
 * @param {number} orderCount
 * @param {string} sessionDate  - ISO date string for this session
 */
export function exportToXlsx(items, itemCosts = {}, deliveryRates = {}, orderCount = 1, sessionDate = new Date().toISOString()) {
  const wb = utils.book_new();
  const exportedAt = new Date().toLocaleString('en-US');
  const sessionDateFmt = fmt(new Date(sessionDate));

  // ── SHEET 1: Order Summary ─────────────────────────────
  const orderRows = [
    [`Order Date: ${sessionDateFmt}`, '', '', '', `Exported: ${exportedAt}`],
    [],
    ['Item Name', 'Source', 'Date Added', 'Unit Price', 'Quantity', 'Subtotal'],
    ...items.map(item => [
      item.name,
      item.source || 'manual',
      item.addedAt ? fmt(new Date(item.addedAt)) : sessionDateFmt,
      item.cost,
      item.quantity,
      item.cost * item.quantity,
    ]),
    [],
    ['', '', '', '', 'TOTAL', items.reduce((s, i) => s + i.cost * i.quantity, 0)],
  ];
  const wsOrder = utils.aoa_to_sheet(orderRows);
  wsOrder['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
  utils.book_append_sheet(wb, wsOrder, 'Order Summary');

  // ── SHEET 2: Cost Analysis ─────────────────────────────
  const revenue = items.reduce((s, i) => s + i.cost * i.quantity, 0);
  const costRows = [
    [`Order Date: ${sessionDateFmt}`, '', '', '', '', '', '', '', '', '', `Exported: ${exportedAt}`],
    [],
    ['Item Name', 'Date Added', 'Selling Price', 'Qty', 'Ingredient Cost/unit', 'Labor Cost/unit', 'Overhead Cost/unit', 'Unit Total Cost', 'Unit Profit', 'Gross Margin %', 'Total Profit'],
    ...items.map((item, idx) => {
      const c = itemCosts[idx] || {};
      const ing = parseFloat(c.ingredient) || 0;
      const lab = parseFloat(c.labor) || 0;
      const ovh = parseFloat(c.overhead) || 0;
      const unitCost = ing + lab + ovh;
      const unitProfit = item.cost - unitCost;
      const margin = item.cost > 0 ? (unitProfit / item.cost) * 100 : 0;
      return [
        item.name,
        item.addedAt ? fmt(new Date(item.addedAt)) : sessionDateFmt,
        item.cost,
        item.quantity,
        ing, lab, ovh,
        unitCost,
        unitProfit,
        margin / 100,
        unitProfit * item.quantity,
      ];
    }),
    [],
    ['TOTALS', '', revenue, '',
      '', '', '',
      items.reduce((s, i, idx) => { const c = itemCosts[idx] || {}; return s + ((parseFloat(c.ingredient)||0)+(parseFloat(c.labor)||0)+(parseFloat(c.overhead)||0))*i.quantity; }, 0),
      '',
      '',
      items.reduce((s, i, idx) => { const c = itemCosts[idx] || {}; const uc = (parseFloat(c.ingredient)||0)+(parseFloat(c.labor)||0)+(parseFloat(c.overhead)||0); return s + (i.cost - uc)*i.quantity; }, 0),
    ],
  ];
  const wsCost = utils.aoa_to_sheet(costRows);
  wsCost['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 8 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];
  // Format margin column as %
  for (let r = 4; r <= items.length + 3; r++) {
    const cell = `J${r}`;
    if (wsCost[cell]) wsCost[cell].z = '0.0%';
  }
  utils.book_append_sheet(wb, wsCost, 'Cost Analysis');

  // ── SHEET 3: Delivery Fee Analysis ────────────────────
  const deliveryRows = [
    [`Order Date: ${sessionDateFmt}`, '', '', '', '', '', '', '', '', '', '', '', '', '', `Exported: ${exportedAt}`],
    [],
    ['Platform', 'Date', 'Gross Revenue', 'Orders', 'Commission %', 'Processing %', 'Flat Fee/Order', 'Marketing %', 'Total Commission', 'Total Processing', 'Total Flat Fees', 'Total Marketing', 'Total Deductions', 'Net Revenue', 'Effective Rate %', 'You Keep %'],
    ...['doordash', 'ubereats', 'grubhub'].map(key => {
      const defaults = PLATFORMS[key];
      const rates = deliveryRates[key] || defaults;
      const commAmt = revenue * (rates.commissionPct / 100);
      const procAmt = revenue * (rates.paymentProcessingPct / 100);
      const flatAmt = (rates.flatFeePerOrder || 0) * orderCount;
      const mktAmt  = revenue * ((rates.marketingPct || 0) / 100);
      const total   = commAmt + procAmt + flatAmt + mktAmt;
      const net     = revenue - total;
      const effRate = revenue > 0 ? total / revenue : 0;
      return [
        defaults.name,
        sessionDateFmt,
        revenue, orderCount,
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
  wsDelivery['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 12 }];
  ['E', 'F', 'H', 'O', 'P'].forEach(col => {
    for (let r = 4; r <= 6; r++) {
      const cell = `${col}${r}`;
      if (wsDelivery[cell]) wsDelivery[cell].z = '0.0%';
    }
  });
  utils.book_append_sheet(wb, wsDelivery, 'Delivery Fees');

  // File name includes date
  const dateSlug = new Date(sessionDate).toISOString().slice(0, 10);
  writeFile(wb, `order-scanner-${dateSlug}.xlsx`);
}

/**
 * Import an .xlsx file and extract order items from the Order Summary sheet
 */
export function importFromXlsx(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = read(data, { type: 'array' });

        const sheetName = wb.SheetNames.includes('Order Summary')
          ? 'Order Summary'
          : wb.SheetNames[0];

        const ws = wb.Sheets[sheetName];
        const rows = utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Find header row
        const headerIdx = rows.findIndex(row =>
          row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('item'))
        );
        if (headerIdx === -1) { reject(new Error('Could not find an item list in this file.')); return; }

        const headers = rows[headerIdx].map(h => String(h).toLowerCase().trim());
        const nameCol  = headers.findIndex(h => h.includes('item') || h.includes('name'));
        const costCol  = headers.findIndex(h => h.includes('price') || (h.includes('cost') && !h.includes('ingredient') && !h.includes('labor') && !h.includes('overhead') && !h.includes('unit')) || h.includes('unit'));
        const qtyCol   = headers.findIndex(h => h.includes('qty') || h.includes('quantity'));
        const dateCol  = headers.findIndex(h => h.includes('date'));

        const items = [];
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          const name = String(row[nameCol] || '').trim();
          const cost = parseFloat(row[costCol]);
          const qty  = parseInt(row[qtyCol]) || 1;
          const dateRaw = dateCol >= 0 ? row[dateCol] : null;

          if (!name || name.toUpperCase() === 'TOTAL' || name.toUpperCase() === 'TOTALS') continue;
          if (isNaN(cost)) continue;

          // Parse date if present
          let addedAt = new Date().toISOString();
          if (dateRaw) {
            const parsed = new Date(dateRaw);
            if (!isNaN(parsed)) addedAt = parsed.toISOString();
          }

          items.push({ name, cost, quantity: qty, addedAt, source: 'imported' });
        }

        if (items.length === 0) { reject(new Error('No valid items found in the file.')); return; }
        resolve(items);
      } catch (err) {
        reject(new Error('Could not read this file. Make sure it is a valid .xlsx file.'));
      }
    };
    reader.onerror = () => reject(new Error('File read failed.'));
    reader.readAsArrayBuffer(file);
  });
}

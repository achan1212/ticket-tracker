import { utils, read } from 'xlsx';

/**
 * Parse a platform sales report (CSV, .xlsx, or .pdf) and return revenue +
 * order counts grouped by date AND/OR month.
 *
 * Returns: Promise<{
 *   days:   { [YYYY-MM-DD]: { revenue, orders } },
 *   months: { [YYYY-MM]:    { revenue, orders } },
 * }>
 *
 * CSV / XLSX path is column-name agnostic — the parser sniffs for the first
 * row that contains both a date-like cell AND a revenue-like cell, then maps
 * columns by keyword. Reports without an orders column count one order per
 * row (transaction-level data). Always routes to `days`.
 *
 * PDF path tries known platform-specific monthly-statement layouts first
 * (Uber Eats "Consolidated Monthly Summary"), then falls back to a generic
 * line-by-line heuristic that scans for date + dollar-amount patterns.
 * Monthly statements route to `months`; everything else to `days`.
 */
export function parsePlatformReport(file) {
  const isPdf = /\.pdf$/i.test(file.name || '') || file.type === 'application/pdf';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target.result;
        const result = isPdf
          ? await parsePdf(buffer)
          : { days: parseSpreadsheet(buffer), months: {} };

        if (Object.keys(result.days).length === 0 && Object.keys(result.months).length === 0) {
          reject(new Error('No valid date rows found in this report.'));
          return;
        }
        resolve(result);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    reader.onerror = () => reject(new Error('File read failed.'));
    reader.readAsArrayBuffer(file);
  });
}

// ─── CSV / XLSX path ──────────────────────────────────────────────────────

function parseSpreadsheet(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  const wb = read(data, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('Empty workbook.');
  const rows = utils.sheet_to_json(ws, { header: 1, defval: '' });

  const isDateHeader = (s) => /\bdate\b/i.test(s) && !/\brange\b|\bfrom\b/i.test(s);
  const isRevHeader  = (s) => /subtotal|gross|\bsales\b|revenue|payout|\btotal\b/i.test(s);

  const headerIdx = rows.findIndex(row => {
    const cells = row.map(c => String(c));
    return cells.some(isDateHeader) && cells.some(isRevHeader);
  });
  if (headerIdx === -1) {
    throw new Error('Could not find a header row with Date + revenue columns.');
  }

  const headers = rows[headerIdx].map(h => String(h).trim());
  const findCol = (predicate) => headers.findIndex(predicate);
  const dateCol = findCol(isDateHeader);
  const revCol  = findCol(isRevHeader);
  const ordCol  = findCol(s => /orders|transactions|\bcount\b/i.test(s));

  if (revCol === -1) {
    throw new Error('Could not find a revenue column (Subtotal, Gross Sales, Net Payout, etc.).');
  }

  const grouped = {};
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const dateStr = normalizeDate(row[dateCol]);
    if (!dateStr) continue;

    const revRaw = String(row[revCol] ?? '').replace(/[$,()\s]/g, '');
    const rev = parseFloat(revRaw) || 0;
    const ord = ordCol >= 0 ? (parseInt(row[ordCol]) || 0) : 1;

    if (!grouped[dateStr]) grouped[dateStr] = { revenue: 0, orders: 0 };
    grouped[dateStr].revenue += rev;
    grouped[dateStr].orders += ord;
  }
  return grouped;
}

// ─── PDF path ─────────────────────────────────────────────────────────────

async function parsePdf(arrayBuffer) {
  const lines = await extractPdfLines(arrayBuffer);

  // Try platform-specific monthly statement formats first. These return
  // monthly-aggregate data (one row per statement), not daily.
  const monthlyResult = tryMonthlyStatement(lines);
  if (monthlyResult) return { days: {}, months: monthlyResult };

  // Generic fallback: scan every line for date + dollar-amount patterns and
  // group by date. Works for transaction-list / daily-tabular PDFs.
  return { days: parseGenericPdfLines(lines), months: {} };
}

async function extractPdfLines(arrayBuffer) {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }

  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const byY = new Map();
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y).push({ x: item.transform[4], text: item.str });
    }
    // Page-relative sort: top-to-bottom (PDF y grows upward), then x ascending.
    // Pages are processed in order so the final `lines` preserves doc order.
    [...byY.entries()]
      .sort(([a], [b]) => b - a)
      .forEach(([, items]) => {
        items.sort((a, b) => a.x - b.x);
        lines.push(items.map(i => i.text).join(' '));
      });
  }
  return lines;
}

const MONTH_NAMES = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december',
];

/**
 * Detect platform-issued monthly statements (currently Uber Eats' "Monthly
 * Statement" / "Consolidated Monthly Summary" layout) and return the
 * statement's gross sales + order count + a full breakdown.
 *
 * The PDF exposes more than just sales — it also lists tips, sales tax, other
 * earnings, fees, marketing spends, amendments, and a final net payout. We
 * pull each of those into a `breakdown` sub-object so the UI can display the
 * full picture without changing the existing per-platform field semantics
 * (the headline `ubereats` value stays as Sales for consistency with daily
 * CSV imports that read a Subtotal column).
 *
 * Looks for:
 *  - a "Monthly Statement" or "Consolidated Monthly Summary" marker line
 *  - a line containing "<MonthName> <Year>" → derives YYYY-MM
 *  - the FIRST "Sales (N Orders) $X,XXX.XX" line (the consolidated total —
 *    subsequent occurrences are weekly payouts and would double-count)
 *  - labelled value lines: Tips, Tax on Sales, Other Earnings, Total
 *    Earnings, Total Uber Fees, Total Marketing Spends, Total Amendments,
 *    Net Total — each pulled by `findLabeledValue`.
 */
function tryMonthlyStatement(lines) {
  const text = lines.join(' \n ');
  const looksMonthly = /Monthly Statement|Consolidated Monthly Summary/i.test(text);
  if (!looksMonthly) return null;

  let month = null;
  for (const line of lines) {
    const m = line.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i
    );
    if (m) {
      const idx = MONTH_NAMES.indexOf(m[1].toLowerCase()) + 1;
      month = `${m[2]}-${String(idx).padStart(2, '0')}`;
      break;
    }
  }
  if (!month) return null;

  // Find the FIRST "Sales (N Orders) $X,XXX.XX" line (the consolidated total).
  let sales = null;
  let orders = null;
  for (const line of lines) {
    const m = line.match(/\bSales\b\s*\(\s*(\d+)\s*Orders?\s*\)\s*\$?([\d,]+\.\d{2})/i);
    if (m) {
      orders = parseInt(m[1], 10);
      sales  = parseFloat(m[2].replace(/,/g, ''));
      break;
    }
  }
  if (sales === null) return null;

  // From the same FIRST occurrence forward (the Consolidated Summary), pull
  // each labelled total. Restricting to the first section avoids picking up
  // the weekly-payout subtotals on later pages.
  const summarySlice = sliceConsolidatedSection(lines);

  const tips                 = findLabeledValue(summarySlice, 'Tips');
  const taxOnSales           = findLabeledValue(summarySlice, 'Tax on Sales');
  const taxOnContainerFees   = findLabeledValue(summarySlice, 'Tax on Container Fees');
  const taxOnOtherEarnings   = findLabeledValue(summarySlice, 'Tax on Other Earnings');
  const otherEarnings        = findLabeledValue(summarySlice, 'Other Earnings');
  const totalEarnings        = findLabeledValue(summarySlice, 'Total Earnings');
  const totalUberFees        = findLabeledValue(summarySlice, 'Total Uber Fees');
  const totalMarketingSpends = findLabeledValue(summarySlice, 'Total Marketing Spends');
  const totalAmendments      = findLabeledValue(summarySlice, 'Total Amendments');
  const netTotal             = findLabeledValue(summarySlice, 'Net Total');

  // Customer-collected tax (sales-side, not the platform's fees-side taxes).
  const customerTax =
    (taxOnSales         || 0) +
    (taxOnContainerFees || 0) +
    (taxOnOtherEarnings || 0);

  // All deductions combined as a positive number.
  const totalFees =
    Math.abs(totalUberFees        || 0) +
    Math.abs(totalMarketingSpends || 0) +
    Math.abs(totalAmendments      || 0);

  const breakdown = {
    sales,
    orders,
    tips:           tips           || 0,
    tax:            customerTax,
    otherEarnings:  otherEarnings  || 0,
    totalEarnings:  totalEarnings  || 0,
    fees:           totalFees,
    netPayout:      netTotal       || 0,
  };

  return { [month]: { revenue: sales, orders, breakdown } };
}

// From the first "Consolidated Monthly Summary" header, take lines until the
// next page's "Payouts received in the month" header (or end of doc). This
// scopes value extraction to the consolidated section and avoids picking up
// the weekly-payout subtotal lines that would otherwise overwrite the values.
function sliceConsolidatedSection(lines) {
  const startIdx = lines.findIndex(l => /Consolidated Monthly Summary/i.test(l));
  if (startIdx === -1) return lines;
  let endIdx = lines.findIndex((l, i) => i > startIdx && /Payouts received in the month/i.test(l));
  if (endIdx === -1) endIdx = lines.length;
  return lines.slice(startIdx, endIdx);
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Find a "Label $X,XXX.XX" or "Label -$X,XXX.XX" value on any line containing
// the label. Returns the rightmost currency value on that line as a signed
// number. Asterisks and trailing characters are tolerated.
function findLabeledValue(lines, label) {
  const labelRe = new RegExp(`\\b${escapeRegex(label)}\\b`, 'i');
  const valueRe = /(-)?\$(-?[\d,]+\.\d{2})/g;
  for (const line of lines) {
    if (!labelRe.test(line)) continue;
    const matches = [...line.matchAll(valueRe)];
    if (matches.length === 0) continue;
    const last = matches[matches.length - 1];
    const sign = (last[1] === '-' || last[2].startsWith('-')) ? -1 : 1;
    const num  = parseFloat(last[2].replace(/[-,]/g, ''));
    return sign * num;
  }
  return null;
}

function parseGenericPdfLines(lines) {
  const grouped = {};
  const datePattern = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/;
  const amountPattern = /\$?(\d{1,3}(?:,\d{3})*\.\d{2})/g;

  for (const line of lines) {
    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    const amountMatches = [...line.matchAll(amountPattern)];
    if (amountMatches.length === 0) continue;

    const dateStr = normalizeDate(dateMatch[1]);
    if (!dateStr) continue;

    const amounts = amountMatches.map(m => parseFloat(m[1].replace(/,/g, '')));
    const revenue = Math.max(...amounts);

    let leftover = line.replace(datePattern, ' ');
    amountMatches.forEach(m => { leftover = leftover.replace(m[0], ' '); });
    const intMatches = [...leftover.matchAll(/\b(\d{1,4})\b/g)].map(m => parseInt(m[1], 10));
    const orders = intMatches.find(n => n > 0 && n < 10000) ?? 1;

    if (!grouped[dateStr]) grouped[dateStr] = { revenue: 0, orders: 0 };
    grouped[dateStr].revenue += revenue;
    grouped[dateStr].orders += orders;
  }
  return grouped;
}

// ─── shared helpers ───────────────────────────────────────────────────────

function normalizeDate(raw) {
  if (raw == null || raw === '') return '';
  if (raw instanceof Date) return toISO(raw);

  if (typeof raw === 'number') {
    const ms = (raw - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? '' : toISO(d);
  }

  const str = String(raw).trim();
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const mdy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (mdy) {
    let [, m, d, y] = mdy;
    if (y.length === 2) y = (parseInt(y, 10) >= 50 ? '19' : '20') + y;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return toISO(parsed);
  return '';
}

function toISO(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

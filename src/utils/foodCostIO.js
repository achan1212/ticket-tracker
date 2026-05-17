// Food-cost importer: parses one of { image, CSV, XLSX } into a flat list of
// purchased-item rows. Each row is tagged with its source filename so the
// review UI can group rows back by file. All processing happens client-side;
// the Tesseract assets are bundled under /tesseract/ (see scripts/setup-tesseract.mjs).

import * as XLSX from 'xlsx';
import { createWorker } from 'tesseract.js';

let _uidCounter = 0;
function makeUid() {
  _uidCounter += 1;
  return `f-${Date.now().toString(36)}-${_uidCounter.toString(36)}`;
}

// Header-detection vocab. Lower-cased + trimmed before matching.
const NAME_HEADERS = ['item', 'description', 'product', 'name', 'sku', 'goods'];
const COST_HEADERS = ['total', 'amount', 'cost', 'price', 'subtotal', 'extended', 'line total', 'ext price'];
const QTY_HEADERS  = ['quantity', 'qty', 'count', 'units', 'pack'];
const UNIT_COST_HEADERS = ['unit cost', 'unit price', 'unitcost', 'unitprice', 'price each', 'each'];
const DATE_HEADERS = ['date', 'invoice date', 'order date', 'transaction date', 'posted', 'posted date'];

function findColumn(headers, candidates) {
  const lower = headers.map(h => String(h ?? '').toLowerCase().trim());
  // exact match first
  for (let i = 0; i < lower.length; i++) {
    if (candidates.includes(lower[i])) return i;
  }
  // contains match
  for (let i = 0; i < lower.length; i++) {
    if (candidates.some(c => lower[i] && lower[i].includes(c))) return i;
  }
  return -1;
}

// Normalize any of the common receipt / spreadsheet date forms into ISO
// YYYY-MM-DD. Returns null if the input doesn't look like a date or is
// outside a reasonable date window (1990–2100). Excel serial numbers (e.g.
// 45000) are handled too because xlsx surfaces them as raw numbers when the
// cell isn't formatted.
export function normalizeDate(input) {
  if (input == null) return null;
  if (input instanceof Date && !isNaN(input)) return toISO(input);

  // Excel serial number (days since 1899-12-30)
  if (typeof input === 'number' && Number.isFinite(input) && input > 20000 && input < 80000) {
    const ms = (input - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return isReasonable(d) ? toISO(d) : null;
  }

  const s = String(input).trim();
  if (!s) return null;

  // Already ISO-shaped
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isReasonable(d) ? toISO(d) : null;
  }

  // MM/DD/YYYY, M-D-YY, etc.
  m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let year = Number(m[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    const d = new Date(year, Number(m[1]) - 1, Number(m[2]));
    return isReasonable(d) ? toISO(d) : null;
  }

  // Mmm DD YYYY (e.g. "May 17, 2026" or "MAY 17 2026")
  m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (m) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const d = new Date(Number(m[3]), months.indexOf(m[1].toLowerCase()), Number(m[2]));
    return isReasonable(d) ? toISO(d) : null;
  }

  return null;
}

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function isReasonable(d) {
  if (!d || isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  return y >= 1990 && y <= 2100;
}

// Best-effort receipt date detection. Scans the first N OCR lines for any
// recognizable date form; returns the first hit. Receipts almost always put
// the date in the header.
export function detectReceiptDate(rawText) {
  if (!rawText) return null;
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 25);
  for (const line of lines) {
    const iso = normalizeDate(line);
    if (iso) return iso;
    // Also try sub-strings — many receipts inline a date inside a longer string.
    const numRe = /\b\d{1,4}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g;
    const monRe = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/gi;
    for (const candidate of [...line.matchAll(numRe), ...line.matchAll(monRe)]) {
      const got = normalizeDate(candidate[0]);
      if (got) return got;
    }
  }
  return null;
}

async function readWorkbook(file) {
  const isCsv = /\.(csv|tsv)$/i.test(file.name);
  if (isCsv) {
    const text = await file.text();
    return XLSX.read(text, { type: 'string' });
  }
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: 'array' });
}

function parseSpreadsheetRows(rows, sourceFile) {
  // Find the first row with a recognizable Item + (Cost or UnitCost) header.
  let headerIdx = -1;
  let nameCol = -1;
  let costCol = -1;
  let unitCol = -1;
  let qtyCol  = -1;
  let dateCol = -1;

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const r = rows[i];
    const n  = findColumn(r, NAME_HEADERS);
    const c  = findColumn(r, COST_HEADERS);
    const u  = findColumn(r, UNIT_COST_HEADERS);
    if (n >= 0 && (c >= 0 || u >= 0)) {
      headerIdx = i;
      nameCol = n;
      costCol = c;
      unitCol = u;
      qtyCol  = findColumn(r, QTY_HEADERS);
      dateCol = findColumn(r, DATE_HEADERS);
      break;
    }
  }

  if (headerIdx === -1) {
    throw new Error('Could not detect "Item" and "Cost/Price" columns in the spreadsheet headers.');
  }

  // Try to surface a single representative date for the whole upload: scan
  // for the first non-empty value in the date column (if any), then for any
  // header-area cell that looks like a date.
  let detectedDate = null;
  if (dateCol >= 0) {
    for (let i = headerIdx + 1; i < Math.min(rows.length, headerIdx + 30); i++) {
      const iso = normalizeDate(rows[i]?.[dateCol]);
      if (iso) { detectedDate = iso; break; }
    }
  }
  if (!detectedDate) {
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      for (const cell of rows[i] || []) {
        const iso = normalizeDate(cell);
        if (iso) { detectedDate = iso; break; }
      }
      if (detectedDate) break;
    }
  }

  const items = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const name = String(r[nameCol] ?? '').trim();
    if (!name) continue;
    // Skip totals/footer rows
    if (/^(grand\s+)?(total|subtotal|tax|sum)$/i.test(name)) continue;

    const qtyRaw  = qtyCol  >= 0 ? r[qtyCol]  : undefined;
    const costRaw = costCol >= 0 ? r[costCol] : undefined;
    const unitRaw = unitCol >= 0 ? r[unitCol] : undefined;

    const qty = Number.isFinite(parseFloat(qtyRaw)) ? Math.max(1, Math.round(parseFloat(qtyRaw))) : 1;

    // Prefer explicit unit cost when present; otherwise derive from total/qty.
    let unitCost;
    if (Number.isFinite(parseFloat(unitRaw))) {
      unitCost = parseFloat(unitRaw);
    } else if (Number.isFinite(parseFloat(costRaw))) {
      unitCost = parseFloat(costRaw) / qty;
    } else {
      continue;
    }
    if (!Number.isFinite(unitCost) || unitCost <= 0) continue;

    items.push({
      _uid: makeUid(),
      name,
      cost: Math.round(unitCost * 100) / 100,
      quantity: qty,
      sourceFile,
    });
  }
  return { items, detectedDate };
}

async function parseSpreadsheet(file) {
  const wb = await readWorkbook(file);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error('Spreadsheet has no sheets.');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  return parseSpreadsheetRows(rows, file.name);
}

// Receipt OCR. Matches typical grocery-receipt lines:
//   "ORGANIC BANANAS      4.99"
//   "2 MILK 1GAL          7.98"
// Also strips totals/tax/payment lines.
function parseReceiptText(rawText, sourceFile) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const items = [];
  const priceAtEndRe = /\$?\s*(-?\d+\.\d{2})\s*[A-Z]?\s*$/;   // 4.99 or 4.99 F (food code)
  const qtyPrefixRe  = /^(\d{1,3})\s+(?=\S)/;
  const skipRe = /\b(subtotal|sub\s*total|grand\s*total|^total$|tax|tender|cash|debit|credit|change|balance|amount\s+due|visa|mastercard|amex|tip|gratuity|loyalty|reward|points|savings|coupon|discount)\b/i;

  for (const line of lines) {
    if (skipRe.test(line)) continue;

    const m = line.match(priceAtEndRe);
    if (!m) continue;
    const cost = parseFloat(m[1]);
    if (!Number.isFinite(cost) || cost <= 0) continue;

    let name = line.replace(priceAtEndRe, '').trim();

    // Strip a leading quantity like "2 " — but only if small (avoid SKU codes).
    let quantity = 1;
    const qm = name.match(qtyPrefixRe);
    if (qm) {
      const q = parseInt(qm[1], 10);
      if (q > 0 && q <= 99) {
        quantity = q;
        name = name.replace(qtyPrefixRe, '').trim();
      }
    }

    // Trim stray punctuation/symbols on the ends.
    name = name.replace(/^[-–—|:.\s]+|[-–—|:.\s]+$/g, '').trim();
    if (name.length < 2) continue;

    items.push({
      _uid: makeUid(),
      name,
      cost: Math.round((cost / quantity) * 100) / 100,
      quantity,
      sourceFile,
    });
  }
  return items;
}

async function parseImage(file, onProgress) {
  const worker = await createWorker('eng', 1, {
    workerPath: `${import.meta.env.BASE_URL}tesseract/worker.min.js`,
    corePath:   `${import.meta.env.BASE_URL}tesseract`,
    langPath:   `${import.meta.env.BASE_URL}tesseract`,
    gzip: true,
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  await worker.setParameters({ tessedit_pageseg_mode: '6' });
  const { data: { text } } = await worker.recognize(file);
  await worker.terminate();
  return { text, items: parseReceiptText(text, file.name) };
}

// Public API. Returns { fileName, items, detectedDate?, rawText? }. Throws on
// unsupported file type or unparseable spreadsheet headers.
//   detectedDate: ISO YYYY-MM-DD parsed from OCR text or a date column. The
//   FoodCostTab UI uses it as the default for its per-file date picker.
export async function parseFoodCostFile(file, onProgress) {
  const lower = file.name.toLowerCase();

  if (file.type.startsWith('image/')) {
    const { text, items } = await parseImage(file, onProgress);
    return { fileName: file.name, items, detectedDate: detectReceiptDate(text), rawText: text };
  }
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const { items, detectedDate } = await parseSpreadsheet(file);
    return { fileName: file.name, items, detectedDate };
  }
  throw new Error(`Unsupported file type: ${file.name}`);
}

// Flatten the per-file results into a single export row set.
export function flattenForExport(fileGroups) {
  const out = [];
  for (const g of fileGroups) {
    for (const item of g.items) {
      out.push({
        name: item.name,
        cost: item.cost,
        quantity: item.quantity,
        sourceFile: item.sourceFile,
      });
    }
  }
  return out;
}

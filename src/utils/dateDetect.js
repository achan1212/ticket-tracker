// Date detection shared between the food cost importer and the order scanner.
// Both consume OCR text (or a spreadsheet cell) and need a single canonical
// ISO date for downstream date-keyed stores.

// Normalize an input into ISO YYYY-MM-DD. Returns null when no recognizable
// date can be parsed or when the resulting year is outside 1990–2100.
// Handles: ISO strings, MM/DD/YYYY (and YY variants), "Mmm DD, YYYY",
// JavaScript Date objects, and Excel serial day numbers.
export function normalizeDate(input) {
  if (input == null) return null;
  if (input instanceof Date && !isNaN(input)) return toISO(input);

  // Excel serial number (days since 1899-12-30).
  if (typeof input === 'number' && Number.isFinite(input) && input > 20000 && input < 80000) {
    const ms = (input - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return isReasonable(d) ? toISO(d) : null;
  }

  const s = String(input).trim();
  if (!s) return null;

  // Already ISO-shaped.
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

  // "May 17, 2026" / "MAY 17 2026".
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

// Best-effort receipt date detection. Scans the first 25 OCR lines for any
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

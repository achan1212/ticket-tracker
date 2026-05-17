import { useState, useCallback } from 'react';
import { createWorker } from 'tesseract.js';

// Stable id for each item — drives drag-and-drop ordering and edit/remove
// lookups in ResultsTable. Doesn't need to be cryptographically random,
// just collision-free within a session.
function makeUid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parses raw OCR text into structured items.
 * Tries the 3-column "Sold Item Report" parser first (it requires both an int
 * QTY and a decimal AMT, so it won't fire on simple receipts). Falls back to
 * single-price-per-line receipt parsing when no report rows are found.
 */
function parseOrderText(rawText) {
  // Treat surviving cell-border glyphs as whitespace so the row regex isn't
  // blocked by `Blue cheese | 3 | 1 50` style noise.
  const lines = rawText.split('\n')
    .map(l => l.replace(/[\[\]|]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const reportItems = parseReport(lines);
  return reportItems.length > 0 ? reportItems : parseReceipt(lines);
}

/**
 * 3-column report rows: "<name>  <qty integer>  <amt decimal>"
 * Stores cost as unit price (amt / qty) so cost * quantity == line total.
 */
function parseReport(lines) {
  const items = [];
  const seen = new Set();
  // Allow commas in amounts (OCR sometimes inserts them in large numbers).
  const rowReDecimal = /^(.+?)\s+(\d{1,5})\s+\$?\s*([\d,]{1,9}\.\d{2})\s*$/;
  // Fallback when OCR drops the decimal point: "Foo 20 24375" → amt 243.75
  // Requires 3+ digit amount so we don't misread a tiny stray pair of digits.
  const rowReNoDecimal = /^(.+?)\s+(\d{1,5})\s+\$?\s*(\d{3,9})\s*$/;

  for (const line of lines) {
    if (/sold\s+item\s+report/i.test(line)) continue;
    if (/^name\b.*\b(qnt|qty)\b/i.test(line)) continue;
    if (/run\s+at/i.test(line)) continue;
    if (/employees?\s+together/i.test(line)) continue;

    let m = line.match(rowReDecimal);
    let amtStr;
    if (m) {
      amtStr = m[3].replace(/,/g, '');
    } else {
      m = line.match(rowReNoDecimal);
      if (!m) continue;
      const raw = m[3];
      amtStr = `${raw.slice(0, -2)}.${raw.slice(-2)}`;
    }

    const name = m[1].trim().replace(/^[-–—|:]+|[-–—|:]+$/g, '').trim();
    const qty = parseInt(m[2], 10);
    const amt = parseFloat(amtStr);

    if (!name || name.length < 2) continue;
    if (qty < 1 || !Number.isFinite(amt) || amt <= 0) continue;

    const key = `${name.toLowerCase()}|${qty}|${amt}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const unit = Math.round((amt / qty) * 100) / 100;
    items.push({ _uid: makeUid('s'), name, cost: unit, quantity: qty, addedAt: new Date().toISOString(), source: 'scanned' });
  }
  return items;
}

function parseReceipt(lines) {
  const items = [];
  const priceRe = /\$?\s*(\d+\.\d{2})/;
  const qtyRe = /^(\d+)\s*[xX×]?\s+/;

  for (const line of lines) {
    const priceMatch = line.match(priceRe);
    if (!priceMatch) continue;

    const cost = parseFloat(priceMatch[1]);
    let nameRaw = line.replace(priceRe, '').replace(/\$/, '').trim();

    let quantity = 1;
    const qtyMatch = nameRaw.match(qtyRe);
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1], 10);
      nameRaw = nameRaw.replace(qtyRe, '').trim();
    }

    const name = nameRaw.replace(/^[-–—|:]+|[-–—|:]+$/g, '').trim();
    if (name.length < 2) continue;
    if (cost === 0) continue;

    items.push({ _uid: makeUid('s'), name, cost, quantity, addedAt: new Date().toISOString(), source: 'scanned' });
  }
  return items;
}

// Tesseract works best on text 30-50px tall. Narrow images get upscaled, and
// very tall images get sliced because Tesseract internally caps image
// dimension and would otherwise downscale characters into unreadable mush.
// Each chunk extends a little into the next so rows that fall on a chunk
// boundary aren't truncated; duplicates are deduped by parseReport.
//
// The pipeline auto-adapts to the source:
//  - Already-large images (>= MIN_OCR_WIDTH) are scanned at native size.
//  - Tiny inputs are upscaled to a useful character height but capped at
//    MAX_SCALE so a 200-px thumbnail can't blow up to 3000×4500.
//  - Images that fit in one chunk only run one OCR pass.
//  - removeLines is a no-op on images without cell-rule lines, so receipts
//    without borders aren't affected.
const MIN_OCR_WIDTH = 3000;
const MAX_SCALE = 6;
const MAX_CHUNK_HEIGHT = 1200;
const CHUNK_OVERLAP_PX = 100;

// Characters allowed in OCR output. Includes the punctuation that actually
// appears on real-world receipts (`*` `!` `?` `@` `;` etc.) and excludes only
// the shape-collision characters Tesseract hallucinates from cell-rule lines.
const OCR_WHITELIST =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,()-/+&'\"$#%:;!?@*";

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

/**
 * Converts a canvas to clean black-on-white. Picks the threshold from the
 * canvas's own average brightness so it adapts to dark-mode / light-mode
 * screenshots. Crushes the faint cell-border lines to white so Tesseract
 * stops reading them as `|`, `]`, `I` glyphs.
 */
function binarize(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  let sum = 0;
  const pixelCount = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  const avg = sum / pixelCount;
  // Bias slightly below average so light-gray rule lines flip to white.
  const threshold = avg * 0.85;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = gray > threshold ? 255 : 0;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Erases long thin dark runs (cell-border rules) from a binarized canvas.
 * A "line" is a contiguous dark run whose length is >= 5% of the chunk size
 * along its axis and whose perpendicular thickness stays <= 5 px throughout.
 * This deletes vertical column dividers and horizontal row dividers without
 * touching characters (which fail the thinness check).
 */
function removeLines(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const erase = new Uint8Array(w * h);
  const isDark = (x, y) => d[(y * w + x) * 4] === 0;

  // Lines must be clearly taller/wider than any individual character glyph so
  // we never accidentally erase the stems of letters like `1`, `l`, `I`. After
  // upscaling, a row of text is ~140 px tall, so we require lines ≥ 200 px.
  const vMinHeight = Math.max(200, Math.floor(h * 0.15));
  const hMinWidth = Math.max(400, Math.floor(w * 0.25));
  const maxThick = 8;

  for (let x = 0; x < w; x++) {
    let runStart = -1;
    for (let y = 0; y <= h; y++) {
      const dark = y < h && isDark(x, y);
      if (dark && runStart === -1) runStart = y;
      else if (!dark && runStart !== -1) {
        const runLen = y - runStart;
        if (runLen >= vMinHeight) {
          let thinEverywhere = true;
          for (let sy = runStart; sy < runStart + runLen; sy += 40) {
            let thick = 1;
            for (let nx = x + 1; nx < Math.min(w, x + maxThick + 1); nx++) {
              if (isDark(nx, sy)) thick++; else break;
            }
            if (thick > maxThick) { thinEverywhere = false; break; }
          }
          if (thinEverywhere) {
            for (let ey = runStart; ey < y; ey++) erase[ey * w + x] = 1;
          }
        }
        runStart = -1;
      }
    }
  }

  for (let y = 0; y < h; y++) {
    let runStart = -1;
    for (let x = 0; x <= w; x++) {
      const dark = x < w && isDark(x, y);
      if (dark && runStart === -1) runStart = x;
      else if (!dark && runStart !== -1) {
        const runLen = x - runStart;
        if (runLen >= hMinWidth) {
          let thinEverywhere = true;
          for (let sx = runStart; sx < runStart + runLen; sx += 40) {
            let thick = 1;
            for (let ny = y + 1; ny < Math.min(h, y + maxThick + 1); ny++) {
              if (isDark(sx, ny)) thick++; else break;
            }
            if (thick > maxThick) { thinEverywhere = false; break; }
          }
          if (thinEverywhere) {
            for (let ex = runStart; ex < x; ex++) erase[y * w + ex] = 1;
          }
        }
        runStart = -1;
      }
    }
  }

  for (let i = 0; i < erase.length; i++) {
    if (erase[i]) {
      const idx = i * 4;
      d[idx] = 255; d[idx + 1] = 255; d[idx + 2] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Lazy chunk producer — returns the source image plus a `makeChunk(i)` factory
 * that builds, binarizes, and de-rules a single chunk on demand. The scan loop
 * disposes each canvas before allocating the next so memory stays constant
 * regardless of chunk count.
 */
async function prepareChunkPlan(file) {
  const img = await loadImage(file);
  const rawScale = img.width < MIN_OCR_WIDTH ? MIN_OCR_WIDTH / img.width : 1;
  const scale = Math.min(rawScale, MAX_SCALE);
  const dstW = Math.round(img.width * scale);
  const totalDstH = Math.round(img.height * scale);

  const chunkCount = Math.max(1, Math.ceil(totalDstH / MAX_CHUNK_HEIGHT));
  const srcChunkH = img.height / chunkCount;
  const srcOverlap = CHUNK_OVERLAP_PX / scale;

  const makeChunk = (i) => {
    const srcY = Math.floor(i * srcChunkH);
    let srcH = Math.ceil(srcChunkH);
    if (i < chunkCount - 1) srcH += srcOverlap;
    const realSrcH = Math.min(img.height - srcY, Math.ceil(srcH));
    const dstH = Math.round(realSrcH * scale);

    const c = document.createElement('canvas');
    c.width = dstW;
    c.height = dstH;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, srcY, img.width, realSrcH, 0, 0, dstW, dstH);
    binarize(c);
    removeLines(c);
    return c;
  };

  return { chunkCount, makeChunk };
}

export function useOrderScan() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [rawText, setRawText] = useState('');
  const [chunkIndex, setChunkIndex] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);

  const scan = useCallback(async (file) => {
    setLoading(true);
    setError(null);
    setResults(null);
    setProgress(0);
    setRawText('');
    setChunkIndex(0);
    setChunkCount(0);

    let currentChunk = 0;
    let totalChunks = 1;

    try {
      const { chunkCount: planChunks, makeChunk } = await prepareChunkPlan(file);
      totalChunks = planChunks;
      setChunkCount(totalChunks);

      // All assets are bundled under /tesseract/ (see scripts/setup-tesseract.mjs)
      // so OCR runs fully offline — no network requests at runtime.
      const worker = await createWorker('eng', 1, {
        workerPath: `${import.meta.env.BASE_URL}tesseract/worker.min.js`,
        corePath: `${import.meta.env.BASE_URL}tesseract`,
        langPath: `${import.meta.env.BASE_URL}tesseract`,
        gzip: true,
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const overall = (currentChunk + m.progress) / totalChunks;
            setProgress(Math.round(overall * 100));
          }
        }
      });

      // PSM 6 = "Assume a single uniform block of text" — best for receipts /
      // tabular reports where auto-segmentation otherwise over-fragments rows.
      // Whitelist forces Tesseract to skip cell-border-like shapes instead of
      // spelling them out as `|`, `]`, `_` glyphs.
      await worker.setParameters({
        tessedit_pageseg_mode: '6',
        tessedit_char_whitelist: OCR_WHITELIST,
      });

      let combinedText = '';
      for (let i = 0; i < totalChunks; i++) {
        currentChunk = i;
        setChunkIndex(i + 1);
        let canvas = makeChunk(i);
        const { data: { text } } = await worker.recognize(canvas);
        // Free the chunk bitmap before allocating the next one.
        canvas.width = 0;
        canvas.height = 0;
        canvas = null;
        combinedText += (combinedText ? '\n' : '') + text;
      }
      await worker.terminate();

      setRawText(combinedText);
      const items = parseOrderText(combinedText);

      if (items.length === 0) {
        setError('No items with prices found. Try a clearer image or adjust the scan area.');
      } else {
        setResults(items);
      }
    } catch (err) {
      setError('OCR failed. Please try again with a clearer image.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResults(null);
    setError(null);
    setRawText('');
    setProgress(0);
    setChunkIndex(0);
    setChunkCount(0);
  }, []);

  return { scan, results, loading, progress, error, rawText, reset, chunkIndex, chunkCount };
}

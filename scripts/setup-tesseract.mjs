#!/usr/bin/env node
// Materializes Tesseract.js assets into public/tesseract/ so OCR runs fully
// offline at runtime. Copies the worker + LSTM wasm cores from node_modules
// and downloads eng.traineddata.gz once (skipped if already present).
//
// Run manually with: npm run setup-ocr
// Also wired into prebuild so Netlify regenerates anything missing.

import { mkdir, copyFile, access, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dest = join(root, 'public', 'tesseract');

const COPY = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm', 'tesseract-core-lstm.wasm'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm', 'tesseract-core-simd-lstm.wasm'],
];

// LSTM-only quantized model — matches tesseract.js's own default when OEM=1.
// ~half the size of the full 4.0.0 model since we never use the legacy engine.
const LANG_URL = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz';
const LANG_FILE = 'eng.traineddata.gz';

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function main() {
  await mkdir(dest, { recursive: true });

  for (const [src, name] of COPY) {
    const abs = join(root, src);
    if (!(await exists(abs))) {
      throw new Error(`missing ${src} — run npm install first`);
    }
    await copyFile(abs, join(dest, name));
    console.log(`copied ${name}`);
  }

  const langPath = join(dest, LANG_FILE);
  if (await exists(langPath)) {
    const { size } = await stat(langPath);
    console.log(`${LANG_FILE} already present (${(size / 1024 / 1024).toFixed(1)} MB)`);
    return;
  }

  console.log(`downloading ${LANG_FILE} ...`);
  const res = await fetch(LANG_URL);
  if (!res.ok || !res.body) {
    throw new Error(`download failed: ${res.status} ${res.statusText}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(langPath));
  const { size } = await stat(langPath);
  console.log(`downloaded ${LANG_FILE} (${(size / 1024 / 1024).toFixed(1)} MB)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

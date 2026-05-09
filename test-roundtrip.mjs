import { exportToXlsx, importFromXlsx } from './src/utils/sheetIO.js';
import { write, read, utils } from 'xlsx';

// Mock writeFile so we don't pollute the cwd
const writtenBuffers = [];
import * as XLSX from 'xlsx';
const originalWriteFile = XLSX.writeFile;
XLSX.writeFile = (wb, name) => {
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  writtenBuffers.push({ name, buf });
};

// Case 1: only manual months
const months = {
  '2026-04': {
    month: '2026-04', deliveryRevenue: 1000, pickupRevenue: 500,
    deliveryOrders: 20, pickupOrders: 10,
    doordash: 0, ubereats: 0, grubhub: 0,
    doordashOrders: 0, ubereatsOrders: 0, grubhubOrders: 0,
    categories: {}, notes: 'manual entry'
  },
};

exportToXlsx([], {}, months);
console.log('Files written:', writtenBuffers.map(w => w.name));
const fileBlob = new Blob([writtenBuffers[0].buf]);

// Hack: importFromXlsx uses FileReader; emulate it
class FakeFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(ab => {
      this.result = ab;
      this.onload({ target: this });
    }).catch(err => this.onerror(err));
  }
}
globalThis.FileReader = FakeFileReader;

const result = await importFromXlsx(fileBlob);
console.log('\n=== Round-trip result ===');
console.log('Days:', result.days);
console.log('Months:', JSON.stringify(result.months, null, 2));
console.log('\nMonth source flag:', result.months[0]?.source);

// Case 2: simulate Excel auto-converting the period to a date number
console.log('\n=== Date-number coercion test ===');
const ws = utils.aoa_to_sheet([
  ['Exported: x'], [],
  ['Month', 'Total Revenue', 'Delivery Revenue', 'Notes', 'Source'],
  // Excel serial 46113 ≈ 2026-04-01
  [46113, 1500, 1000, 'auto-converted', 'Manual'],
]);
const wb = utils.book_new();
utils.book_append_sheet(wb, ws, 'Monthly Summary');
const buf = write(wb, { type: 'buffer', bookType: 'xlsx' });
const fb2 = new Blob([buf]);
const r2 = await importFromXlsx(fb2);
console.log('Recovered period:', r2.months[0]?.month, '— source:', r2.months[0]?.source);

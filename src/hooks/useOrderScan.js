import { useState, useCallback } from 'react';
import { createWorker } from 'tesseract.js';

/**
 * Parses raw OCR text from an order ticket into structured items.
 * Looks for lines containing a price pattern and tries to extract quantity + name.
 */
function parseOrderText(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const items = [];

  // Regex to find a price anywhere in the line: $9.99 or 9.99
  const priceRe = /\$?\s*(\d+\.\d{2})/;
  // Regex to find a leading quantity: "2x", "2 x", "x2", "2 "
  const qtyRe = /^(\d+)\s*[xX×]?\s+/;

  for (const line of lines) {
    const priceMatch = line.match(priceRe);
    if (!priceMatch) continue;

    const cost = parseFloat(priceMatch[1]);

    // Remove the price portion from the line to isolate the item name
    let nameRaw = line.replace(priceRe, '').replace(/\$/, '').trim();

    // Try to extract a leading quantity
    let quantity = 1;
    const qtyMatch = nameRaw.match(qtyRe);
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1], 10);
      nameRaw = nameRaw.replace(qtyRe, '').trim();
    }

    // Clean up stray punctuation/symbols from the name
    const name = nameRaw.replace(/^[-–—|:]+|[-–—|:]+$/g, '').trim();

    if (name.length < 2) continue; // skip junk lines
    if (cost === 0) continue;      // skip zero-cost lines (likely headers)

    items.push({ name, cost, quantity, addedAt: new Date().toISOString(), source: 'scanned' });
  }

  return items;
}

export function useOrderScan() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [rawText, setRawText] = useState('');

  const scan = useCallback(async (file) => {
    setLoading(true);
    setError(null);
    setResults(null);
    setProgress(0);
    setRawText('');

    try {
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        }
      });

      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      setRawText(text);
      const items = parseOrderText(text);

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
  }, []);

  return { scan, results, loading, progress, error, rawText, reset };
}

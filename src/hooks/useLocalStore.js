import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Versioned localStorage-backed state. Used by feature stores that need
 * data to survive page reloads (food cost imports, scanned items, etc.).
 *
 *   const [items, setItems, ready] = useLocalStore('foodcost', { version: 1, initial: [] });
 *
 * Reads happen lazily on mount (via useState init). Writes are debounced one
 * tick so a burst of updates doesn't thrash localStorage. The hook handles
 * private-browsing / quota errors silently — the value still lives in memory.
 *
 * `version` is stamped onto the stored payload. If the schema needs to change
 * later, bump version + provide `migrate(prev, prevVersion)`; mismatches with
 * no migrator fall back to `initial`.
 */
export function useLocalStore(namespace, { version = 1, initial = null, migrate } = {}) {
  const storageKey = `ticket-tracker:${namespace}`;
  const [value, setValueState] = useState(() => readFromStorage(storageKey, version, initial, migrate));
  const [ready, setReady] = useState(true);
  const writeTimer = useRef(null);
  const latestValue = useRef(value);

  useEffect(() => {
    latestValue.current = value;
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      writeToStorage(storageKey, version, latestValue.current);
    }, 50);
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, [value, storageKey, version]);

  // Flush synchronously when the tab is hidden / closed so an unmount doesn't
  // race the pending write.
  useEffect(() => {
    const flush = () => writeToStorage(storageKey, version, latestValue.current);
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [storageKey, version]);

  const setValue = useCallback((next) => {
    setValueState((prev) => (typeof next === 'function' ? next(prev) : next));
  }, []);

  return [value, setValue, ready];
}

function readFromStorage(key, version, initial, migrate) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return initial;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'v' in parsed && 'data' in parsed) {
      if (parsed.v === version) return parsed.data;
      if (typeof migrate === 'function') {
        try {
          const migrated = migrate(parsed.data, parsed.v);
          return migrated === undefined ? initial : migrated;
        } catch {
          return initial;
        }
      }
      return initial;
    }
    // Legacy payload (no envelope) — treat as initial; next write rebuilds it.
    return initial;
  } catch {
    return initial;
  }
}

function writeToStorage(key, version, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ v: version, data }));
  } catch {
    /* quota / private browsing — value still lives in memory */
  }
}

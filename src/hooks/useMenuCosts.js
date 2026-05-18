import { useCallback } from 'react';
import { useLocalStore } from './useLocalStore.js';

/**
 * Per-item food-cost percentages, keyed by item name.
 *
 *   { "Sliders": 30, "Tacos": 32, ... }
 *
 * Values are stored as percentages (0–100), not decimals. When an item has
 * no explicit entry, callers fall back to the global default that comes
 * from the food-cost import vs. revenue ratio (see useFoodCostStore +
 * totalRevenueAcrossPeriods in menuAggregation).
 */
export function useMenuCosts() {
  const [costs, setCosts] = useLocalStore('menu-item-costs', { version: 1, initial: {} });

  const setItemCost = useCallback((name, pct) => {
    const key = String(name || '').trim();
    if (!key) return;
    setCosts(prev => {
      const next = { ...prev };
      if (pct == null || !Number.isFinite(pct)) delete next[key];
      else next[key] = Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
      return next;
    });
  }, [setCosts]);

  const clearItemCost = useCallback((name) => {
    setCosts(prev => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, [setCosts]);

  return { costs, setItemCost, clearItemCost };
}

import { useCallback, useMemo } from 'react';
import { useLocalStore } from './useLocalStore.js';

/**
 * Persisted food-cost imports keyed by file group.
 *
 * Group shape:
 *   {
 *     id, name, date,                       // date = ISO YYYY-MM-DD (user-overridable)
 *     status: 'done' | 'processing' | 'error',
 *     items: [{ _uid, name, cost, quantity, sourceFile }],
 *     detectedDate?, error?, importedAt
 *   }
 *
 * Surfaces two derived views the summary cards consume:
 *   - foodCostByDay:   { 'YYYY-MM-DD': numberCents... }
 *   - foodCostByMonth: { 'YYYY-MM':    numberCents... }
 *
 * Processing/error groups are kept in the store too so the FoodCostTab can
 * resume showing them after a reload, but they're skipped by the derived
 * totals (only `status === 'done'` rows count).
 */
export function useFoodCostStore() {
  const [groups, setGroups] = useLocalStore('foodcost-groups', {
    version: 1,
    initial: [],
  });

  const upsertGroup = useCallback((group) => {
    setGroups(prev => {
      const idx = prev.findIndex(g => g.id === group.id);
      if (idx === -1) return [...prev, group];
      const next = prev.slice();
      next[idx] = { ...next[idx], ...group };
      return next;
    });
  }, [setGroups]);

  const patchGroup = useCallback((id, patch) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g));
  }, [setGroups]);

  const removeGroup = useCallback((id) => {
    setGroups(prev => prev.filter(g => g.id !== id));
  }, [setGroups]);

  const updateItems = useCallback((id, items) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, items } : g));
  }, [setGroups]);

  const setGroupDate = useCallback((id, date) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, date } : g));
  }, [setGroups]);

  const clearAll = useCallback(() => setGroups([]), [setGroups]);

  const { foodCostByDay, foodCostByMonth } = useMemo(() => {
    const byDay = {};
    const byMonth = {};
    for (const g of groups) {
      if (g.status !== 'done' || !g.date) continue;
      const dayKey = g.date;
      const monthKey = g.date.slice(0, 7);
      const groupTotal = g.items.reduce((s, i) => s + i.cost * i.quantity, 0);
      byDay[dayKey]   = (byDay[dayKey]   || 0) + groupTotal;
      byMonth[monthKey] = (byMonth[monthKey] || 0) + groupTotal;
    }
    return { foodCostByDay: byDay, foodCostByMonth: byMonth };
  }, [groups]);

  return {
    groups,
    upsertGroup,
    patchGroup,
    removeGroup,
    updateItems,
    setGroupDate,
    clearAll,
    foodCostByDay,
    foodCostByMonth,
  };
}

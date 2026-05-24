import { useCallback, useMemo } from 'react';
import { useLocalStore } from './useLocalStore.js';

/**
 * Persisted operating costs — actual labor and fixed-cost line items the user
 * enters per month. The P&L and Dashboard prefer these actuals over the
 * pl-targets percentage estimates when present, with the same fallback
 * pattern as foodCostByMonth.
 *
 * Shape:
 *   {
 *     labor: { 'YYYY-MM': number },                                    // single monthly total
 *     fixed: { 'YYYY-MM': [{ id, category, amount, notes }, ...] },    // line items per month
 *   }
 */
const INITIAL = { labor: {}, fixed: {} };

function freshId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `fc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useOperatingCostsStore() {
  const [data, setData] = useLocalStore('operating-costs', {
    version: 1,
    initial: INITIAL,
  });

  const setLaborForMonth = useCallback((month, amount) => {
    const safe = Number(amount) || 0;
    setData(prev => ({
      ...(prev || INITIAL),
      labor: { ...((prev || INITIAL).labor || {}), [month]: safe > 0 ? safe : 0 },
    }));
  }, [setData]);

  const addFixedCost = useCallback((month, item) => {
    setData(prev => {
      const base = prev || INITIAL;
      const existing = (base.fixed || {})[month] || [];
      return {
        ...base,
        fixed: {
          ...(base.fixed || {}),
          [month]: [...existing, { id: freshId(), ...item }],
        },
      };
    });
  }, [setData]);

  const updateFixedCost = useCallback((month, id, patch) => {
    setData(prev => {
      const base = prev || INITIAL;
      const existing = (base.fixed || {})[month] || [];
      return {
        ...base,
        fixed: {
          ...(base.fixed || {}),
          [month]: existing.map(it => it.id === id ? { ...it, ...patch } : it),
        },
      };
    });
  }, [setData]);

  const removeFixedCost = useCallback((month, id) => {
    setData(prev => {
      const base = prev || INITIAL;
      const existing = (base.fixed || {})[month] || [];
      return {
        ...base,
        fixed: {
          ...(base.fixed || {}),
          [month]: existing.filter(it => it.id !== id),
        },
      };
    });
  }, [setData]);

  const clearAll = useCallback(() => setData(INITIAL), [setData]);

  const { laborByMonth, fixedByMonth } = useMemo(() => {
    const base = data || INITIAL;
    const lab = base.labor || {};
    const fix = base.fixed || {};
    const fixedByMonth = {};
    for (const [month, items] of Object.entries(fix)) {
      fixedByMonth[month] = (items || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    }
    return { laborByMonth: lab, fixedByMonth };
  }, [data]);

  return {
    data: data || INITIAL,
    laborByMonth,
    fixedByMonth,
    setLaborForMonth,
    addFixedCost,
    updateFixedCost,
    removeFixedCost,
    clearAll,
  };
}

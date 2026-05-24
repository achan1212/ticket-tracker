import { useCallback } from 'react';
import { useLocalStore } from './useLocalStore.js';

export function useMonthlyStore() {
  // Persisted to localStorage so monthly entries survive reloads.
  const [months, setMonths] = useLocalStore('months', { version: 1, initial: {} });

  const upsertMonth = useCallback((month, updates) => {
    setMonths(prev => ({
      ...prev,
      [month]: {
        month,
        deliveryRevenue: 0,
        pickupRevenue: 0,
        deliveryOrders: 0,
        pickupOrders: 0,
        doordash: 0, ubereats: 0, grubhub: 0,
        doordashOrders: 0, ubereatsOrders: 0, grubhubOrders: 0,
        categories: {},
        notes: '',
        ...(prev[month] || {}),
        ...updates,
      },
    }));
  }, [setMonths]);

  const removeMonth = useCallback((month) => {
    setMonths(prev => {
      const next = { ...prev };
      delete next[month];
      return next;
    });
  }, [setMonths]);

  return { months, upsertMonth, removeMonth };
}

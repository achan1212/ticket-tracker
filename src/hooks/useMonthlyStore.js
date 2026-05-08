import { useState, useCallback } from 'react';

export function useMonthlyStore() {
  const [months, setMonths] = useState({});

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
  }, []);

  const removeMonth = useCallback((month) => {
    setMonths(prev => {
      const next = { ...prev };
      delete next[month];
      return next;
    });
  }, []);

  return { months, upsertMonth, removeMonth };
}

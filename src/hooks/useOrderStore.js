import { useCallback } from 'react';
import { useLocalStore } from './useLocalStore.js';

// Daily record shape:
// {
//   date: 'YYYY-MM-DD',
//   deliveryRevenue: 0,
//   pickupRevenue: 0,
//   deliveryOrders: 0,
//   pickupOrders: 0,
//   // 3rd party platform sales (tracked separately)
//   doordash: 0, ubereats: 0, grubhub: 0,
//   doordashOrders: 0, ubereatsOrders: 0, grubhubOrders: 0,
//   categories: {}, // Revenue breakdown by food category: { 'Pizza': 1200, 'Pasta': 800, etc. }
//   notes: ''
// }

export function useOrderStore() {
  // Persisted to localStorage so daily entries survive reloads.
  const [days, setDays] = useLocalStore('days', { version: 1, initial: {} });

  const upsertDay = useCallback((date, updates) => {
    setDays(prev => ({
      ...prev,
      [date]: {
        date,
        deliveryRevenue: 0,
        pickupRevenue: 0,
        deliveryOrders: 0,
        pickupOrders: 0,
        doordash: 0, ubereats: 0, grubhub: 0,
        doordashOrders: 0, ubereatsOrders: 0, grubhubOrders: 0,
        categories: {},
        notes: '',
        ...(prev[date] || {}),
        ...updates,
      }
    }));
  }, [setDays]);

  const removeDay = useCallback((date) => {
    setDays(prev => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
  }, [setDays]);

  // Sorted array descending for display
  const dailySummary = Object.values(days)
    .map(d => ({
      ...d,
      revenue: (d.deliveryRevenue || 0) + (d.pickupRevenue || 0),
      orderCount: (d.deliveryOrders || 0) + (d.pickupOrders || 0),
      avgOrderValue: ((d.deliveryOrders || 0) + (d.pickupOrders || 0)) > 0
        ? ((d.deliveryRevenue || 0) + (d.pickupRevenue || 0)) / ((d.deliveryOrders || 0) + (d.pickupOrders || 0))
        : 0,
      thirdPartyRevenue: (d.doordash || 0) + (d.ubereats || 0) + (d.grubhub || 0),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return { days, upsertDay, removeDay, dailySummary };
}

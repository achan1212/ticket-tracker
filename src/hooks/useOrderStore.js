import { useCallback, useMemo } from 'react';
import { useLocalStore } from './useLocalStore.js';

// Daily record shape:
// {
//   date: 'YYYY-MM-DD',
//   deliveryRevenue: 0,
//   pickupRevenue: 0,
//   deliveryOrders: 0,
//   pickupOrders: 0,
//   totalRevenue: 0, // optional override; when > 0 it replaces delivery+pickup as the day's bottom-line revenue
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

  const clearAll = useCallback(() => setDays({}), [setDays]);

  // Sorted array descending for display. A manual `totalRevenue` field, when
  // set, overrides the delivery+pickup sum — same semantics as the monthly
  // record, so users can record a day's bottom-line total even when the
  // channel breakdown is incomplete.
  const dailySummary = useMemo(() => Object.values(days)
    .map(d => {
      const breakdownTotal = (d.deliveryRevenue || 0) + (d.pickupRevenue || 0);
      const revenue = (d.totalRevenue || 0) > 0 ? d.totalRevenue : breakdownTotal;
      const orderCount = (d.deliveryOrders || 0) + (d.pickupOrders || 0);
      return {
        ...d,
        revenue,
        orderCount,
        avgOrderValue: orderCount > 0 ? revenue / orderCount : 0,
        thirdPartyRevenue: (d.doordash || 0) + (d.ubereats || 0) + (d.grubhub || 0),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date)),
  [days]);

  return { days, upsertDay, removeDay, clearAll, dailySummary };
}

import { useState, useCallback } from 'react';

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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function useOrderStore() {
  const [days, setDays] = useState({}); // keyed by date string

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
  }, []);

  const removeDay = useCallback((date) => {
    setDays(prev => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
  }, []);

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

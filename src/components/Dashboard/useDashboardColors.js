import { useLocalStore } from '@hooks/useLocalStore.js';
import { PLATFORM_COLORS } from './dashboardUtils.js';

// Default color scheme for dashboard
const DEFAULT_COLORS = {
  // Chart colors (dark mode defaults)
  accent: '#e8ff47',
  accentLight: '#5a8a17',
  delivery: '#06C167',
  deliveryLight: '#059669',
  pickup: '#3b82f6',
  pickupLight: '#2563eb',
  foodCost: '#f97316',
  foodCostLight: '#c2410c',
  grid: '#2a2a2a',
  gridLight: '#e5e7eb',
  tick: '#666',
  tickLight: '#555',

  // Platform colors
  platformDoordash: PLATFORM_COLORS.doordash,
  platformUbereats: PLATFORM_COLORS.ubereats,
  platformGrubhub: PLATFORM_COLORS.grubhub,
  platformDirect: PLATFORM_COLORS.direct,
};

// Hook to manage dashboard color customization
export function useDashboardColors(isDark) {
  const [customColors, setCustomColors] = useLocalStore('dashboard-colors', {
    version: 1,
    initial: {},
  });

  // Get effective color (custom or default, theme-aware)
  const getColor = (key, lightKey) => {
    if (customColors[key]) return customColors[key];
    if (!isDark && lightKey && DEFAULT_COLORS[lightKey]) return DEFAULT_COLORS[lightKey];
    return DEFAULT_COLORS[key] || DEFAULT_COLORS[key + 'Light'];
  };

  // Build color object for charts
  const C = {
    accent:   getColor('accent', 'accentLight'),
    delivery: getColor('delivery', 'deliveryLight'),
    pickup:   getColor('pickup', 'pickupLight'),
    foodCost: getColor('foodCost', 'foodCostLight'),
    grid:     getColor('grid', 'gridLight'),
    tick:     getColor('tick', 'tickLight'),
  };

  // Platform colors object
  const platformColors = {
    doordash: getColor('platformDoordash'),
    ubereats: getColor('platformUbereats'),
    grubhub:  getColor('platformGrubhub'),
    direct:   getColor('platformDirect'),
  };

  // Update a specific color
  const updateColor = (key, value) => {
    setCustomColors({ ...customColors, [key]: value });
  };

  // Reset all colors to default
  const resetColors = () => {
    setCustomColors({});
  };

  // Get all customizable colors with labels
  const getEditableColors = () => [
    { key: 'accent', label: 'Accent Color', value: C.accent },
    { key: 'delivery', label: 'Delivery Color', value: C.delivery },
    { key: 'pickup', label: 'Pickup Color', value: C.pickup },
    { key: 'foodCost', label: 'Food Cost Color', value: C.foodCost },
    { key: 'platformDoordash', label: 'DoorDash', value: platformColors.doordash },
    { key: 'platformUbereats', label: 'Uber Eats', value: platformColors.ubereats },
    { key: 'platformGrubhub', label: 'Grubhub', value: platformColors.grubhub },
    { key: 'platformDirect', label: 'Direct Orders', value: platformColors.direct },
  ];

  return {
    C,
    platformColors,
    updateColor,
    resetColors,
    getEditableColors,
    hasCustomColors: Object.keys(customColors).length > 0,
  };
}

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

// Hook to manage dashboard color customization.
//
// Custom colors are stored PER THEME — `{ dark: {...}, light: {...} }` — and a
// custom value only overrides the theme it was set in. A neon accent picked in
// dark mode must not leak into light mode (same bug class as the May audit's
// "dark hex constants leaked into light mode" finding).
export function useDashboardColors(isDark) {
  const [customColors, setCustomColors] = useLocalStore('dashboard-colors', {
    version: 2,
    initial: { dark: {}, light: {} },
    // v1 stored a flat { key: hex } map with no theme split. Those values were
    // (almost certainly) picked in dark mode — the editor shipped with dark
    // defaults — so they migrate into the dark bucket.
    migrate: (prev) => ({ dark: prev || {}, light: {} }),
  });

  const themeKey = isDark ? 'dark' : 'light';
  const activeCustom = customColors?.[themeKey] || {};

  // Get effective color: active theme's custom value, else theme default.
  const getColor = (key, lightKey) => {
    if (activeCustom[key]) return activeCustom[key];
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

  // Update a specific color in the active theme's bucket. Functional setter:
  // the native color picker fires a burst of change events while dragging, and
  // a stale-closure spread would drop writes.
  const updateColor = (key, value) => {
    setCustomColors(prev => {
      const base = prev && prev.dark ? prev : { dark: {}, light: {} };
      return { ...base, [themeKey]: { ...base[themeKey], [key]: value } };
    });
  };

  // Reset the ACTIVE theme's colors to default. The editor only shows the
  // current theme's values, so resetting the other theme's (invisible)
  // customizations here would be surprising.
  const resetColors = () => {
    setCustomColors(prev => ({ ...(prev || { dark: {}, light: {} }), [themeKey]: {} }));
  };

  // Customizable colors. `labelKey` is resolved through translations by the
  // editor; `fallback` keeps brand names / English when a key is missing.
  const getEditableColors = () => [
    { key: 'accent',           labelKey: 'colorAccent',   fallback: 'Accent Color',    value: C.accent },
    { key: 'delivery',         labelKey: 'colorDelivery', fallback: 'Delivery Color',  value: C.delivery },
    { key: 'pickup',           labelKey: 'colorPickup',   fallback: 'Pickup Color',    value: C.pickup },
    { key: 'foodCost',         labelKey: 'colorFoodCost', fallback: 'Food Cost Color', value: C.foodCost },
    // Brand names are proper nouns — not translated.
    { key: 'platformDoordash', labelKey: null,            fallback: 'DoorDash',        value: platformColors.doordash },
    { key: 'platformUbereats', labelKey: null,            fallback: 'Uber Eats',       value: platformColors.ubereats },
    { key: 'platformGrubhub',  labelKey: null,            fallback: 'Grubhub',         value: platformColors.grubhub },
    { key: 'platformDirect',   labelKey: 'colorDirect',   fallback: 'Direct Orders',   value: platformColors.direct },
  ];

  return {
    C,
    platformColors,
    updateColor,
    resetColors,
    getEditableColors,
    hasCustomColors: Object.keys(activeCustom).length > 0,
  };
}

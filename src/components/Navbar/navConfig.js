// Single source of truth for the top navigation. Both the desktop Navbar and
// the MobileDrawer render off this array. Adding a new tab is a one-line
// config change — no component edits required.
//
//   type: 'group' renders a NavDropdown
//   type: 'link'  renders as a direct link (no menu)

export const NAV_GROUPS = [
  {
    type: 'group',
    key: 'data',
    labelKey: 'navData',
    items: [
      { key: 'summary',  labelKey: 'tabSummary',  icon: '📋' },
      { key: 'monthly',  labelKey: 'tabMonthly',  icon: '📅' },
      { key: 'scanner',  labelKey: 'tabScanner',  icon: '📷' },
      { key: 'foodcost', labelKey: 'tabFoodCost', icon: '🛒' },
      { key: 'opcosts',  labelKey: 'tabOpCosts',  icon: '💵' },
    ],
  },
  {
    type: 'group',
    key: 'insights',
    labelKey: 'navInsights',
    items: [
      { key: 'dashboard', labelKey: 'tabDashboard', icon: '📊' },
      { key: 'pl',        labelKey: 'tabPL',        icon: '📈' },
      { key: 'delivery',  labelKey: 'tabDelivery',  icon: '🛵' },
      { key: 'analysis',  labelKey: 'tabAnalysis',  icon: '💰' },
      { key: 'menu',      labelKey: 'tabMenu',      icon: '🍽️' },
      { key: 'recipes',   labelKey: 'tabRecipes',   icon: '📖' },
    ],
  },
  {
    type: 'link',
    key: 'sheets',
    labelKey: 'tabSheets',
    icon: '📄',
  },
];

// Flat list of every tab key — replaces the hand-maintained TAB_KEYS array
// in App.jsx and stays in sync as new entries are added to NAV_GROUPS.
export function getAllTabKeys() {
  const keys = [];
  for (const node of NAV_GROUPS) {
    if (node.type === 'group') {
      for (const item of node.items) keys.push(item.key);
    } else {
      keys.push(node.key);
    }
  }
  return keys;
}

// Used for highlighting the top-level trigger when one of its children
// (or itself, for direct links) is the active tab.
export function getGroupKeyForTab(tabKey) {
  for (const node of NAV_GROUPS) {
    if (node.type === 'link' && node.key === tabKey) return node.key;
    if (node.type === 'group' && node.items.some(i => i.key === tabKey)) return node.key;
  }
  return null;
}

// Canonical URL for a tab — breadcrumbed under its group when nested,
// flat when it's a direct link. Returns null for unknown keys.
//   data/summary  →  /data/summary
//   sheets        →  /sheets
export function getPathForTab(tabKey) {
  for (const node of NAV_GROUPS) {
    if (node.type === 'link' && node.key === tabKey) return `/${node.key}`;
    if (node.type === 'group') {
      for (const item of node.items) {
        if (item.key === tabKey) return `/${node.key}/${item.key}`;
      }
    }
  }
  return null;
}

// Parse a pathname back into a tabKey. Accepts:
//   /data/summary        → 'summary'  (breadcrumbed)
//   /sheets              → 'sheets'   (direct link)
//   /summary             → 'summary'  (legacy flat URL, auto-redirected)
//   /data                → first item of the group ('summary')
//   /foo or /            → null       (caller falls back to a default)
export function getTabFromPath(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  if (segments.length === 1) {
    const seg = segments[0];
    if (getAllTabKeys().includes(seg)) return seg;
    for (const node of NAV_GROUPS) {
      if (node.type === 'group' && node.key === seg && node.items.length > 0) {
        return node.items[0].key;
      }
    }
    return null;
  }

  const [groupKey, itemKey] = segments;
  for (const node of NAV_GROUPS) {
    if (node.type === 'group' && node.key === groupKey) {
      if (node.items.some(i => i.key === itemKey)) return itemKey;
    }
  }
  return null;
}

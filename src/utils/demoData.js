// Generate 90 days of realistic restaurant demo data
export function generateDemoDays() {
  const days = [];
  const now = new Date();
  const foodCategories = ['Pizza', 'Pasta', 'Salads', 'Drinks', 'Desserts'];
  const notes = [
    'lunch rush',
    'holiday weekend',
    'slow day',
    'great weather',
    'event in area',
    'staff training',
    'system issue',
  ];

  for (let i = 89; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);

    // Realistic daily pattern
    const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseRevenue = isWeekend ? 550 : 450;
    // Gradual upward trend over 90 days
    const trendBoost = (i / 89) * 50; // 0 to 50 over the period
    const noise = (Math.random() - 0.5) * 150; // ±75 randomness
    const totalRevenue = Math.max(300, baseRevenue - trendBoost + noise);

    // Delivery vs Pickup split (70% delivery, 30% pickup on average)
    const deliveryFraction = 0.65 + (Math.random() - 0.5) * 0.15;
    const pickupFraction = 1 - deliveryFraction;

    const deliveryRevenue = Math.round(totalRevenue * deliveryFraction * 100) / 100;
    const pickupRevenue = Math.round(totalRevenue * pickupFraction * 100) / 100;

    // Order counts (avg $22/delivery, $20/pickup)
    const deliveryOrders = Math.max(1, Math.round(deliveryRevenue / 22 + (Math.random() - 0.5) * 2));
    const pickupOrders = Math.max(1, Math.round(pickupRevenue / 20 + (Math.random() - 0.5) * 2));

    // Platform breakdown (DoorDash 40%, Uber 35%, Grubhub 25%)
    const doordash = Math.round(deliveryRevenue * 0.40 * 100) / 100;
    const ubereats = Math.round(deliveryRevenue * 0.35 * 100) / 100;
    const grubhub = Math.round(deliveryRevenue * 0.25 * 100) / 100;

    const doordashOrders = Math.max(1, Math.round(deliveryOrders * 0.40 + (Math.random() - 0.5) * 1));
    const ubereatsOrders = Math.max(1, Math.round(deliveryOrders * 0.35 + (Math.random() - 0.5) * 1));
    const grubhubOrders = Math.max(1, Math.round(deliveryOrders * 0.25 + (Math.random() - 0.5) * 1));

    // Categories (Pizza 30%, Pasta 20%, Salads 15%, Drinks 20%, Desserts 15%)
    const categories = {
      'Pizza': Math.round(totalRevenue * 0.30 * 100) / 100,
      'Pasta': Math.round(totalRevenue * 0.20 * 100) / 100,
      'Salads': Math.round(totalRevenue * 0.15 * 100) / 100,
      'Drinks': Math.round(totalRevenue * 0.20 * 100) / 100,
      'Desserts': Math.round(totalRevenue * 0.15 * 100) / 100,
    };

    // Occasional notes (~10% of days)
    const hasNote = Math.random() < 0.1;
    const note = hasNote ? notes[Math.floor(Math.random() * notes.length)] : '';

    days.push({
      date: dateStr,
      deliveryRevenue,
      pickupRevenue,
      deliveryOrders,
      pickupOrders,
      doordash,
      ubereats,
      grubhub,
      doordashOrders,
      ubereatsOrders,
      grubhubOrders,
      categories,
      notes: note,
      source: 'demo',
    });
  }

  return days;
}

// Generate ~26 demo food-cost import groups across the same 90-day window
// the demo days cover. Models realistic restaurant ordering cadence: a
// delivery every 3–4 days from a rotating supplier, 5–10 line items each,
// summing to roughly 28% of demo revenue for the period.
export function generateDemoFoodCostGroups() {
  const SUPPLIERS = [
    { label: 'Sysco',             fileBase: 'sysco-invoice' },
    { label: 'US Foods',          fileBase: 'usfoods-invoice' },
    { label: 'Restaurant Depot',  fileBase: 'restaurant-depot-receipt' },
    { label: 'Performance Food',  fileBase: 'pfg-invoice' },
  ];

  // [name, min unit cost, max unit cost]
  const CATALOG = [
    ['Chicken Breast (10 lb)',    35, 50],
    ['Ground Beef (5 lb)',        25, 35],
    ['Mozzarella Cheese (5 lb)',  20, 30],
    ['Pasta (10 lb case)',        12, 18],
    ['Tomato Sauce (1 gal)',       8, 14],
    ['Pizza Dough Mix (25 lb)',   25, 35],
    ['Olive Oil (1 gal)',         30, 45],
    ['Pepperoni (5 lb)',          30, 45],
    ['Mushrooms (2 lb)',           8, 15],
    ['Bell Peppers (5 lb)',       10, 18],
    ['Yellow Onions (10 lb)',      8, 15],
    ['Romaine Lettuce (case)',    15, 25],
    ['Tomatoes (10 lb)',          15, 25],
    ['Garlic (1 lb)',              5, 12],
    ['Mixed Spices (assorted)',    8, 15],
    ['Soda Syrup (5 gal BIB)',    40, 60],
    ['Takeout Containers (250)',  35, 55],
    ['Napkins (case)',            15, 25],
    ['Burger Buns (8 dozen)',     20, 35],
    ['Eggs (15 dozen)',           25, 40],
    ['Parmesan (2 lb)',           18, 28],
    ['Heavy Cream (1 gal)',       12, 18],
  ];

  const pick = (min, max) => min + Math.random() * (max - min);
  const round2 = (n) => Math.round(n * 100) / 100;

  const groups = [];
  const now = new Date();
  let i = 87;
  let seq = 0;

  while (i >= 0) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);

    const supplier = SUPPLIERS[seq % SUPPLIERS.length];
    const itemCount = 5 + Math.floor(Math.random() * 6); // 5–10 items

    const shuffled = [...CATALOG].sort(() => Math.random() - 0.5).slice(0, itemCount);
    const items = shuffled.map((c, idx) => ({
      _uid: `demo-fc-${dateStr}-${idx}`,
      name: c[0],
      cost: round2(pick(c[1], c[2])),
      quantity: 1 + Math.floor(Math.random() * 3), // 1–3 units
      sourceFile: `${supplier.fileBase}-${dateStr}.pdf`,
    }));

    const filename = `${supplier.fileBase}-${dateStr}.pdf`;
    groups.push({
      id: `demo-fc-${dateStr}`,
      name: filename,
      date: dateStr,
      status: 'done',
      items,
      importedAt: date.getTime(),
      source: 'demo',
    });

    seq += 1;
    i -= 3 + Math.floor(Math.random() * 2); // step 3–4 days
  }

  return groups;
}

// Demo monthly labor totals (~28–32% of demo revenue per month). Keyed by
// 'YYYY-MM' to match the operating-costs store. Idempotent: setLaborForMonth
// overwrites by month key.
export function generateDemoLabor(demoDays) {
  const revByMonth = {};
  for (const d of demoDays) {
    const month = d.date.slice(0, 7);
    revByMonth[month] = (revByMonth[month] || 0) + (d.deliveryRevenue || 0) + (d.pickupRevenue || 0);
  }
  const result = {};
  for (const [month, revenue] of Object.entries(revByMonth)) {
    const pct = 0.28 + Math.random() * 0.04; // 28–32%
    result[month] = Math.round(revenue * pct);
  }
  return result;
}

// Demo monthly fixed costs (Rent / Utilities / Insurance / Internet / POS
// software / Licenses) — realistic small-restaurant baseline totalling ~$5,100.
// Item IDs are deterministic (`demo-fixed-YYYY-MM-<slug>`) so re-loading demo
// data via setFixedForMonth replaces cleanly instead of duplicating rows.
export function generateDemoFixedCosts(demoDays) {
  const months = Array.from(new Set(demoDays.map(d => d.date.slice(0, 7))));
  const template = [
    { slug: 'rent',      category: 'Rent',      amount: 3500, notes: '' },
    { slug: 'utilities', category: 'Utilities', amount: 750,  notes: '' },
    { slug: 'insurance', category: 'Insurance', amount: 450,  notes: '' },
    { slug: 'internet',  category: 'Internet',  amount: 120,  notes: '' },
    { slug: 'software',  category: 'Software',  amount: 200,  notes: 'POS subscription' },
    { slug: 'licenses',  category: 'Licenses',  amount: 80,   notes: 'Health permit (amortized)' },
  ];
  const result = {};
  for (const month of months) {
    result[month] = template.map(t => ({
      id: `demo-fixed-${month}-${t.slug}`,
      category: t.category,
      amount: t.amount,
      notes: t.notes,
    }));
  }
  return result;
}

// Demo recipes for the Recipe Costing tab. Ingredient names intentionally
// match the demo food-cost catalog (generateDemoFoodCostGroups) so the
// import-driven autofill suggestions line up with what's on screen. Unit
// costs are per-oz breakdowns of those bulk catalog prices; plate costs land
// at a plausible 16–28% of sell price. All values and IDs are deterministic
// (`demo-recipe-<slug>`) so re-loads replace cleanly via upsertRecipes.
export function generateDemoRecipes() {
  const RECIPES = [
    {
      slug: 'margherita-pizza',
      name: 'Margherita Pizza',
      sellPrice: '13.50',
      ingredients: [
        ['Pizza Dough Mix (25 lb)',   'oz', '0.075', '9',    '5'],
        ['Tomato Sauce (1 gal)',      'oz', '0.086', '4',    '3'],
        ['Mozzarella Cheese (5 lb)',  'oz', '0.31',  '5',    '4'],
        ['Olive Oil (1 gal)',         'oz', '0.29',  '0.5',  '0'],
      ],
    },
    {
      slug: 'pepperoni-pizza',
      name: 'Pepperoni Pizza',
      sellPrice: '15.00',
      ingredients: [
        ['Pizza Dough Mix (25 lb)',   'oz', '0.075', '9',    '5'],
        ['Tomato Sauce (1 gal)',      'oz', '0.086', '4',    '3'],
        ['Mozzarella Cheese (5 lb)',  'oz', '0.31',  '5',    '4'],
        ['Pepperoni (5 lb)',          'oz', '0.44',  '3',    '2'],
      ],
    },
    {
      slug: 'spaghetti-bolognese',
      name: 'Spaghetti Bolognese',
      sellPrice: '14.50',
      ingredients: [
        ['Pasta (10 lb case)',        'oz', '0.094', '4',    '0'],
        ['Ground Beef (5 lb)',        'oz', '0.375', '5',    '8'],
        ['Tomato Sauce (1 gal)',      'oz', '0.086', '5',    '3'],
        ['Parmesan (2 lb)',           'oz', '0.72',  '0.75', '0'],
        ['Garlic (1 lb)',             'oz', '0.50',  '0.25', '5'],
      ],
    },
    {
      slug: 'chicken-alfredo',
      name: 'Chicken Alfredo',
      sellPrice: '16.00',
      ingredients: [
        ['Pasta (10 lb case)',        'oz', '0.094', '4',    '0'],
        ['Chicken Breast (10 lb)',    'oz', '0.26',  '6',    '10'],
        ['Heavy Cream (1 gal)',       'oz', '0.117', '4',    '0'],
        ['Parmesan (2 lb)',           'oz', '0.72',  '1',    '0'],
        ['Garlic (1 lb)',             'oz', '0.50',  '0.25', '5'],
      ],
    },
    {
      slug: 'caesar-salad',
      name: 'Caesar Salad',
      sellPrice: '9.75',
      ingredients: [
        ['Romaine Lettuce (case)',    'oz', '0.125', '5',    '12'],
        ['Tomatoes (10 lb)',          'oz', '0.125', '2',    '8'],
        ['Parmesan (2 lb)',           'oz', '0.72',  '0.5',  '0'],
        ['Olive Oil (1 gal)',         'oz', '0.29',  '0.75', '0'],
      ],
    },
  ];

  return RECIPES.map(r => ({
    id: `demo-recipe-${r.slug}`,
    name: r.name,
    targetFoodCostPct: 30,
    sellPrice: r.sellPrice,
    ingredients: r.ingredients.map(([name, unit, unitCost, portionSize, wastePct], i) => ({
      _uid: `demo-recipe-${r.slug}-${i}`,
      name, unit, unitCost, portionSize, wastePct,
    })),
  }));
}

// Demo inventory: eight stocked items matching the food-cost catalog SKUs,
// with three weeks of dated movements (weekly restocks + usage every few
// days). Three items (chicken, beef, mozzarella) net out at/below par so the
// low-stock badge has something to show. Deterministic IDs (`demo-inv-*`)
// merged via upsertDemo → idempotent re-loads that never touch user rows.
export function generateDemoInventory() {
  const dayISO = (daysBack) => {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    return d.toISOString().slice(0, 10);
  };

  // [slug, name, unit, par, restockQty, usagePerEntry]
  // Net on-hand = 3 restocks − 7 usage entries.
  const ITEMS = [
    ['chicken-breast', 'Chicken Breast (10 lb)',   'case', 4, 3, 1.2],
    ['ground-beef',    'Ground Beef (5 lb)',       'case', 3, 3, 1],
    ['mozzarella',     'Mozzarella Cheese (5 lb)', 'case', 5, 4, 1.6],
    ['pasta',          'Pasta (10 lb case)',       'case', 2, 3, 0.8],
    ['tomato-sauce',   'Tomato Sauce (1 gal)',     'jug',  3, 4, 1],
    ['pizza-dough',    'Pizza Dough Mix (25 lb)',  'bag',  2, 3, 0.7],
    ['olive-oil',      'Olive Oil (1 gal)',        'jug',  1, 2, 0.3],
    ['takeout',        'Takeout Containers (250)', 'case', 2, 3, 0.6],
  ];

  const RESTOCK_DAYS = [19, 12, 5];          // weekly deliveries
  const USAGE_DAYS   = [17, 14, 11, 9, 6, 3, 1];

  const items = ITEMS.map(([slug, name, unit, par]) => ({
    id: `demo-inv-${slug}`,
    name, unit,
    parLevel: par,
  }));

  const movements = [];
  for (const [slug, , , , restockQty, usagePerEntry] of ITEMS) {
    RESTOCK_DAYS.forEach((daysBack, i) => {
      movements.push({
        id: `demo-inv-mv-${slug}-r${i}`,
        itemId: `demo-inv-${slug}`,
        date: dayISO(daysBack),
        type: 'restock',
        quantity: restockQty,
        note: 'Weekly delivery',
        source: 'demo',
      });
    });
    USAGE_DAYS.forEach((daysBack, i) => {
      movements.push({
        id: `demo-inv-mv-${slug}-u${i}`,
        itemId: `demo-inv-${slug}`,
        date: dayISO(daysBack),
        type: i === 3 ? 'waste' : 'usage', // one waste entry per item for variety
        quantity: usagePerEntry,
        note: '',
        source: 'demo',
      });
    });
  }

  return { items, movements };
}

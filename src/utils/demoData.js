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

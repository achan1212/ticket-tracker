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

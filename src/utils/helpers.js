// `locale` defaults to en-US for back-compat with any non-React caller; the
// preferred path is to consume the locale-bound `formatCurrency` exposed by
// `useLang()`, which maps the active app language to a BCP-47 locale.
export function formatCurrency(amount, locale = 'en-US', currency = 'USD') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

export function calcTotal(items) {
  return items.reduce((sum, item) => sum + item.cost * item.quantity, 0);
}

export function exportToCSV(items, filename = 'order-summary.csv') {
  const header = 'Item Name,Unit Cost,Quantity,Subtotal\n';
  const rows = items.map(i =>
    `"${i.name}",${i.cost.toFixed(2)},${i.quantity},${(i.cost * i.quantity).toFixed(2)}`
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

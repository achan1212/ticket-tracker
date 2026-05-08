export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
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

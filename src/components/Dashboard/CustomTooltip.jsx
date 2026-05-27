import { useLang } from '../../i18n/LangContext.jsx';

// Recharts tooltip used by every Dashboard chart. Switches to a plain
// integer for the `orders` series; everything else renders as currency
// in the user's locale.
export default function CustomTooltip({ active, payload, label }) {
  const { formatCurrency } = useLang();
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="ct-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="ct-row" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span>{p.dataKey === 'orders' ? p.value : formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

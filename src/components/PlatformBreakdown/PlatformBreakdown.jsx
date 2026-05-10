import { formatCurrency } from '@utils/helpers';
import { useLang } from '../../i18n/LangContext.jsx';

const PLATFORM_LABELS = {
  doordash: { name: 'DoorDash', color: '#FF3008', icon: '🔴' },
  ubereats: { name: 'Uber Eats', color: '#06C167', icon: '🟢' },
  grubhub:  { name: 'Grubhub',   color: '#F63440', icon: '🟠' },
};

/**
 * Renders the per-platform breakdown stored on a day or month record. A
 * `breakdown` sub-object is attached when the user imports a platform
 * statement that exposes more than just sales (tips, tax, fees, net payout).
 */
export default function PlatformBreakdown({ record }) {
  const { t } = useLang();
  if (!record) return null;

  const entries = Object.keys(PLATFORM_LABELS)
    .map(key => ({ key, breakdown: record[`${key}Breakdown`] }))
    .filter(e => e.breakdown);

  if (entries.length === 0) return null;

  return (
    <div className="platform-breakdowns">
      {entries.map(({ key, breakdown }) => {
        const p = PLATFORM_LABELS[key];
        return (
          <div key={key} className="platform-breakdown-card" style={{ borderLeftColor: p.color }}>
            <div className="pbc-header">
              <span className="pbc-platform" style={{ color: p.color }}>{p.icon} {p.name}</span>
              <span className="pbc-net">{t.pbcNetPayout}: <strong>{formatCurrency(breakdown.netPayout)}</strong></span>
            </div>
            <div className="pbc-grid">
              <Row label={t.pbcSales}         value={breakdown.sales}         />
              <Row label={t.pbcOrders}        value={breakdown.orders}        isCount />
              <Row label={t.pbcTips}          value={breakdown.tips}          />
              <Row label={t.pbcTax}           value={breakdown.tax}           />
              <Row label={t.pbcOtherEarnings} value={breakdown.otherEarnings} />
              <Row label={t.pbcTotalEarnings} value={breakdown.totalEarnings} bold />
              <Row label={t.pbcFees}          value={breakdown.fees}          negative />
              <Row label={t.pbcNetPayout}     value={breakdown.netPayout}     bold />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value, isCount, negative, bold }) {
  if (value == null || (value === 0 && !bold)) return null;
  return (
    <div className="pbc-row">
      <span className="pbc-label">{label}</span>
      <span className={`pbc-value ${bold ? 'pbc-bold' : ''} ${negative ? 'pbc-negative' : ''}`}>
        {isCount ? value : `${negative ? '−' : ''}${formatCurrency(Math.abs(value))}`}
      </span>
    </div>
  );
}

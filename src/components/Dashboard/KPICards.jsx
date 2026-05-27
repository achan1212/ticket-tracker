import { useLang } from '../../i18n/LangContext.jsx';
import { foodCostPctColor } from './dashboardUtils.js';

// Summary card grid shown above the charts. `totals` carries all the
// pre-computed aggregates from Dashboard's useMemo, `C` is the theme-aware
// color palette, `plTargets` is read for the Other-cost % footnote.
export default function KPICards({ totals, plTargets, hasFoodCost, spanDays, C }) {
  const { t, formatCurrency } = useLang();
  return (
    <div className="dash-cards">
      <div className="dash-card">
        <p className="dash-card-label">{t.totalRevenue}</p>
        <p className="dash-card-value">{formatCurrency(totals.revenue)}</p>
        <p className="dash-card-sub">{spanDays} {t.dashDayRange}</p>
      </div>
      <div className="dash-card">
        <p className="dash-card-label">{t.labelOrders}</p>
        <p className="dash-card-value">{totals.orderCount}</p>
        <p className="dash-card-sub">{spanDays} {t.dashDayRange}</p>
      </div>
      <div className="dash-card">
        <p className="dash-card-label">{t.dashAvgOrderValue}</p>
        <p className="dash-card-value">{formatCurrency(totals.avg)}</p>
        <p className="dash-card-sub">{t.dashPerOrder}</p>
      </div>
      <div className="dash-card highlight">
        <p className="dash-card-label">{t.dashDeliveryRev}</p>
        <p className="dash-card-value" style={{ color: C.delivery }}>{formatCurrency(totals.deliveryRev)}</p>
        <p className="dash-card-sub">{totals.revenue > 0 ? ((totals.deliveryRev / totals.revenue) * 100).toFixed(1) : 0}{t.dashOfTotal}</p>
      </div>
      <div className="dash-card highlight">
        <p className="dash-card-label">{t.dashPickupRev}</p>
        <p className="dash-card-value" style={{ color: C.pickup }}>{formatCurrency(totals.pickupRev)}</p>
        <p className="dash-card-sub">{totals.revenue > 0 ? ((totals.pickupRev / totals.revenue) * 100).toFixed(1) : 0}{t.dashOfTotal}</p>
      </div>
      {totals.bestDay && (
        <div className="dash-card">
          <p className="dash-card-label">{t.dashBestDay}</p>
          <p className="dash-card-value">{formatCurrency(totals.bestDay.revenue)}</p>
          <p className="dash-card-sub">{totals.bestDay.fullDate}</p>
        </div>
      )}
      {hasFoodCost && (
        <>
          <div className="dash-card">
            <p className="dash-card-label">{t.dashFoodCost || 'Food Cost'}</p>
            <p className="dash-card-value" style={{ color: C.foodCost }}>−{formatCurrency(totals.foodCost)}</p>
            <p className="dash-card-sub">{totals.foodCostPct.toFixed(1)}{t.dashOfTotal}</p>
          </div>
          <div className="dash-card">
            <p className="dash-card-label">{t.dashFoodCostPct || 'Food Cost %'}</p>
            <p className="dash-card-value" style={{ color: foodCostPctColor(totals.foodCostPct, C) }}>
              {totals.foodCostPct.toFixed(1)}%
            </p>
            <p className="dash-card-sub">{t.dashFoodCostTarget || 'Target 25–32%'}</p>
          </div>
        </>
      )}
      {totals.revenue > 0 && (
        <>
          <div className="dash-card">
            <p className="dash-card-label">
              {t.plLabor || 'Labor'}
              {totals.laborIsActual && <span className="dash-actual-badge">{t.plActual || 'actual'}</span>}
            </p>
            <p className="dash-card-value" style={{ color: C.foodCost }}>−{formatCurrency(totals.laborCost)}</p>
            <p className="dash-card-sub">
              {totals.revenue > 0 ? ((totals.laborCost / totals.revenue) * 100).toFixed(1) : 0}{t.dashOfTotal}
            </p>
          </div>
          <div className="dash-card">
            <p className="dash-card-label">
              {t.plOverhead || 'Overhead'}
              {totals.overheadIsActual && <span className="dash-actual-badge">{t.plActual || 'actual'}</span>}
            </p>
            <p className="dash-card-value" style={{ color: C.foodCost }}>−{formatCurrency(totals.overheadCost)}</p>
            <p className="dash-card-sub">
              {totals.revenue > 0 ? ((totals.overheadCost / totals.revenue) * 100).toFixed(1) : 0}{t.dashOfTotal}
            </p>
          </div>
          <div className="dash-card">
            <p className="dash-card-label">{t.plOther || 'Other'}</p>
            <p className="dash-card-value" style={{ color: C.foodCost }}>−{formatCurrency(totals.otherCost)}</p>
            <p className="dash-card-sub">{plTargets.otherPct}{t.dashOfTotal}</p>
          </div>
          <div className="dash-card highlight">
            <p className="dash-card-label">{t.plNetIncome || 'Net Operating Income'}</p>
            <p
              className="dash-card-value"
              style={{ color: totals.netIncome >= 0 ? C.delivery : '#ef4444' }}
            >
              {totals.netIncome < 0 ? '−' : ''}{formatCurrency(Math.abs(totals.netIncome))}
            </p>
            <p className="dash-card-sub">{totals.netMarginPct.toFixed(1)}% {t.dashMarginSuffix || 'margin'}</p>
          </div>
        </>
      )}
    </div>
  );
}

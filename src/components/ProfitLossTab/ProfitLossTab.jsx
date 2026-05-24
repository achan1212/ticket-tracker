import { useState, useMemo } from 'react';
import { formatCurrency } from '@utils/helpers';
import { useLang } from '../../i18n/LangContext.jsx';
import { useLocalStore } from '@hooks/useLocalStore.js';
import Dropdown from '@components/ui/Dropdown.jsx';
import './ProfitLossTab.css';

function currentMonthISO() {
  return new Date().toISOString().slice(0, 7);
}

function formatMonthYear(ym) {
  const [year, month] = ym.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function computePL(month, dailySummary, months, foodCostByMonth, targets, laborByMonth, fixedByMonth) {
  const manualRec = months[month];
  const dailyEntries = dailySummary.filter(d => d.date.startsWith(month));
  const dailyRevenue = dailyEntries.reduce((s, d) => s + d.revenue, 0);
  const hasDailyData = dailyEntries.length > 0;
  const manualRevenue = (!hasDailyData && manualRec)
    ? (manualRec.totalRevenue > 0
      ? manualRec.totalRevenue
      : (manualRec.deliveryRevenue || 0) + (manualRec.pickupRevenue || 0))
    : 0;
  const revenue = dailyRevenue + manualRevenue;

  const foodCost = (foodCostByMonth[month] > 0)
    ? foodCostByMonth[month]
    : ((manualRec?.foodCost > 0) ? manualRec.foodCost : 0);

  // Actuals from the Operating Costs tab override the % estimates when present.
  // Labor: per-month actual takes precedence. Overhead: actual fixed-cost sum
  // replaces overheadPct (Fixed Costs is the user-visible label for the
  // combined recurring expenses). Other stays as % only — it's a catch-all.
  const laborActual = (laborByMonth || {})[month] || 0;
  const fixedActual = (fixedByMonth || {})[month] || 0;
  const laborCost    = laborActual > 0 ? laborActual : revenue * (targets.laborPct    / 100);
  const overheadCost = fixedActual > 0 ? fixedActual : revenue * (targets.overheadPct / 100);
  const otherCost    = revenue * (targets.otherPct / 100);
  const grossProfit  = revenue - foodCost;
  const netIncome    = grossProfit - laborCost - overheadCost - otherCost;

  const pct = (n) => revenue > 0 ? (n / revenue) * 100 : 0;

  return {
    revenue, foodCost, grossProfit, laborCost, overheadCost, otherCost, netIncome,
    foodCostPct: pct(foodCost),
    grossPct:    pct(grossProfit),
    netPct:      pct(netIncome),
    laborIsActual:    laborActual > 0,
    overheadIsActual: fixedActual > 0,
    hasData: revenue > 0 || foodCost > 0,
  };
}

export default function ProfitLossTab({ dailySummary, months, foodCostByMonth = {}, laborByMonth = {}, fixedByMonth = {} }) {
  const { t } = useLang();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthISO);
  const [targets, setTargets] = useLocalStore('pl-targets', {
    version: 1,
    initial: { laborPct: 30, overheadPct: 16, otherPct: 5 },
  });

  const setTarget = (key, raw) => {
    const val = Math.max(0, Math.min(100, parseFloat(raw) || 0));
    setTargets(prev => ({ ...prev, [key]: val }));
  };

  const today = currentMonthISO();
  const canGoNext = selectedMonth < today;

  const availableMonths = useMemo(() => {
    const keys = new Set([
      ...dailySummary.map(d => d.date.slice(0, 7)),
      ...Object.keys(months),
    ]);
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [dailySummary, months]);

  const pl = useMemo(
    () => computePL(selectedMonth, dailySummary, months, foodCostByMonth, targets, laborByMonth, fixedByMonth),
    [selectedMonth, dailySummary, months, foodCostByMonth, targets, laborByMonth, fixedByMonth]
  );

  const history = useMemo(() => {
    return availableMonths.slice(0, 6).map(month => {
      const h = computePL(month, dailySummary, months, foodCostByMonth, targets, laborByMonth, fixedByMonth);
      return { month, ...h };
    });
  }, [availableMonths, dailySummary, months, foodCostByMonth, targets, laborByMonth, fixedByMonth]);

  const stackSegments = pl.revenue > 0 ? [
    { label: t.plFoodCost  || 'Food',     pct: pl.foodCostPct,           color: 'var(--pl-food)'     },
    { label: t.plLabor     || 'Labor',    pct: targets.laborPct,         color: 'var(--pl-labor)'    },
    { label: t.plOverhead  || 'Overhead', pct: targets.overheadPct,      color: 'var(--pl-overhead)' },
    { label: t.plOther     || 'Other',    pct: targets.otherPct,         color: 'var(--pl-other)'    },
    { label: t.plNetIncome || 'Net',      pct: Math.max(0, pl.netPct),   color: 'var(--pl-net)'      },
  ] : [];

  const monthOptions = [...new Set([...availableMonths, today])].sort((a, b) => b.localeCompare(a));

  return (
    <div className="pl-tab">
      <h2 className="page-title">{t.plTitle || 'Profit & Loss'}</h2>
      <p className="pl-sub">{t.plSub || 'Monthly close summary'}</p>

      {/* ── MONTH NAVIGATION ── */}
      <div className="pl-month-nav">
        <button
          className="btn btn-ghost btn-sm pl-nav-btn"
          title={t.plPrevMonth || 'Previous month'}
          onClick={() => setSelectedMonth(m => shiftMonth(m, -1))}
        >←</button>

        <Dropdown
          className="pl-month-dd"
          value={selectedMonth}
          onChange={setSelectedMonth}
          options={monthOptions.map(m => ({ value: m, label: formatMonthYear(m) }))}
          ariaLabel={t.plMonthPicker || 'Select month'}
        />

        <button
          className="btn btn-ghost btn-sm pl-nav-btn"
          title={t.plNextMonth || 'Next month'}
          disabled={!canGoNext}
          onClick={() => canGoNext && setSelectedMonth(m => shiftMonth(m, 1))}
        >→</button>
      </div>

      {!pl.hasData ? (
        <div className="ds-empty">
          <p>{t.plNoData || 'No revenue data for this month.'}</p>
        </div>
      ) : (
        <>
          {/* ── P&L TABLE ── */}
          <div className="pl-table">

            {/* Revenue */}
            <div className="pl-row pl-row-section pl-row-revenue">
              <span className="pl-label">{t.plRevenue || 'Revenue'}</span>
              <span className="pl-pct" />
              <span className="pl-amount">{formatCurrency(pl.revenue)}</span>
            </div>

            <div className="pl-divider" />

            {/* Food Cost */}
            <div className="pl-row pl-row-sub">
              <span className="pl-label">
                <span className="pl-deduct">−</span>
                {t.plFoodCost || 'Food Cost'}
                <span className="pl-auto-badge">{t.plAuto || 'auto'}</span>
              </span>
              <span className="pl-pct">{pl.foodCostPct.toFixed(1)}%</span>
              <span className="pl-amount pl-amount-cost">−{formatCurrency(pl.foodCost)}</span>
            </div>

            {/* Gross Profit */}
            <div className="pl-row pl-row-sub pl-row-subtotal">
              <span className="pl-label">{t.plGrossProfit || 'Gross Profit'}</span>
              <span className="pl-pct">{pl.grossPct.toFixed(1)}%</span>
              <span className="pl-amount">{formatCurrency(pl.grossProfit)}</span>
            </div>

            <div className="pl-divider" />

            {/* Labor */}
            <div className="pl-row pl-row-sub">
              <span className="pl-label">
                <span className="pl-deduct">−</span>
                {t.plLabor || 'Labor'}
                {pl.laborIsActual && <span className="pl-auto-badge">{t.plActual || 'actual'}</span>}
              </span>
              {pl.laborIsActual ? (
                <span className="pl-pct">{(pl.revenue > 0 ? (pl.laborCost / pl.revenue) * 100 : 0).toFixed(1)}%</span>
              ) : (
                <span className="pl-pct pl-pct-editable">
                  <input
                    className="pl-pct-input"
                    type="number" min="0" max="100" step="0.1"
                    value={targets.laborPct}
                    onChange={e => setTarget('laborPct', e.target.value)}
                  />%
                </span>
              )}
              <span className="pl-amount pl-amount-cost">−{formatCurrency(pl.laborCost)}</span>
            </div>

            {/* Overhead / Fixed Costs */}
            <div className="pl-row pl-row-sub">
              <span className="pl-label">
                <span className="pl-deduct">−</span>
                {t.plOverhead || 'Overhead'}
                {pl.overheadIsActual && <span className="pl-auto-badge">{t.plActual || 'actual'}</span>}
              </span>
              {pl.overheadIsActual ? (
                <span className="pl-pct">{(pl.revenue > 0 ? (pl.overheadCost / pl.revenue) * 100 : 0).toFixed(1)}%</span>
              ) : (
                <span className="pl-pct pl-pct-editable">
                  <input
                    className="pl-pct-input"
                    type="number" min="0" max="100" step="0.1"
                    value={targets.overheadPct}
                    onChange={e => setTarget('overheadPct', e.target.value)}
                  />%
                </span>
              )}
              <span className="pl-amount pl-amount-cost">−{formatCurrency(pl.overheadCost)}</span>
            </div>

            {/* Other */}
            <div className="pl-row pl-row-sub">
              <span className="pl-label">
                <span className="pl-deduct">−</span>
                {t.plOther || 'Other'}
              </span>
              <span className="pl-pct pl-pct-editable">
                <input
                  className="pl-pct-input"
                  type="number" min="0" max="100" step="0.1"
                  value={targets.otherPct}
                  onChange={e => setTarget('otherPct', e.target.value)}
                />%
              </span>
              <span className="pl-amount pl-amount-cost">−{formatCurrency(pl.otherCost)}</span>
            </div>

            <div className="pl-divider pl-divider-thick" />

            {/* Net Operating Income */}
            <div className={`pl-row pl-row-section ${pl.netIncome >= 0 ? 'pl-row-positive' : 'pl-row-negative'}`}>
              <span className="pl-label">{t.plNetIncome || 'Net Operating Income'}</span>
              <span className="pl-pct pl-pct-net">{pl.netPct.toFixed(1)}%</span>
              <span className="pl-amount">
                {pl.netIncome < 0 ? '−' : ''}{formatCurrency(Math.abs(pl.netIncome))}
              </span>
            </div>

          </div>

          {/* ── COST STACK BAR ── */}
          {stackSegments.length > 0 && (
            <div className="pl-stack-section">
              <p className="pl-stack-label">{t.plCostStack || 'Cost Stack'}</p>
              <div className="pl-stack-bar">
                {stackSegments.filter(s => s.pct > 0).map(s => (
                  <div
                    key={s.label}
                    className="pl-stack-segment"
                    style={{ width: `${Math.min(s.pct, 100)}%`, background: s.color }}
                    title={`${s.label}: ${s.pct.toFixed(1)}%`}
                  />
                ))}
              </div>
              <div className="pl-stack-legend">
                {stackSegments.filter(s => s.pct > 0).map(s => (
                  <span key={s.label} className="pl-stack-key">
                    <span className="pl-stack-dot" style={{ background: s.color }} />
                    {s.label} {s.pct.toFixed(1)}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── 6-MONTH HISTORY ── */}
          {history.length > 1 && (
            <div className="pl-history">
              <p className="pl-history-title">{t.plHistory || 'Last 6 Months'}</p>
              <div className="pl-history-table">
                <div className="pl-history-header">
                  <span>{t.plColMonth     || 'Month'}</span>
                  <span>{t.plColRevenue   || 'Revenue'}</span>
                  <span>{t.plColFoodPct   || 'Food %'}</span>
                  <span>{t.plColNetIncome || 'Net Income'}</span>
                  <span>{t.plColNetPct    || 'Net %'}</span>
                </div>
                {history.map(h => (
                  <div
                    key={h.month}
                    className={`pl-history-row ${h.month === selectedMonth ? 'active' : ''}`}
                    onClick={() => setSelectedMonth(h.month)}
                  >
                    <span>{formatMonthYear(h.month)}</span>
                    <span>{formatCurrency(h.revenue)}</span>
                    <span>{h.foodCostPct > 0 ? `${h.foodCostPct.toFixed(1)}%` : '—'}</span>
                    <span className={h.netIncome >= 0 ? 'pl-positive' : 'pl-negative'}>
                      {h.netIncome < 0 ? '−' : ''}{formatCurrency(Math.abs(h.netIncome))}
                    </span>
                    <span className={h.netPct >= 0 ? 'pl-positive' : 'pl-negative'}>
                      {h.netPct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

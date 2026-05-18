import { useState } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';
import { formatCurrency } from '@utils/helpers';
import './CostAnalysis.css';

const FAST_CASUAL_BENCHMARKS = {
  foodCostPct:      28,
  laborPct:         30,
  overheadPct:      16,
  targetMarginPct:  26,
};

function getRating(actual, target, lowerIsBetter, t) {
  const diff = actual - target;
  if (lowerIsBetter) {
    if (diff <= 0) return { label: t.onTarget,    color: '#4ade80' };
    if (diff <= 3) return { label: t.slightlyHigh, color: '#facc15' };
    return             { label: t.overTarget,     color: '#ff4f4f' };
  } else {
    if (diff >= 0)  return { label: t.onTarget,   color: '#4ade80' };
    if (diff >= -3) return { label: t.slightlyLow, color: '#facc15' };
    return              { label: t.underTarget,    color: '#ff4f4f' };
  }
}

function MetricBar({ label, actual, target, lowerIsBetter = true, suffix = '%', t }) {
  const rating   = getRating(actual, target, lowerIsBetter, t);
  const barWidth = Math.min(actual, 100);
  const targetPos = Math.min(target, 100);

  return (
    <div className="metric-bar-wrap">
      <div className="metric-bar-header">
        <span className="metric-bar-label">{label}</span>
        <div className="metric-bar-values">
          <span className="metric-actual" style={{ color: rating.color }}>
            {actual.toFixed(1)}{suffix}
          </span>
          <span className="metric-target">{t.targetPrefix} {target}{suffix}</span>
          <span className="metric-rating" style={{ color: rating.color }}>{rating.label}</span>
        </div>
      </div>
      <div className="metric-bar-track">
        <div className="metric-bar-fill" style={{ width: `${barWidth}%`, background: rating.color }} />
        <div className="metric-bar-target-line" style={{ left: `${targetPos}%` }} />
      </div>
    </div>
  );
}

export default function CostAnalysis({ items, itemCosts = {}, onItemCostsChange }) {
  const { t } = useLang();
  const [targets, setTargets]     = useState({ ...FAST_CASUAL_BENCHMARKS });
  const [showTargets, setShowTargets] = useState(false);
  const [activeItem, setActiveItem]   = useState(null);

  const revenue = items.reduce((s, item) => s + item.cost * item.quantity, 0);

  const totalIngredient = items.reduce((s, item, i) => s + (parseFloat((itemCosts[i] || {}).ingredient) || 0) * item.quantity, 0);
  const totalLabor      = items.reduce((s, item, i) => s + (parseFloat((itemCosts[i] || {}).labor)      || 0) * item.quantity, 0);
  const totalOverhead   = items.reduce((s, item, i) => s + (parseFloat((itemCosts[i] || {}).overhead)   || 0) * item.quantity, 0);

  const totalCost   = totalIngredient + totalLabor + totalOverhead;
  const totalProfit = revenue - totalCost;

  const foodCostPct = revenue > 0 ? (totalIngredient / revenue) * 100 : 0;
  const laborPct    = revenue > 0 ? (totalLabor      / revenue) * 100 : 0;
  const overheadPct = revenue > 0 ? (totalOverhead   / revenue) * 100 : 0;
  const marginPct   = revenue > 0 ? (totalProfit     / revenue) * 100 : 0;

  const hasCostData = totalCost > 0;

  const updateItemCost = (index, field, value) => {
    const updated = { ...itemCosts, [index]: { ...(itemCosts[index] || {}), [field]: value } };
    if (onItemCostsChange) onItemCostsChange(updated);
  };

  return (
    <div className="cost-analysis">
      <h2 className="page-title">{t.tabAnalysis}</h2>

      {/* ── TARGETS CONFIG ── */}
      <div className="ca-section">
        <div className="ca-section-header">
          <div>
            <h3 className="ca-section-title">{t.costTargetsTitle}</h3>
            <p className="ca-section-sub">{t.costTargetsSub}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowTargets(!showTargets)}>
            {showTargets ? t.hideTargets : t.editTargets}
          </button>
        </div>

        {showTargets && (
          <div className="targets-grid">
            {[
              { key: 'foodCostPct',     label: t.foodCostLabel, help: t.foodCostHelp },
              { key: 'laborPct',        label: t.laborLabel,    help: t.laborHelp },
              { key: 'overheadPct',     label: t.overheadLabel, help: t.overheadHelp },
              { key: 'targetMarginPct', label: t.marginLabel,   help: t.marginHelp },
            ].map(({ key, label, help }) => (
              <div className="target-field" key={key}>
                <label className="target-label">{label}</label>
                <p className="target-help">{help}</p>
                <div className="target-input-wrap">
                  <input className="form-input form-input-sm" type="number" min="0" max="100" step="0.5"
                    value={targets[key]}
                    onChange={(e) => setTargets(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))} />
                  <span className="target-suffix">%</span>
                </div>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={() => setTargets({ ...FAST_CASUAL_BENCHMARKS })}>
              {t.resetDefaults}
            </button>
          </div>
        )}
      </div>

      {/* ── ITEM COST ENTRY ── */}
      <div className="ca-section">
        <div className="ca-section-header">
          <div>
            <h3 className="ca-section-title">{t.itemCostTitle}</h3>
            <p className="ca-section-sub">{t.itemCostSub}</p>
          </div>
        </div>

        <div className="item-cost-list">
          {items.map((item, i) => {
            const c         = itemCosts[i] || {};
            const ing       = parseFloat(c.ingredient) || 0;
            const lab       = parseFloat(c.labor)      || 0;
            const ovh       = parseFloat(c.overhead)   || 0;
            const unitCost   = ing + lab + ovh;
            const unitProfit = item.cost - unitCost;
            const unitMargin = item.cost > 0 ? (unitProfit / item.cost) * 100 : 0;
            const isOpen     = activeItem === i;

            return (
              <div key={i} className={`item-cost-card ${isOpen ? 'open' : ''}`}>
                <div className="item-cost-card-header" onClick={() => setActiveItem(isOpen ? null : i)}>
                  <div className="item-cost-card-info">
                    <span className="item-cost-name">{item.name}</span>
                    <span className="item-cost-qty">{item.quantity}× @ {formatCurrency(item.cost)}</span>
                  </div>
                  <div className="item-cost-card-meta">
                    {unitCost > 0 && (
                      <span className={`item-margin-badge ${unitMargin >= targets.targetMarginPct ? 'good' : unitMargin >= targets.targetMarginPct - 5 ? 'warn' : 'bad'}`}>
                        {unitMargin.toFixed(1)}% {t.caMarginSuffix}
                      </span>
                    )}
                    <span className="item-cost-chevron">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="item-cost-fields">
                    <div className="item-cost-inputs">
                      {[
                        { field: 'ingredient', label: t.ingredientLabel,    help: t.ingredientHelp },
                        { field: 'labor',      label: t.laborCostLabel,     help: t.laborCostHelp },
                        { field: 'overhead',   label: t.overheadCostLabel,  help: t.overheadCostHelp },
                      ].map(({ field, label, help }) => (
                        <div className="item-cost-input-group" key={field}>
                          <label className="target-label">{label}</label>
                          <p className="target-help">{help}</p>
                          <div className="target-input-wrap">
                            <span className="target-prefix">$</span>
                            <input className="form-input form-input-sm" type="number" min="0" step="0.01"
                              placeholder="0.00" value={c[field] || ''}
                              onChange={(e) => updateItemCost(i, field, e.target.value)} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {unitCost > 0 && (
                      <div className="item-cost-summary">
                        <div className="ics-row">
                          <span>{t.unitCost}</span><span>{formatCurrency(unitCost)}</span>
                        </div>
                        <div className="ics-row">
                          <span>{t.sellingPrice}</span><span>{formatCurrency(item.cost)}</span>
                        </div>
                        <div className="ics-row ics-profit">
                          <span>{t.profitPerUnit}</span>
                          <span style={{ color: unitProfit >= 0 ? '#4ade80' : '#ff4f4f' }}>
                            {formatCurrency(unitProfit)}
                          </span>
                        </div>
                        <div className="ics-row ics-profit">
                          <span>{t.grossMargin}</span>
                          <span style={{ color: unitMargin >= targets.targetMarginPct ? '#4ade80' : '#ff4f4f' }}>
                            {unitMargin.toFixed(1)}%
                          </span>
                        </div>
                        <div className="ics-row">
                          <span>{t.totalFor} {item.quantity}×</span>
                          <span>{formatCurrency(unitProfit * item.quantity)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── OVERALL ANALYSIS ── */}
      {hasCostData && (
        <div className="ca-section">
          <div className="ca-section-header">
            <div>
              <h3 className="ca-section-title">{t.overallTitle}</h3>
              <p className="ca-section-sub">{t.overallSub}</p>
            </div>
          </div>

          <div className="metrics-grid">
            <div className="metric-card">
              <p className="metric-card-label">{t.totalRevenue}</p>
              <p className="metric-card-value">{formatCurrency(revenue)}</p>
            </div>
            <div className="metric-card">
              <p className="metric-card-label">{t.totalCost}</p>
              <p className="metric-card-value">{formatCurrency(totalCost)}</p>
            </div>
            <div className="metric-card">
              <p className="metric-card-label">{t.grossProfit}</p>
              <p className="metric-card-value" style={{ color: totalProfit >= 0 ? '#4ade80' : '#ff4f4f' }}>
                {formatCurrency(totalProfit)}
              </p>
            </div>
            <div className="metric-card highlight">
              <p className="metric-card-label">{t.profitMargin}</p>
              <p className="metric-card-value" style={{ color: marginPct >= targets.targetMarginPct ? '#4ade80' : '#ff4f4f' }}>
                {marginPct.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="bars-section">
            <MetricBar label={t.foodCostLabel} actual={foodCostPct} target={targets.foodCostPct} lowerIsBetter={true}  t={t} />
            <MetricBar label={t.laborLabel}    actual={laborPct}    target={targets.laborPct}    lowerIsBetter={true}  t={t} />
            <MetricBar label={t.overheadLabel} actual={overheadPct} target={targets.overheadPct} lowerIsBetter={true}  t={t} />
            <MetricBar label={t.profitMargin}  actual={marginPct}   target={targets.targetMarginPct} lowerIsBetter={false} t={t} />
          </div>

          <div className="cost-breakdown-bar">
            <p className="cbb-label">{t.costStackLabel}</p>
            <div className="cbb-track">
              <div className="cbb-seg seg-food"     style={{ width: `${Math.min(foodCostPct, 100)}%` }}           title={`${t.caFoodLabel} ${foodCostPct.toFixed(1)}%`} />
              <div className="cbb-seg seg-labor"    style={{ width: `${Math.min(laborPct, 100)}%` }}              title={`${t.caLaborLabel} ${laborPct.toFixed(1)}%`} />
              <div className="cbb-seg seg-overhead" style={{ width: `${Math.min(overheadPct, 100)}%` }}           title={`${t.caOverheadLabel} ${overheadPct.toFixed(1)}%`} />
              <div className="cbb-seg seg-profit"   style={{ width: `${Math.max(Math.min(marginPct, 100), 0)}%` }} title={`${t.caProfitLabel} ${marginPct.toFixed(1)}%`} />
            </div>
            <div className="cbb-legend">
              <span className="cbb-leg-item"><span className="cbb-dot dot-food"     />{t.caFoodLabel} ({foodCostPct.toFixed(1)}%)</span>
              <span className="cbb-leg-item"><span className="cbb-dot dot-labor"    />{t.caLaborLabel} ({laborPct.toFixed(1)}%)</span>
              <span className="cbb-leg-item"><span className="cbb-dot dot-overhead" />{t.caOverheadLabel} ({overheadPct.toFixed(1)}%)</span>
              <span className="cbb-leg-item"><span className="cbb-dot dot-profit"   />{t.caProfitLabel} ({marginPct.toFixed(1)}%)</span>
            </div>
          </div>
        </div>
      )}

      {!hasCostData && (
        <div className="ca-empty">
          <p>{t.enterCostsPrompt}</p>
        </div>
      )}
    </div>
  );
}

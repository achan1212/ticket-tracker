import { useState } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';
import { formatCurrency } from '@utils/helpers';
import './CostAnalysis.css';

// Fast casual industry average benchmarks (NRA / Toast / Deloitte data)
const FAST_CASUAL_BENCHMARKS = {
  foodCostPct: 28,    // Fast casual avg food cost 25-32%, midpoint ~28%
  laborPct: 30,       // Fast casual avg labor 28-33%, midpoint ~30%
  overheadPct: 16,    // Occupancy, utilities, packaging avg ~16%
  targetMarginPct: 26 // Fast casual avg net margin 20-30%, midpoint ~26%
};

function getRating(actual, target, lowerIsBetter = true) {
  const diff = actual - target;
  if (lowerIsBetter) {
    if (diff <= 0) return { label: t.onTarget, color: '#4ade80' };
    if (diff <= 3) return { label: t.slightlyHigh, color: '#facc15' };
    return { label: t.overTarget, color: '#ff4f4f' };
  } else {
    if (diff >= 0) return { label: t.onTarget, color: '#4ade80' };
    if (diff >= -3) return { label: t.slightlyLow, color: '#facc15' };
    return { label: t.underTarget, color: '#ff4f4f' };
  }
}

function MetricBar({ label, actual, target, lowerIsBetter = true, suffix = '%' }) {
  const rating = getRating(actual, target, lowerIsBetter);
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
          <span className="metric-target">target {target}{suffix}</span>
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
  const [targets, setTargets] = useState({ ...FAST_CASUAL_BENCHMARKS });
  // itemCosts is lifted to parent // { itemKey: { ingredient, labor, overhead } }
  const [showTargets, setShowTargets] = useState(false);
  const [activeItem, setActiveItem] = useState(null);

  const revenue = items.reduce((s, item) => s + item.cost * item.quantity, 0);

  // Calculate totals from entered item costs
  const totalIngredient = items.reduce((s, item, i) => {
    const c = itemCosts[i] || {};
    return s + (parseFloat(c.ingredient) || 0) * item.quantity;
  }, 0);

  const totalLabor = items.reduce((s, item, i) => {
    const c = itemCosts[i] || {};
    return s + (parseFloat(c.labor) || 0) * item.quantity;
  }, 0);

  const totalOverhead = items.reduce((s, item, i) => {
    const c = itemCosts[i] || {};
    return s + (parseFloat(c.overhead) || 0) * item.quantity;
  }, 0);

  const totalCost = totalIngredient + totalLabor + totalOverhead;
  const totalProfit = revenue - totalCost;

  const foodCostPct = revenue > 0 ? (totalIngredient / revenue) * 100 : 0;
  const laborPct = revenue > 0 ? (totalLabor / revenue) * 100 : 0;
  const overheadPct = revenue > 0 ? (totalOverhead / revenue) * 100 : 0;
  const marginPct = revenue > 0 ? (totalProfit / revenue) * 100 : 0;

  const hasCostData = totalCost > 0;

  const updateItemCost = (index, field, value) => {
    const updated = { ...itemCosts, [index]: { ...(itemCosts[index] || {}), [field]: value } };
    if (onItemCostsChange) onItemCostsChange(updated);
  };

  const updateTarget = (field, value) => {
    setTargets(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  return (
    <div className="cost-analysis">

      {/* ── TARGETS CONFIG ────────────────────── */}
      <div className="ca-section">
        <div className="ca-section-header">
          <div>
            <h3 className="ca-section-title">Cost Targets</h3>
            <p className="ca-section-sub">{t.costTargetsSub}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowTargets(!showTargets)}>
            {showTargets ? t.hideTargets : t.editTargets}
          </button>
        </div>

        {showTargets && (
          <div className="targets-grid">
            {[
              { key: 'foodCostPct', label: t.foodCostLabel, help: t.foodCostHelp },
              { key: 'laborPct', label: t.laborLabel, help: t.laborHelp },
              { key: 'overheadPct', label: t.overheadLabel, help: t.overheadHelp },
              { key: 'targetMarginPct', label: t.marginLabel, help: t.marginHelp },
            ].map(({ key, label, help }) => (
              <div className="target-field" key={key}>
                <label className="target-label">{label}</label>
                <p className="target-help">{help}</p>
                <div className="target-input-wrap">
                  <input
                    className="form-input form-input-sm"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={targets[key]}
                    onChange={(e) => updateTarget(key, e.target.value)}
                  />
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

      {/* ── ITEM COST ENTRY ───────────────────── */}
      <div className="ca-section">
        <div className="ca-section-header">
          <div>
            <h3 className="ca-section-title">Item Cost Breakdown</h3>
            <p className="ca-section-sub">Enter ingredient, labor, and overhead cost per unit for each item.</p>
          </div>
        </div>

        <div className="item-cost-list">
          {items.map((item, i) => {
            const c = itemCosts[i] || {};
            const ing = parseFloat(c.ingredient) || 0;
            const lab = parseFloat(c.labor) || 0;
            const ovh = parseFloat(c.overhead) || 0;
            const unitCost = ing + lab + ovh;
            const unitProfit = item.cost - unitCost;
            const unitMargin = item.cost > 0 ? (unitProfit / item.cost) * 100 : 0;
            const isOpen = activeItem === i;

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
                        {unitMargin.toFixed(1)}% margin
                      </span>
                    )}
                    <span className="item-cost-chevron">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="item-cost-fields">
                    <div className="item-cost-inputs">
                      {[
                        { field: 'ingredient', label: t.ingredientLabel, placeholder: '0.00', help: t.ingredientHelp },
                        { field: 'labor', label: t.laborCostLabel, placeholder: '0.00', help: t.laborCostHelp },
                        { field: 'overhead', label: t.overheadCostLabel, placeholder: '0.00', help: t.overheadCostHelp },
                      ].map(({ field, label, placeholder, help }) => (
                        <div className="item-cost-input-group" key={field}>
                          <label className="target-label">{label}</label>
                          <p className="target-help">{help}</p>
                          <div className="target-input-wrap">
                            <span className="target-prefix">$</span>
                            <input
                              className="form-input form-input-sm"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder={placeholder}
                              value={c[field] || ''}
                              onChange={(e) => updateItemCost(i, field, e.target.value)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {unitCost > 0 && (
                      <div className="item-cost-summary">
                        <div className="ics-row">
                          <span>Unit cost</span><span>{formatCurrency(unitCost)}</span>
                        </div>
                        <div className="ics-row">
                          <span>Selling price</span><span>{formatCurrency(item.cost)}</span>
                        </div>
                        <div className="ics-row ics-profit">
                          <span>Profit per unit</span>
                          <span style={{ color: unitProfit >= 0 ? '#4ade80' : '#ff4f4f' }}>
                            {formatCurrency(unitProfit)}
                          </span>
                        </div>
                        <div className="ics-row ics-profit">
                          <span>Gross margin</span>
                          <span style={{ color: unitMargin >= targets.targetMarginPct ? '#4ade80' : '#ff4f4f' }}>
                            {unitMargin.toFixed(1)}%
                          </span>
                        </div>
                        <div className="ics-row">
                          <span>Total for {item.quantity}×</span>
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

      {/* ── OVERALL ANALYSIS ─────────────────── */}
      {hasCostData && (
        <div className="ca-section">
          <div className="ca-section-header">
            <div>
              <h3 className="ca-section-title">Overall Performance</h3>
              <p className="ca-section-sub">Compared against your targets</p>
            </div>
          </div>

          <div className="metrics-grid">
            <div className="metric-card">
              <p className="metric-card-label">Total Revenue</p>
              <p className="metric-card-value">{formatCurrency(revenue)}</p>
            </div>
            <div className="metric-card">
              <p className="metric-card-label">Total Cost</p>
              <p className="metric-card-value">{formatCurrency(totalCost)}</p>
            </div>
            <div className="metric-card">
              <p className="metric-card-label">Gross Profit</p>
              <p className="metric-card-value" style={{ color: totalProfit >= 0 ? '#4ade80' : '#ff4f4f' }}>
                {formatCurrency(totalProfit)}
              </p>
            </div>
            <div className="metric-card highlight">
              <p className="metric-card-label">Profit Margin</p>
              <p className="metric-card-value" style={{ color: marginPct >= targets.targetMarginPct ? '#4ade80' : '#ff4f4f' }}>
                {marginPct.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="bars-section">
            <MetricBar label="Food Cost %" actual={foodCostPct} target={targets.foodCostPct} />
            <MetricBar label="Labor %" actual={laborPct} target={targets.laborPct} />
            <MetricBar label="Overhead %" actual={overheadPct} target={targets.overheadPct} />
            <MetricBar label="Profit Margin %" actual={marginPct} target={targets.targetMarginPct} lowerIsBetter={false} />
          </div>

          <div className="cost-breakdown-bar">
            <p className="cbb-label">Cost Stack (% of revenue)</p>
            <div className="cbb-track">
              <div className="cbb-seg seg-food" style={{ width: `${Math.min(foodCostPct, 100)}%` }} title={`Food ${foodCostPct.toFixed(1)}%`} />
              <div className="cbb-seg seg-labor" style={{ width: `${Math.min(laborPct, 100)}%` }} title={`Labor ${laborPct.toFixed(1)}%`} />
              <div className="cbb-seg seg-overhead" style={{ width: `${Math.min(overheadPct, 100)}%` }} title={`Overhead ${overheadPct.toFixed(1)}%`} />
              <div className="cbb-seg seg-profit" style={{ width: `${Math.max(Math.min(marginPct, 100), 0)}%` }} title={`Profit ${marginPct.toFixed(1)}%`} />
            </div>
            <div className="cbb-legend">
              <span className="cbb-leg-item"><span className="cbb-dot dot-food" />Food ({foodCostPct.toFixed(1)}%)</span>
              <span className="cbb-leg-item"><span className="cbb-dot dot-labor" />Labor ({laborPct.toFixed(1)}%)</span>
              <span className="cbb-leg-item"><span className="cbb-dot dot-overhead" />Overhead ({overheadPct.toFixed(1)}%)</span>
              <span className="cbb-leg-item"><span className="cbb-dot dot-profit" />Profit ({marginPct.toFixed(1)}%)</span>
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

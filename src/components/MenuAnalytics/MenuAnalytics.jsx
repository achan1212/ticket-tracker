import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { useLang } from '../../i18n/LangContext.jsx';
import { formatCurrency } from '@utils/helpers';
import { useMenuCosts } from '@hooks/useMenuCosts';
import {
  aggregateMenuItems,
  totalRevenueAcrossPeriods,
  withMatrixDimensions,
} from '@utils/menuAggregation';
import './MenuAnalytics.css';

const SORT_OPTIONS = [
  { key: 'totalRevenue',    field: 'totalRevenue',    direction: 'desc', labelKey: 'menuSortRevenue' },
  { key: 'occurrences',     field: 'occurrences',     direction: 'desc', labelKey: 'menuSortFrequency' },
  { key: 'avgPerOccurrence',field: 'avgPerOccurrence',direction: 'desc', labelKey: 'menuSortAvg' },
  { key: 'marginPct',       field: 'marginPct',       direction: 'desc', labelKey: 'menuSortMargin' },
  { key: 'lastSeen',        field: 'lastSeen',        direction: 'desc', labelKey: 'menuSortRecent' },
];

// Quadrant tokens — Stars / Plowhorses / Puzzles / Dogs (Kasavana–Smith model).
const QUADRANTS = {
  star:      { color: '#22c55e', labelKey: 'menuQuadStar',      hintKey: 'menuQuadStarHint' },
  plowhorse: { color: '#f59e0b', labelKey: 'menuQuadPlowhorse', hintKey: 'menuQuadPlowhorseHint' },
  puzzle:    { color: '#3b82f6', labelKey: 'menuQuadPuzzle',    hintKey: 'menuQuadPuzzleHint' },
  dog:       { color: '#ef4444', labelKey: 'menuQuadDog',       hintKey: 'menuQuadDogHint' },
};

function formatPeriodKey(key) {
  if (!key) return '—';
  if (key.length === 10) {
    const [y, m, d] = key.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (key.length === 7) {
    const [y, m] = key.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  return key;
}

function MatrixTooltip({ active, payload, t }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const q = QUADRANTS[p.quadrant];
  return (
    <div className="chart-tooltip menu-tooltip">
      <p className="ct-label">{p.name}</p>
      <p className="menu-tooltip-quad" style={{ color: q.color }}>{t[q.labelKey] || p.quadrant.toUpperCase()}</p>
      <p className="ct-row"><span>{t.menuColTotal || 'Revenue'}</span><span>{formatCurrency(p.totalRevenue)}</span></p>
      <p className="ct-row"><span>{t.menuColCostPct || 'Food cost %'}</span><span>{p.foodCostPct.toFixed(1)}%</span></p>
      <p className="ct-row"><span>{t.menuColMargin || 'Margin %'}</span><span>{p.marginPct.toFixed(1)}%</span></p>
      <p className="ct-row"><span>{t.menuColOccurrences || 'Times'}</span><span>{p.occurrences}</span></p>
    </div>
  );
}

export default function MenuAnalytics({ days = {}, months = {}, dailySummary = [], foodCostByDay = {} }) {
  const { t } = useLang();
  const [view, setView] = useState('table');
  const [sortKey, setSortKey] = useState('totalRevenue');
  const [query, setQuery] = useState('');

  const { costs, setItemCost, clearItemCost } = useMenuCosts();

  const baseItems = useMemo(
    () => aggregateMenuItems({ days, months, dailySummary }),
    [days, months, dailySummary]
  );

  const totalRevenue = useMemo(
    () => totalRevenueAcrossPeriods({ days, months }),
    [days, months]
  );

  // Global food-cost % derived from food cost imports vs. revenue. Used as
  // the fallback when an item has no explicit per-item cost set. If there's
  // no food cost data yet, fall back to a 30% industry-healthy default so
  // the matrix still renders something meaningful.
  const globalFoodCostPct = useMemo(() => {
    const totalFC = Object.values(foodCostByDay).reduce((s, v) => s + v, 0);
    if (totalRevenue > 0 && totalFC > 0) return (totalFC / totalRevenue) * 100;
    return 30;
  }, [foodCostByDay, totalRevenue]);

  const { items: matrixItems, thresholds } = useMemo(
    () => withMatrixDimensions(baseItems, costs, globalFoodCostPct),
    [baseItems, costs, globalFoodCostPct]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? matrixItems.filter(i => i.name.toLowerCase().includes(q))
      : matrixItems.slice();
    const opt = SORT_OPTIONS.find(o => o.key === sortKey) || SORT_OPTIONS[0];
    list.sort((a, b) => {
      const av = a[opt.field];
      const bv = b[opt.field];
      if (typeof av === 'string') return opt.direction === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv);
      return opt.direction === 'desc' ? bv - av : av - bv;
    });
    return list;
  }, [matrixItems, sortKey, query]);

  const aggregateTotal = useMemo(
    () => matrixItems.reduce((s, i) => s + i.totalRevenue, 0),
    [matrixItems]
  );

  if (matrixItems.length === 0) {
    return (
      <div className="menu-wrap">
        <h2 className="page-title">{t.tabMenu || 'Menu Analytics'}</h2>
        <p className="page-subtitle">{t.menuSub}</p>
        <div className="menu-empty">{t.menuEmpty}</div>
      </div>
    );
  }

  const handleCostChange = (name, raw) => {
    const v = parseFloat(raw);
    if (raw === '' || !Number.isFinite(v)) clearItemCost(name);
    else setItemCost(name, v);
  };

  // Quadrant counts for the legend strip.
  const counts = { star: 0, plowhorse: 0, puzzle: 0, dog: 0 };
  for (const i of matrixItems) counts[i.quadrant] += 1;

  return (
    <div className="menu-wrap">
      <h2 className="page-title">{t.tabMenu || 'Menu Analytics'}</h2>
      <p className="page-subtitle">{t.menuSub}</p>

      <div className="menu-header-stats">
        <div className="menu-stat">
          <span className="menu-stat-label">{t.menuStatItems || 'Items'}</span>
          <span className="menu-stat-value">{matrixItems.length}</span>
        </div>
        <div className="menu-stat">
          <span className="menu-stat-label">{t.menuStatTotal || 'Tracked'}</span>
          <span className="menu-stat-value">{formatCurrency(aggregateTotal)}</span>
        </div>
        {totalRevenue > 0 && (
          <div className="menu-stat">
            <span className="menu-stat-label">{t.menuStatShare || '% of revenue'}</span>
            <span className="menu-stat-value">{((aggregateTotal / totalRevenue) * 100).toFixed(0)}%</span>
          </div>
        )}
        <div className="menu-stat">
          <span className="menu-stat-label">{t.menuStatGlobalCost || 'Avg food cost'}</span>
          <span className="menu-stat-value">{globalFoodCostPct.toFixed(1)}%</span>
        </div>
      </div>

      <div className="menu-view-toggle">
        <button
          type="button"
          className={`filter-pill ${view === 'table' ? 'active' : ''}`}
          onClick={() => setView('table')}
        >{t.menuViewTable || 'Table'}</button>
        <button
          type="button"
          className={`filter-pill ${view === 'matrix' ? 'active' : ''}`}
          onClick={() => setView('matrix')}
        >{t.menuViewMatrix || 'Matrix'}</button>
      </div>

      {view === 'table' && (
        <>
          <div className="menu-controls">
            <div className="menu-sort-pills">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  className={`filter-pill ${sortKey === opt.key ? 'active' : ''}`}
                  onClick={() => setSortKey(opt.key)}
                >
                  {t[opt.labelKey] || opt.key}
                </button>
              ))}
            </div>
            <input
              className="form-input menu-search"
              type="search"
              placeholder={t.menuSearchPlaceholder || 'Search items…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="menu-table-wrap">
            <table className="menu-table">
              <thead>
                <tr>
                  <th>{t.menuColRank || '#'}</th>
                  <th>{t.menuColItem || 'Item'}</th>
                  <th>{t.menuColTotal || 'Total'}</th>
                  <th>{t.menuColCostPct || 'Cost %'}</th>
                  <th>{t.menuColMargin || 'Margin %'}</th>
                  <th>{t.menuColOccurrences || 'Times'}</th>
                  <th>{t.menuColQuadrant || 'Quadrant'}</th>
                  <th>{t.menuColLast || 'Last seen'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const q = QUADRANTS[row.quadrant];
                  const isExplicit = row.foodCostUsed === 'explicit';
                  return (
                    <tr key={row.name}>
                      <td className="menu-rank">{i + 1}</td>
                      <td className="menu-name">
                        <span className="menu-name-text">{row.name}</span>
                      </td>
                      <td className="menu-total">{formatCurrency(row.totalRevenue)}</td>
                      <td className="menu-cost-cell">
                        <div className="menu-cost-wrap">
                          <input
                            type="number"
                            className="form-input menu-cost-input"
                            min="0" max="100" step="0.5"
                            value={isExplicit ? row.foodCostPct : ''}
                            placeholder={row.foodCostPct.toFixed(1)}
                            onChange={(e) => handleCostChange(row.name, e.target.value)}
                          />
                          <span className="menu-cost-suffix">%</span>
                          {!isExplicit && <span className="menu-cost-auto" title={t.menuCostAutoTitle || 'Using global rate'}>{t.menuCostAuto || 'auto'}</span>}
                        </div>
                      </td>
                      <td className="menu-margin">{row.marginPct.toFixed(1)}%</td>
                      <td className="menu-count">{row.occurrences}</td>
                      <td>
                        <span className="menu-quadrant-pill" style={{ background: `${q.color}22`, color: q.color, border: `1px solid ${q.color}40` }}>
                          {t[q.labelKey] || row.quadrant}
                        </span>
                      </td>
                      <td className="menu-last">{formatPeriodKey(row.lastSeen)}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan="8" className="menu-empty-row">{t.menuNoMatch || 'No items match your search.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'matrix' && (
        <>
          <div className="menu-quadrant-legend">
            {Object.entries(QUADRANTS).map(([k, q]) => (
              <div key={k} className="menu-legend-item">
                <span className="menu-legend-dot" style={{ background: q.color }} />
                <div className="menu-legend-text">
                  <span className="menu-legend-name" style={{ color: q.color }}>{t[q.labelKey] || k}</span>
                  <span className="menu-legend-hint">{t[q.hintKey] || ''}</span>
                </div>
                <span className="menu-legend-count">{counts[k]}</span>
              </div>
            ))}
          </div>

          <div className="menu-matrix-wrap">
            <ResponsiveContainer width="100%" height={460}>
              <ScatterChart margin={{ top: 20, right: 30, bottom: 50, left: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  type="number"
                  dataKey="totalRevenue"
                  name={t.menuAxisRevenue || 'Total revenue'}
                  tickFormatter={(v) => formatCurrency(v)}
                  stroke="var(--text-muted)"
                  label={{ value: t.menuAxisRevenue || 'Popularity (Total revenue)', position: 'insideBottom', offset: -10, fill: 'var(--text-muted)' }}
                />
                <YAxis
                  type="number"
                  dataKey="marginPct"
                  name={t.menuAxisMargin || 'Margin %'}
                  unit="%"
                  stroke="var(--text-muted)"
                  label={{ value: t.menuAxisMargin || 'Profitability (Margin %)', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)' }}
                />
                <ReferenceLine x={thresholds.rev}    stroke="var(--text-muted)" strokeDasharray="4 4" />
                <ReferenceLine y={thresholds.margin} stroke="var(--text-muted)" strokeDasharray="4 4" />
                <Tooltip content={<MatrixTooltip t={t} />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter
                  data={matrixItems}
                  shape={(props) => {
                    const { cx, cy, payload } = props;
                    const color = QUADRANTS[payload.quadrant]?.color || 'var(--accent)';
                    return <circle cx={cx} cy={cy} r={7} fill={color} fillOpacity={0.75} stroke={color} strokeWidth={1} />;
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <p className="menu-matrix-note">
            {t.menuMatrixNote || 'Quadrant split: median revenue × median margin across the items shown. Edit per-item Cost % in the Table view to refine.'}
          </p>
        </>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';
import { formatCurrency } from '@utils/helpers';
import { aggregateMenuItems, totalRevenueAcrossPeriods } from '@utils/menuAggregation';
import './MenuAnalytics.css';

const SORT_OPTIONS = [
  { key: 'totalRevenue',    field: 'totalRevenue',    direction: 'desc', labelKey: 'menuSortRevenue' },
  { key: 'occurrences',     field: 'occurrences',     direction: 'desc', labelKey: 'menuSortFrequency' },
  { key: 'avgPerOccurrence',field: 'avgPerOccurrence',direction: 'desc', labelKey: 'menuSortAvg' },
  { key: 'lastSeen',        field: 'lastSeen',        direction: 'desc', labelKey: 'menuSortRecent' },
];

function formatPeriodKey(key) {
  if (!key) return '—';
  // YYYY-MM-DD (day) vs YYYY-MM (month)
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

export default function MenuAnalytics({ days = {}, months = {}, dailySummary = [] }) {
  const { t } = useLang();
  const [sortKey, setSortKey] = useState('totalRevenue');
  const [query, setQuery] = useState('');

  const items = useMemo(
    () => aggregateMenuItems({ days, months, dailySummary }),
    [days, months, dailySummary]
  );

  const totalRevenue = useMemo(
    () => totalRevenueAcrossPeriods({ days, months }),
    [days, months]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? items.filter(i => i.name.toLowerCase().includes(q))
      : items.slice();
    const opt = SORT_OPTIONS.find(o => o.key === sortKey) || SORT_OPTIONS[0];
    list.sort((a, b) => {
      const av = a[opt.field];
      const bv = b[opt.field];
      if (typeof av === 'string') return opt.direction === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv);
      return opt.direction === 'desc' ? bv - av : av - bv;
    });
    return list;
  }, [items, sortKey, query]);

  const aggregateTotal = useMemo(
    () => items.reduce((s, i) => s + i.totalRevenue, 0),
    [items]
  );

  if (items.length === 0) {
    return (
      <div className="menu-wrap">
        <div className="menu-header">
          <div>
            <h2 className="menu-title">{t.menuTitle || 'Menu Analytics'}</h2>
            <p className="menu-sub">{t.menuSub || 'Aggregates every category you have entered or scanned across daily and monthly summaries. Push more receipts from the Scanner tab to populate this view.'}</p>
          </div>
        </div>
        <div className="menu-empty">
          {t.menuEmpty || 'No category data yet. Add categories on a daily summary entry, or scan a sales report and push it to a day.'}
        </div>
      </div>
    );
  }

  // Find the max for the inline bar chart
  const maxRev = filtered.reduce((m, i) => Math.max(m, i.totalRevenue), 0);

  return (
    <div className="menu-wrap">
      <div className="menu-header">
        <div>
          <h2 className="menu-title">{t.menuTitle || 'Menu Analytics'}</h2>
          <p className="menu-sub">{t.menuSub || 'Aggregates every category you have entered or scanned across daily and monthly summaries.'}</p>
        </div>
        <div className="menu-header-stats">
          <div className="menu-stat">
            <span className="menu-stat-label">{t.menuStatItems || 'Items'}</span>
            <span className="menu-stat-value">{items.length}</span>
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
        </div>
      </div>

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
              <th>{t.menuColShare || 'Share'}</th>
              <th>{t.menuColOccurrences || 'Times'}</th>
              <th>{t.menuColAvg || 'Avg / time'}</th>
              <th>{t.menuColBest || 'Best day'}</th>
              <th>{t.menuColLast || 'Last seen'}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const share = aggregateTotal > 0 ? (row.totalRevenue / aggregateTotal) * 100 : 0;
              const barWidth = maxRev > 0 ? (row.totalRevenue / maxRev) * 100 : 0;
              return (
                <tr key={row.name}>
                  <td className="menu-rank">{i + 1}</td>
                  <td className="menu-name">
                    <span className="menu-name-text">{row.name}</span>
                    <span className="menu-bar"><span className="menu-bar-fill" style={{ width: `${barWidth}%` }} /></span>
                  </td>
                  <td className="menu-total">{formatCurrency(row.totalRevenue)}</td>
                  <td className="menu-share">{share.toFixed(1)}%</td>
                  <td className="menu-count">{row.occurrences}</td>
                  <td className="menu-avg">{formatCurrency(row.avgPerOccurrence)}</td>
                  <td className="menu-best">
                    <span className="menu-best-amt">{formatCurrency(row.bestPeriod.amount)}</span>
                    <span className="menu-best-period">{formatPeriodKey(row.bestPeriod.periodKey)}</span>
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
    </div>
  );
}

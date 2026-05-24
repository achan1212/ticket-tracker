import { useState, useMemo } from 'react';
import { formatCurrency } from '@utils/helpers';
import PlatformBreakdown from '@components/PlatformBreakdown/PlatformBreakdown';
import { useLang } from '../../i18n/LangContext.jsx';
import './MonthlySummaryTable.css';

function currentMonthISO() {
  return new Date().toISOString().slice(0, 7);
}

function formatMonthYear(monthKey) {
  const [year, month] = monthKey.split('-');
  return new Date(parseInt(year), parseInt(month) - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDate(iso) {
  const [year, month, day] = iso.split('-');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function MonthForm({ initial, onSave, onCancel }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    deliveryRevenue: initial?.deliveryRevenue || '',
    pickupRevenue:   initial?.pickupRevenue   || '',
    deliveryOrders:  initial?.deliveryOrders  || '',
    pickupOrders:    initial?.pickupOrders    || '',
    totalRevenue:    initial?.totalRevenue    || '',
    categories:      initial?.categories      || {},
    notes:           initial?.notes           || '',
  });
  const [categoryInput, setCategoryInput] = useState({ name: '', cost: '' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addCategory = () => {
    if (!categoryInput.name.trim() || !categoryInput.cost) return;
    const cost = parseFloat(categoryInput.cost);
    if (isNaN(cost) || cost < 0) return;
    setForm(f => ({
      ...f,
      categories: { ...f.categories, [categoryInput.name.trim()]: cost }
    }));
    setCategoryInput({ name: '', cost: '' });
  };

  const removeCategory = (name) => {
    setForm(f => {
      const newCategories = { ...f.categories };
      delete newCategories[name];
      return { ...f, categories: newCategories };
    });
  };

  const breakdownTotal = (parseFloat(form.deliveryRevenue) || 0) + (parseFloat(form.pickupRevenue) || 0);
  const totalRevenueOverride = parseFloat(form.totalRevenue) || 0;
  // If the user typed a total, it wins; otherwise auto-sum from delivery + pickup.
  const effectiveTotalRevenue = totalRevenueOverride > 0 ? totalRevenueOverride : breakdownTotal;
  const totalOrders   = (parseInt(form.deliveryOrders)    || 0) + (parseInt(form.pickupOrders)    || 0);
  const categoryTotal = Object.values(form.categories).reduce((sum, val) => sum + val, 0);
  const hasCategories = Object.keys(form.categories).length > 0;
  const categoryMatch = hasCategories ? Math.abs(categoryTotal - effectiveTotalRevenue) < 0.01 : true;

  const handleSave = () => {
    onSave({
      deliveryRevenue: parseFloat(form.deliveryRevenue) || 0,
      pickupRevenue:   parseFloat(form.pickupRevenue)   || 0,
      deliveryOrders:  parseInt(form.deliveryOrders)    || 0,
      pickupOrders:    parseInt(form.pickupOrders)      || 0,
      totalRevenue:    totalRevenueOverride,
      categories:      form.categories,
      notes:           form.notes.trim(),
      source:          'manual',
    });
  };

  return (
    <div className="day-form">
      <div className="day-form-grid">
        <div className="day-form-section">
          <p className="day-form-section-label">{t.labelDelivery}</p>
          <div className="day-form-row">
            <div className="day-form-field">
              <label className="target-label">{t.labelRevenue}</label>
              <div className="target-input-wrap">
                <span className="target-prefix">$</span>
                <input className="form-input form-input-sm" type="number" min="0" step="0.01"
                  placeholder="0.00" value={form.deliveryRevenue}
                  onChange={e => set('deliveryRevenue', e.target.value)} />
              </div>
            </div>
            <div className="day-form-field">
              <label className="target-label">{t.labelOrders}</label>
              <input className="form-input form-input-sm" type="number" min="0" step="1"
                placeholder="0" value={form.deliveryOrders}
                onChange={e => set('deliveryOrders', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="day-form-section">
          <p className="day-form-section-label">{t.labelPickup}</p>
          <div className="day-form-row">
            <div className="day-form-field">
              <label className="target-label">{t.labelRevenue}</label>
              <div className="target-input-wrap">
                <span className="target-prefix">$</span>
                <input className="form-input form-input-sm" type="number" min="0" step="0.01"
                  placeholder="0.00" value={form.pickupRevenue}
                  onChange={e => set('pickupRevenue', e.target.value)} />
              </div>
            </div>
            <div className="day-form-field">
              <label className="target-label">{t.labelOrders}</label>
              <input className="form-input form-input-sm" type="number" min="0" step="1"
                placeholder="0" value={form.pickupOrders}
                onChange={e => set('pickupOrders', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="day-form-section" style={{ marginTop: '0.75rem' }}>
        <p className="day-form-section-label">{t.formTotalRevenueLabel || 'Total Revenue'}</p>
        <div className="day-form-row">
          <div className="day-form-field">
            <label className="target-label">{t.labelRevenue}</label>
            <div className="target-input-wrap">
              <span className="target-prefix">$</span>
              <input
                className="form-input form-input-sm"
                type="number" min="0" step="0.01"
                placeholder={breakdownTotal > 0 ? breakdownTotal.toFixed(2) : '0.00'}
                value={form.totalRevenue}
                onChange={e => set('totalRevenue', e.target.value)}
              />
            </div>
          </div>
        </div>
        <p className="category-help-text">
          {t.formTotalRevenueHint || 'Leave blank to auto-sum from Delivery + Pickup. Set explicitly when the total includes revenue outside those channels.'}
        </p>
      </div>

      <div className="day-form-field" style={{ marginTop: '0.75rem' }}>
        <label className="target-label">{t.formNotesOptional}</label>
        <input className="form-input" placeholder={t.formNotesPlaceholderMonth}
          value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      <div className="day-form-section" style={{ marginTop: '0.75rem' }}>
        <label className="day-form-section-label">{t.revenueCategories}</label>
        <p className="category-help-text">{t.categoriesHelpText}</p>

        {Object.keys(form.categories).length > 0 && (
          <div className="category-list">
            {Object.entries(form.categories).map(([name, cost]) => (
              <div key={name} className="category-item">
                <span className="category-name">{name}</span>
                <span className="category-cost">{formatCurrency(cost)}</span>
                <button type="button" className="btn-remove-category" onClick={() => removeCategory(name)}>×</button>
              </div>
            ))}
          </div>
        )}

        <div className="category-input-row">
          <input
            className="form-input"
            placeholder={t.categoryNamePlaceholder}
            value={categoryInput.name}
            onChange={e => setCategoryInput(prev => ({ ...prev, name: e.target.value }))}
            onKeyPress={e => e.key === 'Enter' && addCategory()}
          />
          <div className="target-input-wrap" style={{ minWidth: '120px' }}>
            <span className="target-prefix">$</span>
            <input
              className="form-input form-input-sm"
              type="number" min="0" step="0.01" placeholder="0.00"
              value={categoryInput.cost}
              onChange={e => setCategoryInput(prev => ({ ...prev, cost: e.target.value }))}
              onKeyPress={e => e.key === 'Enter' && addCategory()}
            />
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addCategory}>{t.addShortBtn}</button>
        </div>

        {hasCategories && !categoryMatch && (
          <div className="category-warning">
            {t.categoryWarningPre} {formatCurrency(categoryTotal)} {t.categoryWarningMid} {formatCurrency(effectiveTotalRevenue)}
          </div>
        )}
      </div>

      <div className="day-form-totals">
        <span className="dft-item">{t.formTotalRevenue} <strong>{formatCurrency(effectiveTotalRevenue)}</strong></span>
        <span className="dft-item">{t.formTotalOrders} <strong>{totalOrders}</strong></span>
        {totalOrders > 0 && (
          <span className="dft-item">{t.formAvgLabel} <strong>{formatCurrency(effectiveTotalRevenue / totalOrders)}</strong></span>
        )}
        {hasCategories && (
          <span className="dft-item">{t.formCategoryTotal} <strong style={{ color: categoryMatch ? 'inherit' : 'var(--danger)' }}>{formatCurrency(categoryTotal)}</strong></span>
        )}
      </div>

      <div className="day-form-actions">
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>{t.cancelBtn}</button>
        <button className="btn btn-primary btn-sm" onClick={handleSave}>{t.saveMonthBtn}</button>
      </div>
    </div>
  );
}

export default function MonthlySummaryTable({ dailySummary, months, onUpsertMonth, onRemoveMonth, foodCostByMonth = {} }) {
  const { t } = useLang();
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [editingMonth, setEditingMonth]   = useState(null);
  const [showAddForm, setShowAddForm]     = useState(false);
  const [addingMonth, setAddingMonth]     = useState(currentMonthISO());
  const [filterType, setFilterType]       = useState('all');

  const dailyByMonth = useMemo(() => {
    const byMonth = {};
    dailySummary.forEach(d => {
      const key = d.date.slice(0, 7);
      if (!byMonth[key]) {
        byMonth[key] = { deliveryRevenue: 0, pickupRevenue: 0, revenue: 0, deliveryOrders: 0, pickupOrders: 0, days: [] };
      }
      byMonth[key].deliveryRevenue += d.deliveryRevenue || 0;
      byMonth[key].pickupRevenue   += d.pickupRevenue   || 0;
      // `d.revenue` already honors any per-day totalRevenue override applied
      // by useOrderStore. Accumulate it separately so the monthly card uses
      // the override-aware total rather than just summing the channel fields.
      byMonth[key].revenue         += d.revenue          || 0;
      byMonth[key].deliveryOrders  += d.deliveryOrders   || 0;
      byMonth[key].pickupOrders    += d.pickupOrders     || 0;
      byMonth[key].days.push(d);
    });
    return byMonth;
  }, [dailySummary]);

  const allMonths = useMemo(() => {
    const keys = new Set([...Object.keys(dailyByMonth), ...Object.keys(months)]);
    return Array.from(keys).sort((a, b) => b.localeCompare(a)).map(key => {
      const daily  = dailyByMonth[key] || null;
      const manual = months[key]       || null;
      const deliveryRevenue = (daily?.deliveryRevenue || 0) + (manual?.deliveryRevenue || 0);
      const pickupRevenue   = (daily?.pickupRevenue   || 0) + (manual?.pickupRevenue   || 0);
      const deliveryOrders  = (daily?.deliveryOrders  || 0) + (manual?.deliveryOrders  || 0);
      const pickupOrders    = (daily?.pickupOrders    || 0) + (manual?.pickupOrders    || 0);
      // A manual `totalRevenue` overrides the channel sum for the manual
      // portion. Lets users record a month's bottom-line revenue without
      // requiring a full delivery/pickup breakdown.
      const manualTotalOverride = manual?.totalRevenue || 0;
      // dailyByMonth.revenue already honors per-day totalRevenue overrides.
      const dailyRevenue = daily?.revenue || 0;
      const manualRevenue = manualTotalOverride > 0
        ? manualTotalOverride
        : ((manual?.deliveryRevenue || 0) + (manual?.pickupRevenue || 0));
      const revenue    = dailyRevenue + manualRevenue;
      const orderCount = deliveryOrders  + pickupOrders;
      return {
        key, daily, manual, revenue, orderCount,
        deliveryRevenue, pickupRevenue,
        deliveryOrders, pickupOrders,
        avgOrderValue: orderCount > 0 ? revenue / orderCount : 0,
      };
    });
  }, [dailyByMonth, months]);

  const filteredMonths = allMonths.filter(m => {
    if (filterType === 'delivery') return (m.deliveryOrders || 0) > 0;
    if (filterType === 'pickup')   return (m.pickupOrders   || 0) > 0;
    return true;
  });

  const handleAddSave = (data) => {
    if (!addingMonth) return;
    onUpsertMonth(addingMonth, data);
    setShowAddForm(false);
    setAddingMonth(currentMonthISO());
  };

  const handleEditSave = (month, data) => {
    onUpsertMonth(month, data);
    setEditingMonth(null);
  };

  return (
    <div className="monthly-summary">
      <h2 className="page-title">{t.tabMonthly}</h2>

      <div className="ds-controls">
        <div className="ds-filter-pills">
          {[
            { key: 'all',      label: t.filterAll },
            { key: 'delivery', label: t.labelDelivery },
            { key: 'pickup',   label: t.labelPickup },
          ].map(f => (
            <button key={f.key} className={`filter-pill ${filterType === f.key ? 'active' : ''}`}
              onClick={() => setFilterType(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        <button className="btn btn-primary btn-sm"
          onClick={() => { setAddingMonth(currentMonthISO()); setShowAddForm(true); }}>
          {t.addMonthBtn}
        </button>
      </div>

      {showAddForm && (
        <div className="day-card">
          <div className="day-card-header" style={{ cursor: 'default' }}>
            <div className="day-date-col">
              <span className="day-date">{t.newMonthEntryLabel}</span>
            </div>
            <input type="month" className="form-input date-input"
              value={addingMonth} max={currentMonthISO()}
              onChange={e => setAddingMonth(e.target.value)}
              onClick={e => e.currentTarget.showPicker?.()} />
          </div>
          <MonthForm
            initial={{ deliveryRevenue: '', pickupRevenue: '', deliveryOrders: '', pickupOrders: '', categories: {}, notes: '' }}
            onSave={handleAddSave}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {!showAddForm && filteredMonths.length === 0 && (
        <div className="ds-empty">
          <p>{t.emptyMonthlyPre} <strong>{t.addMonthBtn}</strong> {t.emptyMonthlySuffix}</p>
          <button className="btn btn-primary"
            onClick={() => { setAddingMonth(currentMonthISO()); setShowAddForm(true); }}>
            {t.addThisMonthBtn}
          </button>
        </div>
      )}

      {filteredMonths.map(month => (
        <div key={month.key} className="day-card">
          <div className="day-card-header"
            onClick={() => setExpandedMonth(expandedMonth === month.key ? null : month.key)}>
            <div className="day-date-col">
              <span className="day-date">{formatMonthYear(month.key)}</span>
              <div className="day-type-pills">
                {month.deliveryRevenue > 0 && (
                  <span className="type-pill delivery">{t.labelDelivery} {formatCurrency(month.deliveryRevenue)}</span>
                )}
                {month.pickupRevenue > 0 && (
                  <span className="type-pill pickup">{t.labelPickup} {formatCurrency(month.pickupRevenue)}</span>
                )}
                {month.revenue > 0 && month.revenue !== month.deliveryRevenue && month.revenue !== month.pickupRevenue && (
                  <span className="type-pill total">{t.total || 'Total'} {formatCurrency(month.revenue)}</span>
                )}
                {month.daily && (
                  <span className="month-days-count">
                    {month.daily.days.length} {month.daily.days.length !== 1 ? t.daysPlural : t.days}
                  </span>
                )}
                {month.manual && month.manual.source === 'imported' && (
                  <span className="source-badge imported">{t.importedBadge}</span>
                )}
                {month.manual && month.manual.source !== 'imported' && (
                  <span className="source-badge manual">{t.manualBadge}</span>
                )}
                {month.manual?.categories && Object.keys(month.manual.categories).length > 0 && (
                  <span className="type-pill category-pill">💰 {Object.keys(month.manual.categories).length} {t.categoriesBadge}</span>
                )}
              </div>
            </div>

            <div className="day-stats">
              <div className="day-stat">
                <span className="day-stat-label">{t.labelRevenue}</span>
                <span className="day-stat-value">{formatCurrency(month.revenue)}</span>
              </div>
              <div className="day-stat">
                <span className="day-stat-label">{t.labelOrders}</span>
                <span className="day-stat-value">{month.orderCount}</span>
              </div>
              <div className="day-stat">
                <span className="day-stat-label">{t.labelAvg}</span>
                <span className="day-stat-value">
                  {month.orderCount > 0 ? formatCurrency(month.avgOrderValue) : '—'}
                </span>
              </div>
              {(() => {
                // Persisted foodCost on the month record wins over the live
                // derived total — so an explicit export survives if imports
                // are later deleted.
                const persisted = month.manual?.foodCost;
                const fc = (typeof persisted === 'number' && persisted > 0)
                  ? persisted
                  : foodCostByMonth[month.key];
                if (!fc) return null;
                const pct = month.revenue > 0 ? (fc / month.revenue) * 100 : null;
                const tone = pct == null ? '' : pct > 35 ? ' fc-high' : pct < 25 ? ' fc-low' : '';
                return (
                  <div className={`day-stat day-stat-fc${tone}`} title={`${t.foodCostStatTitle || 'Food cost'}: ${formatCurrency(fc)}`}>
                    <span className="day-stat-label">{t.foodCostStatLabel || 'Food %'}</span>
                    <span className="day-stat-value">{pct == null ? formatCurrency(fc) : `${pct.toFixed(1)}%`}</span>
                  </div>
                );
              })()}
            </div>

            <div className="day-actions">
              {month.manual && editingMonth !== month.key && (
                <button className="btn btn-ghost btn-sm"
                  onClick={e => { e.stopPropagation(); setEditingMonth(month.key); }}>
                  {t.editBtn}
                </button>
              )}
              {month.manual && (
                <button className="btn-remove" title="Delete manual entry"
                  onClick={e => { e.stopPropagation(); onRemoveMonth(month.key); }}>
                  ×
                </button>
              )}
            </div>
          </div>

          {editingMonth === month.key && (
            <MonthForm
              initial={months[month.key]}
              onSave={data => handleEditSave(month.key, data)}
              onCancel={() => setEditingMonth(null)}
            />
          )}

          {expandedMonth === month.key && editingMonth !== month.key && (
            <div className="month-day-list">
              <div style={{ padding: '0.75rem 1.5rem' }}>
                <PlatformBreakdown record={month.manual} />
              </div>
              {month.manual && (
                <div className={`month-day-row ${month.manual.source === 'imported' ? 'month-imported-row' : 'month-manual-row'}`}>
                  <div className="month-day-date">
                    <span className={`source-badge ${month.manual.source === 'imported' ? 'imported' : 'manual'}`}>
                      {month.manual.source === 'imported' ? t.importedEntryLabel : t.manualEntryLabel}
                    </span>
                  </div>
                  <div className="day-type-pills">
                    {(month.manual.deliveryRevenue || 0) > 0 && (
                      <span className="type-pill delivery">{t.labelDelivery} {formatCurrency(month.manual.deliveryRevenue)}</span>
                    )}
                    {(month.manual.pickupRevenue || 0) > 0 && (
                      <span className="type-pill pickup">{t.labelPickup} {formatCurrency(month.manual.pickupRevenue)}</span>
                    )}
                    {(() => {
                      const md = month.manual.deliveryRevenue || 0;
                      const mp = month.manual.pickupRevenue || 0;
                      const mt = (month.manual.totalRevenue || 0) > 0
                        ? month.manual.totalRevenue
                        : md + mp;
                      if (mt <= 0 || mt === md || mt === mp) return null;
                      return (
                        <span className="type-pill total">
                          {t.total || 'Total'} {formatCurrency(mt)}
                        </span>
                      );
                    })()}
                    {month.manual.notes && <span className="notes-pill">📝 {month.manual.notes}</span>}
                  </div>
                  <div className="day-stats">
                    <div className="day-stat">
                      <span className="day-stat-label">{t.labelRevenue}</span>
                      <span className="day-stat-value">
                        {formatCurrency(
                          (month.manual.totalRevenue || 0) > 0
                            ? month.manual.totalRevenue
                            : (month.manual.deliveryRevenue || 0) + (month.manual.pickupRevenue || 0)
                        )}
                      </span>
                    </div>
                    <div className="day-stat">
                      <span className="day-stat-label">{t.labelOrders}</span>
                      <span className="day-stat-value">
                        {(month.manual.deliveryOrders || 0) + (month.manual.pickupOrders || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {month.daily && [...month.daily.days]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(day => (
                  <div key={day.date} className="month-day-row">
                    <div className="month-day-date">{formatDate(day.date)}</div>
                    <div className="day-type-pills">
                      {(day.deliveryRevenue || 0) > 0 && (
                        <span className="type-pill delivery">{t.labelDelivery} {formatCurrency(day.deliveryRevenue)}</span>
                      )}
                      {(day.pickupRevenue || 0) > 0 && (
                        <span className="type-pill pickup">{t.labelPickup} {formatCurrency(day.pickupRevenue)}</span>
                      )}
                      {(day.revenue || 0) > 0 && day.revenue !== (day.deliveryRevenue || 0) && day.revenue !== (day.pickupRevenue || 0) && (
                        <span className="type-pill total">{t.total || 'Total'} {formatCurrency(day.revenue)}</span>
                      )}
                      {day.notes && <span className="notes-pill">📝 {day.notes}</span>}
                    </div>
                    <div className="day-stats">
                      <div className="day-stat">
                        <span className="day-stat-label">{t.labelRevenue}</span>
                        <span className="day-stat-value">{formatCurrency(day.revenue)}</span>
                      </div>
                      <div className="day-stat">
                        <span className="day-stat-label">{t.labelOrders}</span>
                        <span className="day-stat-value">{day.orderCount}</span>
                      </div>
                      <div className="day-stat">
                        <span className="day-stat-label">{t.labelAvg}</span>
                        <span className="day-stat-value">
                          {day.orderCount > 0 ? formatCurrency(day.avgOrderValue) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

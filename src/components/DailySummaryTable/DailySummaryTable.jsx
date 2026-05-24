import { useState } from 'react';
import { formatCurrency } from '@utils/helpers';
import PlatformBreakdown from '@components/PlatformBreakdown/PlatformBreakdown';
import { useLang } from '../../i18n/LangContext.jsx';
import { generateDemoDays } from '@utils/demoData';
import './DailySummaryTable.css';

function formatDate(iso) {
  const [year, month, day] = iso.split('-');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function DayForm({ initial, onSave, onCancel }) {
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
        <input className="form-input" placeholder={t.formNotesPlaceholderDay}
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
        {totalOrders > 0 && <span className="dft-item">{t.formAvgLabel} <strong>{formatCurrency(effectiveTotalRevenue / totalOrders)}</strong></span>}
        {hasCategories && (
          <span className="dft-item">{t.formCategoryTotal} <strong style={{ color: categoryMatch ? 'inherit' : 'var(--danger)' }}>{formatCurrency(categoryTotal)}</strong></span>
        )}
      </div>

      <div className="day-form-actions">
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>{t.cancelBtn}</button>
        <button className="btn btn-primary btn-sm" onClick={handleSave}>{t.saveDayBtn}</button>
      </div>
    </div>
  );
}

export default function DailySummaryTable({ dailySummary, days, onUpsertDay, onRemoveDay, foodCostByDay = {} }) {
  const { t } = useLang();
  const [editingDate, setEditingDate] = useState(null);
  const [addingDate, setAddingDate]   = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterType, setFilterType]   = useState('all');

  const handleLoadDemo = () => {
    const confirmed = window.confirm(t.loadDemoConfirm || 'Load 90 days of demo data? This will be added to your records.');
    if (!confirmed) return;
    const demoData = generateDemoDays();
    demoData.forEach(day => onUpsertDay(day.date, day));
    alert(t.loadDemoSuccess || 'Demo data loaded!');
  };

  const handleAddSave = (data) => {
    if (!addingDate) return;
    onUpsertDay(addingDate, data);
    setShowAddForm(false);
    setAddingDate('');
  };

  const handleEditSave = (date, data) => {
    onUpsertDay(date, data);
    setEditingDate(null);
  };

  const filtered = dailySummary.filter(d => {
    if (filterType === 'delivery') return (d.deliveryOrders || 0) > 0;
    if (filterType === 'pickup')   return (d.pickupOrders   || 0) > 0;
    return true;
  });

  return (
    <div className="daily-summary">
      <h2 className="page-title">{t.tabSummary}</h2>

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
          onClick={() => { setAddingDate(todayISO()); setShowAddForm(true); }}>
          {t.addDayBtn}
        </button>
      </div>

      {showAddForm && (
        <div className="day-card">
          <div className="day-card-header" style={{ cursor: 'default' }}>
            <div className="day-date-col">
              <span className="day-date">{t.newDayEntryLabel}</span>
            </div>
            <input type="date" className="form-input date-input"
              value={addingDate} max={todayISO()}
              onChange={e => setAddingDate(e.target.value)}
              onClick={e => e.currentTarget.showPicker?.()} />
          </div>
          <DayForm
            initial={{ deliveryRevenue: '', pickupRevenue: '', deliveryOrders: '', pickupOrders: '', categories: {}, notes: '' }}
            onSave={handleAddSave}
            onCancel={() => { setShowAddForm(false); setAddingDate(''); }}
          />
        </div>
      )}

      {!showAddForm && filtered.length === 0 && (
        <div className="ds-empty">
          <p>{t.emptyDailyPre} <strong>{t.addDayBtn}</strong> {t.emptyDailySuffix}</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary"
              onClick={() => { setAddingDate(todayISO()); setShowAddForm(true); }}>
              {t.addTodayBtn}
            </button>
            <button className="btn btn-secondary"
              onClick={handleLoadDemo}>
              {t.loadDemoBtn || 'Load Demo Data'}
            </button>
          </div>
        </div>
      )}

      {filtered.map(day => (
        <div key={day.date} className="day-card">
          <div className="day-card-header"
            onClick={() => setEditingDate(editingDate === day.date ? null : day.date)}>
            <div className="day-date-col">
              <span className="day-date">{formatDate(day.date)}</span>
              <div className="day-type-pills">
                {day.deliveryRevenue > 0 && <span className="type-pill delivery">{t.labelDelivery} {formatCurrency(day.deliveryRevenue)}</span>}
                {day.pickupRevenue   > 0 && <span className="type-pill pickup">{t.labelPickup} {formatCurrency(day.pickupRevenue)}</span>}
                {day.revenue > 0 && day.revenue !== day.deliveryRevenue && day.revenue !== day.pickupRevenue && (
                  <span className="type-pill total">{t.total || 'Total'} {formatCurrency(day.revenue)}</span>
                )}
                {day.notes && <span className="type-pill notes-pill">📝 {day.notes}</span>}
                {days[day.date]?.categories && Object.keys(days[day.date].categories).length > 0 && (
                  <span className="type-pill category-pill">💰 {Object.keys(days[day.date].categories).length} {t.categoriesBadge}</span>
                )}
                {day.source === 'imported' && (
                  <span className="source-badge imported">{t.importedBadge}</span>
                )}
                {day.source && day.source !== 'imported' && (
                  <span className="source-badge manual">{t.manualBadge}</span>
                )}
              </div>
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
                <span className="day-stat-value">{day.orderCount > 0 ? formatCurrency(day.avgOrderValue) : '—'}</span>
              </div>
              {(() => {
                const fc = foodCostByDay[day.date];
                if (!fc) return null;
                const pct = day.revenue > 0 ? (fc / day.revenue) * 100 : null;
                // Industry benchmark: 28–32 % is healthy for full-service casual.
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
              <button className="btn btn-ghost btn-sm"
                onClick={e => { e.stopPropagation(); setEditingDate(day.date); }}>{t.editBtn}</button>
              <button className="btn-remove" title="Delete day"
                onClick={e => { e.stopPropagation(); onRemoveDay(day.date); }}>×</button>
            </div>
          </div>

          {editingDate === day.date && (
            <DayForm
              initial={days[day.date]}
              onSave={(data) => handleEditSave(day.date, data)}
              onCancel={() => setEditingDate(null)}
            />
          )}

          {editingDate !== day.date && (
            <div style={{ padding: '0 1.5rem' }}>
              <PlatformBreakdown record={days[day.date]} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

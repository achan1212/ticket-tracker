import { useState } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';

// Shared delivery/pickup/total-revenue + categories + notes form used by
// both DailySummaryTable (per-day) and MonthlySummaryTable (per-month).
// `notesPlaceholder` and `saveLabel` are the only per-caller strings.
//
// Visual styles intentionally still use the `.day-form*` classes defined in
// DailySummaryTable.css; renaming would be a larger CSS churn for no gain.
export default function RevenueForm({ initial, onSave, onCancel, notesPlaceholder, saveLabel }) {
  const { t, formatCurrency } = useLang();
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
        <input className="form-input" placeholder={notesPlaceholder}
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
                <button type="button" className="btn-remove-category" aria-label={t.removeCategoryBtn} onClick={() => removeCategory(name)}>×</button>
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
        <button className="btn btn-primary btn-sm" onClick={handleSave}>{saveLabel}</button>
      </div>
    </div>
  );
}

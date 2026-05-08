import { useState } from 'react';
import { formatCurrency } from '@utils/helpers';
import './DailySummaryTable.css';

function formatDate(iso) {
  const [year, month, day] = iso.split('-');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_DAY = {
  deliveryRevenue: '', pickupRevenue: '',
  deliveryOrders: '', pickupOrders: '',
  categories: {},
  notes: '',
};

function DayForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    deliveryRevenue: initial?.deliveryRevenue || '',
    pickupRevenue:   initial?.pickupRevenue   || '',
    deliveryOrders:  initial?.deliveryOrders  || '',
    pickupOrders:    initial?.pickupOrders    || '',
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

  const totalRevenue = (parseFloat(form.deliveryRevenue) || 0) + (parseFloat(form.pickupRevenue) || 0);
  const totalOrders  = (parseInt(form.deliveryOrders)    || 0) + (parseInt(form.pickupOrders)    || 0);
  const categoryTotal = Object.values(form.categories).reduce((sum, val) => sum + val, 0);
  const hasCategories = Object.keys(form.categories).length > 0;
  const categoryMatch = hasCategories ? Math.abs(categoryTotal - totalRevenue) < 0.01 : true;

  const handleSave = () => {
    onSave({
      deliveryRevenue: parseFloat(form.deliveryRevenue) || 0,
      pickupRevenue:   parseFloat(form.pickupRevenue)   || 0,
      deliveryOrders:  parseInt(form.deliveryOrders)    || 0,
      pickupOrders:    parseInt(form.pickupOrders)      || 0,
      categories:      form.categories,
      notes:           form.notes.trim(),
    });
  };

  return (
    <div className="day-form">
      <div className="day-form-grid">
        <div className="day-form-section">
          <p className="day-form-section-label">🛵 Delivery</p>
          <div className="day-form-row">
            <div className="day-form-field">
              <label className="target-label">Revenue</label>
              <div className="target-input-wrap">
                <span className="target-prefix">$</span>
                <input className="form-input form-input-sm" type="number" min="0" step="0.01"
                  placeholder="0.00" value={form.deliveryRevenue}
                  onChange={e => set('deliveryRevenue', e.target.value)} />
              </div>
            </div>
            <div className="day-form-field">
              <label className="target-label">Orders</label>
              <input className="form-input form-input-sm" type="number" min="0" step="1"
                placeholder="0" value={form.deliveryOrders}
                onChange={e => set('deliveryOrders', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="day-form-section">
          <p className="day-form-section-label">🏪 Pickup</p>
          <div className="day-form-row">
            <div className="day-form-field">
              <label className="target-label">Revenue</label>
              <div className="target-input-wrap">
                <span className="target-prefix">$</span>
                <input className="form-input form-input-sm" type="number" min="0" step="0.01"
                  placeholder="0.00" value={form.pickupRevenue}
                  onChange={e => set('pickupRevenue', e.target.value)} />
              </div>
            </div>
            <div className="day-form-field">
              <label className="target-label">Orders</label>
              <input className="form-input form-input-sm" type="number" min="0" step="1"
                placeholder="0" value={form.pickupOrders}
                onChange={e => set('pickupOrders', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="day-form-field" style={{ marginTop: '0.75rem' }}>
        <label className="target-label">Notes (optional)</label>
        <input className="form-input" placeholder="e.g. lunch rush, holiday weekend..."
          value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      {/* CATEGORIES SECTION */}
      <div className="day-form-section" style={{ marginTop: '0.75rem' }}>
        <label className="day-form-section-label">🍕 Revenue Categories</label>
        <p className="category-help-text">Break down your revenue by food type (optional)</p>

        {/* Existing Categories */}
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

        {/* Add New Category */}
        <div className="category-input-row">
          <input
            className="form-input"
            placeholder="Category name (e.g. Pizza, Pasta, Drinks)"
            value={categoryInput.name}
            onChange={e => setCategoryInput(prev => ({ ...prev, name: e.target.value }))}
            onKeyPress={e => e.key === 'Enter' && addCategory()}
          />
          <div className="target-input-wrap" style={{ minWidth: '120px' }}>
            <span className="target-prefix">$</span>
            <input
              className="form-input form-input-sm"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={categoryInput.cost}
              onChange={e => setCategoryInput(prev => ({ ...prev, cost: e.target.value }))}
              onKeyPress={e => e.key === 'Enter' && addCategory()}
            />
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addCategory}>Add</button>
        </div>

        {/* Category validation warning */}
        {hasCategories && !categoryMatch && (
          <div className="category-warning">
            ⚠️ Categories total {formatCurrency(categoryTotal)} but revenue is {formatCurrency(totalRevenue)}
          </div>
        )}
      </div>

      <div className="day-form-totals">
        <span className="dft-item">Total Revenue: <strong>{formatCurrency(totalRevenue)}</strong></span>
        <span className="dft-item">Total Orders: <strong>{totalOrders}</strong></span>
        {totalOrders > 0 && <span className="dft-item">Avg: <strong>{formatCurrency(totalRevenue / totalOrders)}</strong></span>}
        {hasCategories && <span className="dft-item">Category Total: <strong style={{ color: categoryMatch ? 'inherit' : 'var(--danger)' }}>{formatCurrency(categoryTotal)}</strong></span>}
      </div>

      <div className="day-form-actions">
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={handleSave}>Save Day</button>
      </div>
    </div>
  );
}

export default function DailySummaryTable({ dailySummary, days, onUpsertDay, onRemoveDay }) {
  const [editingDate, setEditingDate] = useState(null);
  const [addingDate, setAddingDate] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterType, setFilterType] = useState('all');

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

  // Filter for display
  const filtered = dailySummary.filter(d => {
    if (filterType === 'delivery') return (d.deliveryOrders || 0) > 0;
    if (filterType === 'pickup')   return (d.pickupOrders   || 0) > 0;
    return true;
  });

  return (
    <div className="daily-summary">

      {/* CONTROLS */}
      <div className="ds-controls">
        <div className="ds-filter-pills">
          {[
            { key: 'all',      label: 'All Days' },
            { key: 'delivery', label: '🛵 Delivery' },
            { key: 'pickup',   label: '🏪 Pickup' },
          ].map(f => (
            <button key={f.key} className={`filter-pill ${filterType === f.key ? 'active' : ''}`}
              onClick={() => setFilterType(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        <button className="btn btn-primary btn-sm" onClick={() => { setAddingDate(todayISO()); setShowAddForm(true); }}>
          + Add Day
        </button>
      </div>

      {/* ADD NEW DAY FORM */}
      {showAddForm && (
        <div className="day-card">
          <div className="day-card-header" style={{ cursor: 'default' }}>
            <div className="day-date-col">
              <span className="day-date">New Entry</span>
            </div>
            <input type="date" className="form-input date-input"
              value={addingDate} max={todayISO()}
              onChange={e => setAddingDate(e.target.value)} />
          </div>
          <DayForm
            initial={EMPTY_DAY}
            onSave={handleAddSave}
            onCancel={() => { setShowAddForm(false); setAddingDate(''); }}
          />
        </div>
      )}

      {/* EMPTY STATE */}
      {!showAddForm && filtered.length === 0 && (
        <div className="ds-empty">
          <p>No daily records yet. Click <strong>Add Day</strong> to enter today's sales.</p>
          <button className="btn btn-primary" onClick={() => { setAddingDate(todayISO()); setShowAddForm(true); }}>
            + Add Today
          </button>
        </div>
      )}

      {/* DAILY ROWS */}
      {filtered.map(day => (
        <div key={day.date} className="day-card">
          <div className="day-card-header"
            onClick={() => editingDate !== day.date && setEditingDate(editingDate === day.date ? null : day.date)}>
            <div className="day-date-col">
              <span className="day-date">{formatDate(day.date)}</span>
              <div className="day-type-pills">
                {day.deliveryRevenue > 0 && <span className="type-pill delivery">🛵 {formatCurrency(day.deliveryRevenue)}</span>}
                {day.pickupRevenue   > 0 && <span className="type-pill pickup">🏪 {formatCurrency(day.pickupRevenue)}</span>}
                {day.notes && <span className="type-pill notes-pill">📝 {day.notes}</span>}
                {days[day.date]?.categories && Object.keys(days[day.date].categories).length > 0 && (
                  <span className="type-pill category-pill">💰 {Object.keys(days[day.date].categories).length} categories</span>
                )}
              </div>
            </div>
            <div className="day-stats">
              <div className="day-stat">
                <span className="day-stat-label">Revenue</span>
                <span className="day-stat-value">{formatCurrency(day.revenue)}</span>
              </div>
              <div className="day-stat">
                <span className="day-stat-label">Orders</span>
                <span className="day-stat-value">{day.orderCount}</span>
              </div>
              <div className="day-stat">
                <span className="day-stat-label">Avg</span>
                <span className="day-stat-value">{day.orderCount > 0 ? formatCurrency(day.avgOrderValue) : '—'}</span>
              </div>
            </div>
            <div className="day-actions">
              <button className="btn btn-ghost btn-sm"
                onClick={e => { e.stopPropagation(); setEditingDate(day.date); }}>Edit</button>
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
        </div>
      ))}
    </div>
  );
}

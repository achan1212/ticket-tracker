import { useState, useMemo } from 'react';
import { formatCurrency } from '@utils/helpers';

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

const EMPTY_FORM = {
  deliveryRevenue: '', pickupRevenue: '',
  deliveryOrders: '',  pickupOrders: '',
  notes: '',
};

function MonthForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    deliveryRevenue: initial?.deliveryRevenue || '',
    pickupRevenue:   initial?.pickupRevenue   || '',
    deliveryOrders:  initial?.deliveryOrders  || '',
    pickupOrders:    initial?.pickupOrders    || '',
    notes:           initial?.notes           || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const totalRevenue = (parseFloat(form.deliveryRevenue) || 0) + (parseFloat(form.pickupRevenue) || 0);
  const totalOrders  = (parseInt(form.deliveryOrders)    || 0) + (parseInt(form.pickupOrders)    || 0);

  const handleSave = () => {
    onSave({
      deliveryRevenue: parseFloat(form.deliveryRevenue) || 0,
      pickupRevenue:   parseFloat(form.pickupRevenue)   || 0,
      deliveryOrders:  parseInt(form.deliveryOrders)    || 0,
      pickupOrders:    parseInt(form.pickupOrders)      || 0,
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
        <input className="form-input" placeholder="e.g. holiday month, renovation..."
          value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      <div className="day-form-totals">
        <span className="dft-item">Total Revenue: <strong>{formatCurrency(totalRevenue)}</strong></span>
        <span className="dft-item">Total Orders: <strong>{totalOrders}</strong></span>
        {totalOrders > 0 && (
          <span className="dft-item">Avg: <strong>{formatCurrency(totalRevenue / totalOrders)}</strong></span>
        )}
      </div>

      <div className="day-form-actions">
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={handleSave}>Save Month</button>
      </div>
    </div>
  );
}

export default function MonthlySummaryTable({ dailySummary, months, onUpsertMonth, onRemoveMonth }) {
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [editingMonth, setEditingMonth]   = useState(null);
  const [showAddForm, setShowAddForm]     = useState(false);
  const [addingMonth, setAddingMonth]     = useState(currentMonthISO());

  // Aggregate daily records by month
  const dailyByMonth = useMemo(() => {
    const byMonth = {};
    dailySummary.forEach(d => {
      const key = d.date.slice(0, 7);
      if (!byMonth[key]) {
        byMonth[key] = {
          deliveryRevenue: 0, pickupRevenue: 0,
          deliveryOrders: 0,  pickupOrders: 0,
          days: [],
        };
      }
      byMonth[key].deliveryRevenue += d.deliveryRevenue || 0;
      byMonth[key].pickupRevenue   += d.pickupRevenue   || 0;
      byMonth[key].deliveryOrders  += d.deliveryOrders  || 0;
      byMonth[key].pickupOrders    += d.pickupOrders    || 0;
      byMonth[key].days.push(d);
    });
    return byMonth;
  }, [dailySummary]);

  // Merge all month keys from both sources
  const allMonths = useMemo(() => {
    const keys = new Set([...Object.keys(dailyByMonth), ...Object.keys(months)]);
    return Array.from(keys).sort((a, b) => b.localeCompare(a)).map(key => {
      const daily  = dailyByMonth[key] || null;
      const manual = months[key]       || null;

      const deliveryRevenue = (daily?.deliveryRevenue || 0) + (manual?.deliveryRevenue || 0);
      const pickupRevenue   = (daily?.pickupRevenue   || 0) + (manual?.pickupRevenue   || 0);
      const deliveryOrders  = (daily?.deliveryOrders  || 0) + (manual?.deliveryOrders  || 0);
      const pickupOrders    = (daily?.pickupOrders    || 0) + (manual?.pickupOrders    || 0);
      const revenue    = deliveryRevenue + pickupRevenue;
      const orderCount = deliveryOrders  + pickupOrders;

      return {
        key,
        daily,
        manual,
        revenue,
        orderCount,
        deliveryRevenue,
        pickupRevenue,
        avgOrderValue: orderCount > 0 ? revenue / orderCount : 0,
      };
    });
  }, [dailyByMonth, months]);

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

      {/* CONTROLS */}
      <div className="ds-controls">
        <div /> {/* spacer */}
        <button className="btn btn-primary btn-sm"
          onClick={() => { setAddingMonth(currentMonthISO()); setShowAddForm(true); }}>
          + Add Month
        </button>
      </div>

      {/* ADD FORM */}
      {showAddForm && (
        <div className="day-card">
          <div className="day-card-header" style={{ cursor: 'default' }}>
            <div className="day-date-col">
              <span className="day-date">New Monthly Entry</span>
            </div>
            <input type="month" className="form-input date-input"
              value={addingMonth} max={currentMonthISO()}
              onChange={e => setAddingMonth(e.target.value)} />
          </div>
          <MonthForm
            initial={EMPTY_FORM}
            onSave={handleAddSave}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {/* EMPTY STATE */}
      {!showAddForm && allMonths.length === 0 && (
        <div className="ds-empty">
          <p>No monthly records yet. Click <strong>Add Month</strong> to enter monthly totals, or add daily records in the Daily Summary tab.</p>
          <button className="btn btn-primary"
            onClick={() => { setAddingMonth(currentMonthISO()); setShowAddForm(true); }}>
            + Add This Month
          </button>
        </div>
      )}

      {/* MONTH CARDS */}
      {allMonths.map(month => (
        <div key={month.key} className="day-card">
          <div className="day-card-header"
            onClick={() => setExpandedMonth(expandedMonth === month.key ? null : month.key)}>
            <div className="day-date-col">
              <span className="day-date">{formatMonthYear(month.key)}</span>
              <div className="day-type-pills">
                {month.deliveryRevenue > 0 && (
                  <span className="type-pill delivery">🛵 {formatCurrency(month.deliveryRevenue)}</span>
                )}
                {month.pickupRevenue > 0 && (
                  <span className="type-pill pickup">🏪 {formatCurrency(month.pickupRevenue)}</span>
                )}
                {month.daily && (
                  <span className="month-days-count">{month.daily.days.length} day{month.daily.days.length !== 1 ? 's' : ''}</span>
                )}
                {month.manual && (
                  <span className="month-source-badge manual">manual</span>
                )}
              </div>
            </div>

            <div className="day-stats">
              <div className="day-stat">
                <span className="day-stat-label">Revenue</span>
                <span className="day-stat-value">{formatCurrency(month.revenue)}</span>
              </div>
              <div className="day-stat">
                <span className="day-stat-label">Orders</span>
                <span className="day-stat-value">{month.orderCount}</span>
              </div>
              <div className="day-stat">
                <span className="day-stat-label">Avg</span>
                <span className="day-stat-value">
                  {month.orderCount > 0 ? formatCurrency(month.avgOrderValue) : '—'}
                </span>
              </div>
            </div>

            <div className="day-actions">
              {month.manual && editingMonth !== month.key && (
                <button className="btn btn-ghost btn-sm"
                  onClick={e => { e.stopPropagation(); setEditingMonth(month.key); }}>
                  Edit
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

          {/* EDIT FORM for manual entry */}
          {editingMonth === month.key && (
            <MonthForm
              initial={months[month.key]}
              onSave={data => handleEditSave(month.key, data)}
              onCancel={() => setEditingMonth(null)}
            />
          )}

          {/* EXPANDED: daily breakdown */}
          {expandedMonth === month.key && editingMonth !== month.key && (
            <div className="month-day-list">
              {/* Manual entry summary row */}
              {month.manual && (
                <div className="month-day-row month-manual-row">
                  <div className="month-day-date">
                    <span className="month-source-badge manual">manual entry</span>
                  </div>
                  <div className="day-type-pills">
                    {(month.manual.deliveryRevenue || 0) > 0 && (
                      <span className="type-pill delivery">🛵 {formatCurrency(month.manual.deliveryRevenue)}</span>
                    )}
                    {(month.manual.pickupRevenue || 0) > 0 && (
                      <span className="type-pill pickup">🏪 {formatCurrency(month.manual.pickupRevenue)}</span>
                    )}
                    {month.manual.notes && (
                      <span className="notes-pill">📝 {month.manual.notes}</span>
                    )}
                  </div>
                  <div className="day-stats">
                    <div className="day-stat">
                      <span className="day-stat-label">Revenue</span>
                      <span className="day-stat-value">
                        {formatCurrency((month.manual.deliveryRevenue || 0) + (month.manual.pickupRevenue || 0))}
                      </span>
                    </div>
                    <div className="day-stat">
                      <span className="day-stat-label">Orders</span>
                      <span className="day-stat-value">
                        {(month.manual.deliveryOrders || 0) + (month.manual.pickupOrders || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Daily records */}
              {month.daily && [...month.daily.days]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(day => (
                  <div key={day.date} className="month-day-row">
                    <div className="month-day-date">{formatDate(day.date)}</div>
                    <div className="day-type-pills">
                      {(day.deliveryRevenue || 0) > 0 && (
                        <span className="type-pill delivery">🛵 {formatCurrency(day.deliveryRevenue)}</span>
                      )}
                      {(day.pickupRevenue || 0) > 0 && (
                        <span className="type-pill pickup">🏪 {formatCurrency(day.pickupRevenue)}</span>
                      )}
                      {day.notes && <span className="notes-pill">📝 {day.notes}</span>}
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

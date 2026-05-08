import { useState } from 'react';
import { formatCurrency } from '@utils/helpers';

// Where the customer placed the order — always delivered by you directly
const ORDER_SOURCES = [
  { key: 'direct',   label: 'Direct / Walk-in',  color: '#e8ff47' },
  { key: 'phone',    label: 'Phone',              color: '#a78bfa' },
  { key: 'website',  label: 'Your Website',       color: '#63b3ed' },
  { key: 'doordash', label: 'DoorDash',           color: '#FF3008' },
  { key: 'ubereats', label: 'Uber Eats',          color: '#06C167' },
  { key: 'grubhub',  label: 'Grubhub',            color: '#F63440' },
];

const emptyItem = { name: '', cost: '', quantity: '1' };

export default function AddOrderModal({ defaultDate, onSave, onClose, onScan }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(defaultDate || today);
  const [type, setType] = useState('pickup');
  const [source, setSource] = useState('direct');
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});

  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const addItem = () => setItems(prev => [...prev, { ...emptyItem }]);

  const removeItem = (idx) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const orderTotal = items.reduce((s, item) => {
    return s + (parseFloat(item.cost) || 0) * (parseInt(item.quantity) || 1);
  }, 0);

  const validate = () => {
    const e = {};
    if (!date) e.date = 'Date required';
    items.forEach((item, i) => {
      if (!item.name.trim()) e[`name_${i}`] = 'Required';
      if (isNaN(parseFloat(item.cost)) || parseFloat(item.cost) < 0) e[`cost_${i}`] = 'Invalid';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      date,
      type,               // delivery | pickup — fulfillment method
      platform: source,   // where the order came from
      items: items.map(item => ({
        name: item.name.trim(),
        cost: parseFloat(item.cost),
        quantity: parseInt(item.quantity) || 1,
      })),
      notes,
    });
  };

  const selectedSource = ORDER_SOURCES.find(s => s.key === source);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Add Order</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">

          {/* DATE */}
          <div className="modal-field">
            <label className="target-label">Order Date</label>
            <input type="date" className={`form-input ${errors.date ? 'input-error' : ''}`}
              value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {/* FULFILLMENT TYPE */}
          <div className="modal-field">
            <label className="target-label">Fulfillment</label>
            <p className="target-help">How the order is fulfilled — all delivery is direct (your drivers)</p>
            <div className="type-toggle">
              <button className={`type-toggle-btn ${type === 'pickup' ? 'active pickup' : ''}`}
                onClick={() => setType('pickup')}>
                🏪 Pickup
              </button>
              <button className={`type-toggle-btn ${type === 'delivery' ? 'active delivery' : ''}`}
                onClick={() => setType('delivery')}>
                🛵 Delivery (Direct)
              </button>
            </div>
          </div>

          {/* ORDER SOURCE */}
          <div className="modal-field">
            <label className="target-label">Order Source</label>
            <p className="target-help">Where the customer placed this order</p>
            <div className="source-select">
              {ORDER_SOURCES.map(s => (
                <button key={s.key}
                  className={`platform-select-btn ${source === s.key ? 'active' : ''}`}
                  style={{ '--pcolor': s.color }}
                  onClick={() => setSource(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
            {selectedSource && (
              <div className="source-summary">
                <span className="source-dot" style={{ background: selectedSource.color }} />
                <span className="source-label" style={{ color: selectedSource.color }}>
                  {selectedSource.label}
                </span>
                <span className="source-type-note">
                  · {type === 'delivery' ? 'Direct delivery' : 'Customer pickup'}
                  {['doordash','ubereats','grubhub'].includes(source)
                    ? ' — 3rd party commission applies'
                    : ' — no platform commission'}
                </span>
              </div>
            )}
          </div>

          {/* ITEMS */}
          <div className="modal-field">
            <div className="modal-field-header">
              <label className="target-label">Items</label>
              <button className="btn-scan-link" onClick={onScan}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Scan ticket instead
              </button>
            </div>
            <div className="modal-items">
              {items.map((item, idx) => (
                <div key={idx} className="modal-item-row">
                  <input
                    className={`form-input ${errors[`name_${idx}`] ? 'input-error' : ''}`}
                    placeholder="Item name"
                    value={item.name}
                    onChange={(e) => updateItem(idx, 'name', e.target.value)}
                  />
                  <div className="target-input-wrap">
                    <span className="target-prefix">$</span>
                    <input
                      className={`form-input form-input-sm ${errors[`cost_${idx}`] ? 'input-error' : ''}`}
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={item.cost}
                      onChange={(e) => updateItem(idx, 'cost', e.target.value)}
                    />
                  </div>
                  <input
                    className="form-input form-input-sm"
                    type="number" min="1" placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                  />
                  <button className="btn-remove-item" onClick={() => removeItem(idx)} disabled={items.length === 1}>×</button>
                </div>
              ))}
              <button className="btn-add-row" onClick={addItem}>+ Add Item</button>
            </div>
          </div>

          {/* NOTES */}
          <div className="modal-field">
            <label className="target-label">Notes (optional)</label>
            <input className="form-input" placeholder="e.g. lunch rush, special event..."
              value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* ORDER TOTAL */}
          <div className="modal-total">
            <span>Order Total</span>
            <span className="modal-total-value">{formatCurrency(orderTotal)}</span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Order</button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { exportToCSV, calcTotal, formatCurrency } from '@utils/helpers';
import { useLang } from '../../i18n/LangContext.jsx';
import CostAnalysis from '@components/CostAnalysis/CostAnalysis';
import './ResultsTable.css';

const emptyForm = { name: '', cost: '', quantity: '1' };

export default function ResultsTable({ scannedItems, manualItems, onAddItem, onUpdateManualItem, onReset, preview, rawText }) {
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState('summary');
  const [showRaw, setShowRaw] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [removedScanned, setRemovedScanned] = useState([]);
  const [itemCosts, setItemCosts] = useState({});
  const [editingUid, setEditingUid] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editError, setEditError] = useState('');
  // Per-row overrides on scanned items (edits + isCategory). Stored locally so
  // we don't mutate the upstream scan results and edits survive removals.
  const [scannedEdits, setScannedEdits] = useState({});
  const [displayOrder, setDisplayOrder] = useState([]);
  const [draggingUid, setDraggingUid] = useState(null);
  const [dragOverUid, setDragOverUid] = useState(null);

  // Build the canonical uid → item map. Scanned and manual items both flow
  // through here so every downstream operation (render, edit, remove, drag,
  // toggle-category) works off the same shape.
  const itemsByUid = useMemo(() => {
    const map = new Map();
    scannedItems.forEach((item, i) => {
      if (removedScanned.includes(i)) return;
      if (!item._uid) return;
      const effective = scannedEdits[i] ? { ...item, ...scannedEdits[i] } : item;
      map.set(item._uid, { item: effective, type: 'scanned', originalIndex: i });
    });
    manualItems.forEach((item, i) => {
      if (!item._uid) return;
      map.set(item._uid, { item, type: 'manual', originalIndex: i });
    });
    return map;
  }, [scannedItems, manualItems, scannedEdits, removedScanned]);

  // Keep displayOrder in sync with itemsByUid: preserve user-set order for
  // existing uids, append new uids at the end, drop removed ones.
  useEffect(() => {
    setDisplayOrder(prev => {
      const existing = prev.filter(uid => itemsByUid.has(uid));
      const fresh = [];
      itemsByUid.forEach((_, uid) => {
        if (!prev.includes(uid)) fresh.push(uid);
      });
      if (existing.length === prev.length && fresh.length === 0) return prev;
      return [...existing, ...fresh];
    });
  }, [itemsByUid]);

  const orderedItems = displayOrder
    .map(uid => {
      const info = itemsByUid.get(uid);
      return info ? { uid, ...info } : null;
    })
    .filter(Boolean);
  const allItems = orderedItems.map(entry => entry.item);
  const billableItems = allItems.filter(i => !i.isCategory);
  const total = calcTotal(billableItems);

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFormError('');
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return setFormError(t.errorName);
    const cost = parseFloat(form.cost);
    const quantity = parseInt(form.quantity, 10);
    if (isNaN(cost) || cost < 0) return setFormError(t.errorCost);
    if (isNaN(quantity) || quantity < 1) return setFormError(t.errorQty);
    onAddItem({ name: form.name.trim(), cost, quantity, addedAt: new Date().toISOString(), source: 'manual' });
    setForm(emptyForm);
    setFormError('');
    setShowForm(false);
  };

  const startEdit = (uid) => {
    const info = itemsByUid.get(uid);
    if (!info) return;
    setEditingUid(uid);
    setEditForm({ name: info.item.name, cost: String(info.item.cost), quantity: String(info.item.quantity) });
    setEditError('');
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingUid(null);
    setEditError('');
  };

  const saveEdit = () => {
    const info = itemsByUid.get(editingUid);
    if (!info) return cancelEdit();
    const name = editForm.name.trim();
    const cost = parseFloat(editForm.cost);
    const quantity = parseInt(editForm.quantity, 10);
    if (!name) return setEditError(t.errorName);
    if (!Number.isFinite(cost) || cost < 0) return setEditError(t.errorCost);
    if (!Number.isInteger(quantity) || quantity < 1) return setEditError(t.errorQty);

    if (info.type === 'scanned') {
      setScannedEdits(prev => ({ ...prev, [info.originalIndex]: { ...prev[info.originalIndex], name, cost, quantity } }));
    } else {
      onUpdateManualItem?.(info.originalIndex, { ...manualItems[info.originalIndex], name, cost, quantity });
    }
    setEditingUid(null);
    setEditError('');
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') saveEdit();
    else if (e.key === 'Escape') cancelEdit();
  };

  const removeItem = (uid) => {
    const info = itemsByUid.get(uid);
    if (!info) return;
    if (editingUid === uid) cancelEdit();
    if (info.type === 'scanned') {
      setRemovedScanned(prev => [...prev, info.originalIndex]);
    } else {
      onAddItem({ __removeManualIndex: info.originalIndex });
    }
  };

  const toggleCategory = (uid) => {
    const info = itemsByUid.get(uid);
    if (!info) return;
    const next = !info.item.isCategory;
    if (info.type === 'scanned') {
      setScannedEdits(prev => ({ ...prev, [info.originalIndex]: { ...prev[info.originalIndex], isCategory: next } }));
    } else {
      onUpdateManualItem?.(info.originalIndex, { ...manualItems[info.originalIndex], isCategory: next });
    }
  };

  // Drag-and-drop reordering. Native HTML5 D&D — no extra dep. Whole row is
  // the drag handle (cursor: grab), inputs inside an edit row keep their own
  // pointer behavior because the row sets draggable=false while editing.
  const handleDragStart = (e, uid) => {
    setDraggingUid(uid);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', uid); } catch {}
  };

  const handleDragOver = (e, uid) => {
    if (!draggingUid || draggingUid === uid) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverUid !== uid) setDragOverUid(uid);
  };

  const handleDragLeave = (e, uid) => {
    if (dragOverUid === uid) setDragOverUid(null);
  };

  const handleDrop = (e, targetUid) => {
    e.preventDefault();
    const sourceUid = draggingUid;
    setDraggingUid(null);
    setDragOverUid(null);
    if (!sourceUid || sourceUid === targetUid) return;
    setDisplayOrder(prev => {
      const next = [...prev];
      const from = next.indexOf(sourceUid);
      const to = next.indexOf(targetUid);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, sourceUid);
      return next;
    });
  };

  const handleDragEnd = () => {
    setDraggingUid(null);
    setDragOverUid(null);
  };

  const editLiveSubtotal = formatCurrency(
    (parseFloat(editForm.cost) || 0) * (parseInt(editForm.quantity, 10) || 0)
  );

  const editIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
    </svg>
  );
  const saveIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
  const dragIcon = (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
      <circle cx="2.5" cy="3" r="1.25"/><circle cx="7.5" cy="3" r="1.25"/>
      <circle cx="2.5" cy="7" r="1.25"/><circle cx="7.5" cy="7" r="1.25"/>
      <circle cx="2.5" cy="11" r="1.25"/><circle cx="7.5" cy="11" r="1.25"/>
    </svg>
  );

  const tabs = [
    { key: 'summary',  label: t.tabSummary,  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg> },
    { key: 'analysis', label: t.tabAnalysis, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  ];

  const renderRow = (entry, displayIndex) => {
    const { uid, item, type } = entry;
    const isEditing = editingUid === uid;
    const isCategory = !!item.isCategory;
    const isManual = type === 'manual';
    const sourceBadgeLabel = isManual ? t.badgeManual : t.badgeScanned;
    const sourceBadgeClass = isManual ? 'item-source-badge manual' : 'item-source-badge';
    const rowClass = [
      isManual ? 'manual-row' : '',
      isEditing ? 'editing-row' : '',
      isCategory ? 'category-row' : '',
      draggingUid === uid ? 'dragging-row' : '',
      dragOverUid === uid ? 'drag-over' : '',
    ].filter(Boolean).join(' ');

    return (
      <tr
        key={uid}
        className={rowClass}
        style={{ animationDelay: `${displayIndex * 0.04}s` }}
        draggable={!isEditing}
        onDragStart={(e) => handleDragStart(e, uid)}
        onDragOver={(e) => handleDragOver(e, uid)}
        onDragLeave={(e) => handleDragLeave(e, uid)}
        onDrop={(e) => handleDrop(e, uid)}
        onDragEnd={handleDragEnd}
      >
        <td className="item-name">
          <div className="name-cell">
            <span className="drag-handle" title={t.dragHandleTitle || 'Drag to reorder'} aria-hidden="true">{dragIcon}</span>
            <label className="cat-toggle" title={t.catToggleTitle || 'Mark as category total (excluded from sum)'}>
              <input
                type="checkbox"
                checked={isCategory}
                onChange={() => toggleCategory(uid)}
                aria-label={t.catToggleTitle || 'Mark as category total'}
              />
            </label>
            {isEditing ? (
              <input
                className="form-input form-input-inline"
                name="name"
                value={editForm.name}
                onChange={handleEditChange}
                onKeyDown={handleEditKeyDown}
                autoFocus
              />
            ) : (
              <>
                <span className="name-text">{item.name}</span>
                {isCategory
                  ? <span className="item-source-badge cat-badge">{t.categoryBadge || 'CATEGORY'}</span>
                  : <span className={sourceBadgeClass}>{sourceBadgeLabel}</span>}
              </>
            )}
          </div>
        </td>
        <td className="item-cost">
          {isEditing ? (
            <input
              className="form-input form-input-inline form-input-num"
              name="cost"
              type="number"
              min="0"
              step="0.01"
              value={editForm.cost}
              onChange={handleEditChange}
              onKeyDown={handleEditKeyDown}
            />
          ) : formatCurrency(item.cost)}
        </td>
        <td className="item-qty">
          {isEditing ? (
            <input
              className="form-input form-input-inline form-input-num"
              name="quantity"
              type="number"
              min="1"
              value={editForm.quantity}
              onChange={handleEditChange}
              onKeyDown={handleEditKeyDown}
            />
          ) : (
            <span className="qty-badge">{item.quantity}×</span>
          )}
        </td>
        <td className={`item-subtotal ${isCategory ? 'subtotal-excluded' : ''}`}>
          {isEditing ? editLiveSubtotal : formatCurrency(item.cost * item.quantity)}
        </td>
        <td className="item-actions">
          {isEditing ? (
            <>
              <button className="btn-save" title={t.saveBtn || 'Save'} onClick={saveEdit}>{saveIcon}</button>
              <button className="btn-remove" title={t.cancelBtn || 'Cancel'} onClick={cancelEdit}>×</button>
            </>
          ) : (
            <>
              <button className="btn-edit" title={t.editBtn || 'Edit'} onClick={() => startEdit(uid)}>{editIcon}</button>
              <button className="btn-remove" title={t.removeBtn || 'Remove'} onClick={() => removeItem(uid)}>×</button>
            </>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="results-wrap">
      <div className="results-header">
        <div className="results-meta">
          <h2>{t.headerTitle}</h2>
          <span className="item-count">{allItems.length} {allItems.length !== 1 ? t.itemsPlural : t.items}</span>
        </div>
        <div className="results-actions">
          {rawText && activeTab === 'summary' && (
            <button className="btn btn-ghost" onClick={() => setShowRaw(!showRaw)}>
              {showRaw ? t.hideRawOCR : t.viewRawOCR}
            </button>
          )}
          {activeTab === 'summary' && (
            <button className="btn btn-secondary" onClick={() => exportToCSV(allItems)}>{t.exportCSV}</button>
          )}
          <button className="btn btn-primary" onClick={onReset}>{t.startOver}</button>
        </div>
      </div>

      <div className="tab-bar">
        {tabs.map(tab => (
          <button key={tab.key} className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <>
          {showRaw && rawText && (
            <div className="raw-text"><p className="raw-label">{t.rawOCRLabel}</p><pre>{rawText}</pre></div>
          )}
          <div className="results-body">
            {preview && (
              <div className="preview-panel">
                <p className="preview-label">{t.badgeScanned}</p>
                <img src={preview} alt="Scanned ticket" className="preview-full" />
              </div>
            )}
            <div className="table-panel">
              <table className="order-table">
                <thead>
                  <tr><th>{t.colItem}</th><th>{t.colUnitCost}</th><th>{t.colQty}</th><th>{t.colSubtotal}</th><th></th></tr>
                </thead>
                <tbody>
                  {orderedItems.map((entry, i) => renderRow(entry, i))}
                  {editError && editingUid && (
                    <tr className="edit-error-row"><td colSpan="5">{editError}</td></tr>
                  )}
                  {allItems.length === 0 && (
                    <tr><td colSpan="5" className="empty-row">{t.noItems}</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="total-row"><td colSpan="4">{t.total}</td><td>{formatCurrency(total)}</td></tr>
                </tfoot>
              </table>

              <div className="add-item-section">
                {!showForm ? (
                  <button className="btn-add-item" onClick={() => setShowForm(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    {t.addItemBtn}
                  </button>
                ) : (
                  <div className="add-item-form">
                    <p className="form-title">{t.addItemTitle}</p>
                    <div className="form-fields">
                      <input className="form-input" name="name" placeholder={t.itemNamePlaceholder} value={form.name} onChange={handleFormChange} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
                      <input className="form-input form-input-sm" name="cost" placeholder={t.costPlaceholder} value={form.cost} onChange={handleFormChange} type="number" min="0" step="0.01" onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
                      <input className="form-input form-input-sm" name="quantity" placeholder={t.qtyPlaceholder} value={form.quantity} onChange={handleFormChange} type="number" min="1" onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
                    </div>
                    {formError && <p className="form-error">{formError}</p>}
                    <div className="form-actions">
                      <button className="btn btn-ghost" onClick={() => { setShowForm(false); setForm(emptyForm); setFormError(''); }}>{t.cancelBtn}</button>
                      <button className="btn btn-primary" onClick={handleSubmit}>{t.addBtn}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'analysis' && (
        <CostAnalysis items={billableItems} itemCosts={itemCosts} onItemCostsChange={setItemCosts} />
      )}
    </div>
  );
}

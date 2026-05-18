import { useEffect, useMemo, useState } from 'react';
import { exportToCSV, calcTotal, formatCurrency } from '@utils/helpers';
import { useLang } from '../../i18n/LangContext.jsx';
import { useLocalStore } from '@hooks/useLocalStore';
import CostAnalysis from '@components/CostAnalysis/CostAnalysis';
import './ResultsTable.css';

const emptyForm = { name: '', cost: '', quantity: '1' };

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ResultsTable({
  scannedItems, manualItems,
  onAddItem, onUpdateManualItem,
  onReset, preview, rawText,
  detectedDate,
  onUpsertDay, onUpsertMonth,
  days = {}, months = {},
}) {
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState('summary');
  const [showRaw, setShowRaw] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  // Persisted across reloads: UIDs of removed scanned rows, per-row edits,
  // and the current display order. Editing state stays ephemeral.
  const [removedScanned, setRemovedScanned] = useLocalStore('scanner-removed', { version: 1, initial: [] });
  const [itemCosts, setItemCosts] = useState({});
  const [editingUid, setEditingUid] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editError, setEditError] = useState('');

  // Export-to-Summary state. Pre-fill the date with whatever was detected by
  // the scanner; the user can override before committing.
  const [showExport, setShowExport] = useState(false);
  const [exportTarget, setExportTarget] = useState('daily'); // 'daily' | 'monthly'
  const [exportDate, setExportDate] = useState(detectedDate || todayISO());
  // Channel is optional. 'none' = don't bucket revenue into delivery/pickup;
  // only the categories are persisted. The day record's deliveryRevenue and
  // pickupRevenue fields keep their default 0, which downstream pipelines
  // (revenue rollups, food-cost %, platform analysis) tolerate as missing.
  const [exportChannel, setExportChannel] = useState('none'); // 'none' | 'pickup' | 'delivery'
  const [exportFeedback, setExportFeedback] = useState(null);

  // When OCR finishes and a date is detected, refresh the form default.
  useEffect(() => {
    if (detectedDate) setExportDate(detectedDate);
  }, [detectedDate]);
  // Per-row overrides on scanned items (edits + isCategory) and the display
  // order both persist so a scan-and-review session survives reloads.
  const [scannedEdits, setScannedEdits] = useLocalStore('scanner-edits', { version: 1, initial: {} });
  const [displayOrder, setDisplayOrder] = useLocalStore('scanner-order', { version: 1, initial: [] });
  const [draggingUid, setDraggingUid] = useState(null);
  const [dragOverUid, setDragOverUid] = useState(null);

  // Ephemeral undo stack — captures snapshots of scannedEdits + removedScanned
  // + displayOrder before each mutating action. Capped at 30 entries so we
  // don't grow unboundedly. Intentionally NOT persisted: undo history is per
  // session, not part of the durable data.
  const [undoStack, setUndoStack] = useState([]);
  const UNDO_LIMIT = 30;
  const pushUndo = () => {
    setUndoStack(prev => {
      const snap = {
        scannedEdits: { ...scannedEdits },
        removedScanned: [...removedScanned],
        displayOrder: [...displayOrder],
      };
      const next = [...prev, snap];
      return next.length > UNDO_LIMIT ? next.slice(-UNDO_LIMIT) : next;
    });
  };
  const undo = () => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setScannedEdits(last.scannedEdits);
      setRemovedScanned(last.removedScanned);
      setDisplayOrder(last.displayOrder);
      return prev.slice(0, -1);
    });
  };

  // Cmd/Ctrl + Z anywhere on the page triggers undo while a snapshot is on
  // the stack. Skipped when focus is inside an editable field so the native
  // text-undo still works.
  useEffect(() => {
    const handler = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'z' || e.shiftKey) return;
      const target = e.target;
      const isField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isField) return;
      if (undoStack.length === 0) return;
      e.preventDefault();
      undo();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoStack]);

  // Build the canonical uid → item map. Scanned and manual items both flow
  // through here so every downstream operation (render, edit, remove, drag,
  // toggle-category) works off the same shape.
  const itemsByUid = useMemo(() => {
    const map = new Map();
    scannedItems.forEach((item, i) => {
      if (!item._uid) return;
      if (removedScanned.includes(item._uid)) return;
      const edit = scannedEdits[item._uid];
      const effective = edit ? { ...item, ...edit } : item;
      map.set(item._uid, { item: effective, type: 'scanned', originalIndex: i, uid: item._uid });
    });
    manualItems.forEach((item, i) => {
      if (!item._uid) return;
      map.set(item._uid, { item, type: 'manual', originalIndex: i, uid: item._uid });
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

  // Persisted edits/removed-uids survive across reloads, but when the user
  // starts a fresh scan (or clicks Start Over), the old keys become orphans
  // tied to UIDs that no longer exist. Prune them — or clear entirely when
  // the scan session is fully empty — so localStorage doesn't accumulate.
  useEffect(() => {
    if (scannedItems.length === 0 && manualItems.length === 0) {
      if (Object.keys(scannedEdits).length > 0) setScannedEdits({});
      if (removedScanned.length > 0) setRemovedScanned([]);
      return;
    }
    const currentUids = new Set([
      ...scannedItems.map(i => i._uid).filter(Boolean),
      ...manualItems.map(i => i._uid).filter(Boolean),
    ]);
    setScannedEdits(prev => {
      const next = {};
      let changed = false;
      for (const [uid, edit] of Object.entries(prev)) {
        if (currentUids.has(uid)) next[uid] = edit; else changed = true;
      }
      return changed ? next : prev;
    });
    setRemovedScanned(prev => {
      const filtered = prev.filter(uid => currentUids.has(uid));
      return filtered.length === prev.length ? prev : filtered;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannedItems, manualItems]);

  const orderedItems = displayOrder
    .map(uid => {
      const info = itemsByUid.get(uid);
      return info ? { uid, ...info } : null;
    })
    .filter(Boolean);
  const allItems = orderedItems.map(entry => entry.item);
  // isCategory: true now means "include this row" (a checked checkbox). The
  // included rows contribute to the displayed total AND get pushed as the
  // categories breakdown on export. Unchecked rows are excluded entirely.
  const includedItems = allItems.filter(i => i.isCategory);
  const excludedItems = allItems.filter(i => !i.isCategory);
  const total = calcTotal(includedItems);

  // Preview the day/month aggregate that will be pushed when the user
  // confirms Export to Summary. Mirrors the math we'll actually persist.
  // Prefer item.total when present — the parser stores the exact report
  // amount, so categories don't lose cents to unit-cost rounding.
  const subtotalOf = (item) =>
    Number.isFinite(item.total) ? item.total : item.cost * item.quantity;
  const exportPreview = useMemo(() => {
    // Included rows feed both the revenue total and the categories breakdown.
    // Each included row becomes one entry in the day/month `categories` map
    // and contributes its subtotal to the period's revenue.
    const cats = {};
    for (const item of includedItems) {
      const key = item.name.trim();
      if (!key) continue;
      cats[key] = Math.round(((cats[key] || 0) + subtotalOf(item)) * 100) / 100;
    }
    const revenue    = includedItems.reduce((s, i) => s + subtotalOf(i), 0);
    const orderCount = includedItems.reduce((s, i) => s + i.quantity, 0);

    return {
      revenue: Math.round(revenue * 100) / 100,
      orderCount,
      categories: cats,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includedItems]);

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

    // Recompute `total` from the user-entered cost/quantity so downstream
    // category exports use their edited value rather than the parsed total.
    const total = Math.round(cost * quantity * 100) / 100;
    if (info.type === 'scanned') {
      pushUndo();
      setScannedEdits(prev => ({ ...prev, [info.uid]: { ...prev[info.uid], name, cost, quantity, total } }));
    } else {
      onUpdateManualItem?.(info.originalIndex, { ...manualItems[info.originalIndex], name, cost, quantity, total });
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
      pushUndo();
      setRemovedScanned(prev => prev.includes(uid) ? prev : [...prev, uid]);
    } else {
      onAddItem({ __removeManualIndex: info.originalIndex });
    }
  };

  const toggleCategory = (uid) => {
    const info = itemsByUid.get(uid);
    if (!info) return;
    const next = !info.item.isCategory;
    if (info.type === 'scanned') {
      pushUndo();
      setScannedEdits(prev => ({ ...prev, [info.uid]: { ...prev[info.uid], isCategory: next } }));
    } else {
      onUpdateManualItem?.(info.originalIndex, { ...manualItems[info.originalIndex], isCategory: next });
    }
  };

  // Bulk-set every row's isCategory flag in one shot. Used by the Select All
  // / Clear All buttons in the export panel.
  const setAllCategories = (value) => {
    pushUndo();
    setScannedEdits(prev => {
      const next = { ...prev };
      scannedItems.forEach((item) => {
        if (!item._uid) return;
        next[item._uid] = { ...(next[item._uid] || {}), isCategory: value };
      });
      return next;
    });
    manualItems.forEach((item, i) => {
      if (item.isCategory !== value) {
        onUpdateManualItem?.(i, { ...item, isCategory: value });
      }
    });
  };

  const allCategoryState = (() => {
    if (allItems.length === 0) return 'none';
    const checked = allItems.filter(i => i.isCategory).length;
    if (checked === 0) return 'none';
    if (checked === allItems.length) return 'all';
    return 'some';
  })();

  // Push the scanned/reviewed data into the daily or monthly summary store.
  // Channel revenue/orders are written for the chosen channel; categories
  // are merged into any existing categories so user-entered ones survive.
  // Other channels and unrelated fields on the existing day/month are
  // preserved by the upsert callbacks (which already merge by convention).
  const handleExportToSummary = () => {
    setExportFeedback(null);
    if (allItems.length === 0) {
      setExportFeedback({ type: 'error', msg: t.exportNoItemsError || 'Nothing to export yet.' });
      return;
    }
    if (exportTarget === 'daily' && !onUpsertDay) return;
    if (exportTarget === 'monthly' && !onUpsertMonth) return;

    const key = exportTarget === 'daily' ? exportDate : exportDate.slice(0, 7);
    if (!key || !/^\d{4}-\d{2}(-\d{2})?$/.test(key)) {
      setExportFeedback({ type: 'error', msg: t.exportInvalidDateError || 'Pick a valid date.' });
      return;
    }

    const existing = exportTarget === 'daily' ? (days[key] || {}) : (months[key] || {});
    const mergedCategories = { ...(existing.categories || {}), ...exportPreview.categories };

    // Channel is optional. When 'none', skip the channel-specific fields so
    // any existing values (e.g. a previously-entered pickup total for that
    // day) stay intact. Only categories are pushed in that case.
    const record = {
      categories: mergedCategories,
      source:     'imported',
    };
    if (exportChannel === 'pickup' || exportChannel === 'delivery') {
      record[`${exportChannel}Revenue`] = Math.round(exportPreview.revenue * 100) / 100;
      record[`${exportChannel}Orders`] = exportPreview.orderCount;
    }

    if (exportTarget === 'daily') {
      onUpsertDay(key, record);
    } else {
      onUpsertMonth(key, record);
    }

    setExportFeedback({
      type: 'success',
      msg: `${t.exportSuccessPrefix || 'Exported to'} ${exportTarget === 'daily' ? (t.tabSummary || 'Daily Summary') : (t.tabMonthly || 'Monthly Summary')} (${key})`,
    });
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
    pushUndo();
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
    // `isIncluded` reflects the checkbox state: true = row is part of the
    // total and goes into the export's categories breakdown; false = the row
    // is excluded (dimmed + struck through visually).
    const isIncluded = !!item.isCategory;
    const isManual = type === 'manual';
    const sourceBadgeLabel = isManual ? t.badgeManual : t.badgeScanned;
    const sourceBadgeClass = isManual ? 'item-source-badge manual' : 'item-source-badge';
    const rowClass = [
      isManual ? 'manual-row' : '',
      isEditing ? 'editing-row' : '',
      isIncluded ? '' : 'excluded-row',
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
            <label className="cat-toggle" title={t.catToggleTitle || 'Include this row in the total'}>
              <input
                type="checkbox"
                checked={isIncluded}
                onChange={() => toggleCategory(uid)}
                aria-label={t.catToggleTitle || 'Include this row in the total'}
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
                <span className={sourceBadgeClass}>{sourceBadgeLabel}</span>
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
        <td className="item-subtotal">
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
          <h2 className="page-title">{t.tabScanner}</h2>
          <span className="item-count">{allItems.length} {allItems.length !== 1 ? t.itemsPlural : t.items}</span>
        </div>
        <div className="results-actions">
          {activeTab === 'summary' && (
            <button
              className="btn btn-ghost"
              onClick={undo}
              disabled={undoStack.length === 0}
              title={undoStack.length === 0 ? (t.undoEmpty || 'Nothing to undo') : (t.undoTooltip || 'Undo last change (⌘Z)')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.4rem', verticalAlign: '-2px' }}>
                <path d="M3 7v6h6"/>
                <path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>
              </svg>
              {t.undoBtn || 'Undo'}
              {undoStack.length > 0 && <span className="undo-count"> ({undoStack.length})</span>}
            </button>
          )}
          {rawText && activeTab === 'summary' && (
            <button className="btn btn-ghost" onClick={() => setShowRaw(!showRaw)}>
              {showRaw ? t.hideRawOCR : t.viewRawOCR}
            </button>
          )}
          {activeTab === 'summary' && (onUpsertDay || onUpsertMonth) && (
            <button
              className="btn btn-secondary"
              onClick={() => { setShowExport(v => !v); setExportFeedback(null); }}
              disabled={allItems.length === 0}
            >
              {t.exportToSummaryBtn || 'Export to Summary'}
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

          {showExport && (
            <div className="export-summary-panel">
              <div className="export-summary-row">
                <div className="export-summary-field">
                  <label className="target-label">{t.exportTargetLabel || 'Send to'}</label>
                  <div className="export-target-pills">
                    <button
                      type="button"
                      className={`filter-pill ${exportTarget === 'daily' ? 'active' : ''}`}
                      onClick={() => setExportTarget('daily')}
                    >{t.tabSummary || 'Daily'}</button>
                    <button
                      type="button"
                      className={`filter-pill ${exportTarget === 'monthly' ? 'active' : ''}`}
                      onClick={() => setExportTarget('monthly')}
                    >{t.tabMonthly || 'Monthly'}</button>
                  </div>
                </div>

                <div className="export-summary-field">
                  <label className="target-label">
                    {exportTarget === 'daily' ? (t.colDate || 'Date') : (t.labelMonth || 'Month')}
                  </label>
                  <input
                    type={exportTarget === 'daily' ? 'date' : 'month'}
                    className="form-input"
                    value={exportTarget === 'daily' ? exportDate : exportDate.slice(0, 7)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setExportDate(exportTarget === 'daily' ? v : `${v}-01`);
                    }}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                  />
                </div>

                <div className="export-summary-field">
                  <label className="target-label">
                    {t.exportChannelLabel || 'Channel'}
                    <span className="export-optional-tag">{t.exportOptional || 'optional'}</span>
                  </label>
                  <div className="export-target-pills">
                    <button
                      type="button"
                      className={`filter-pill ${exportChannel === 'none' ? 'active' : ''}`}
                      onClick={() => setExportChannel('none')}
                    >{t.exportChannelNone || 'Unspecified'}</button>
                    <button
                      type="button"
                      className={`filter-pill ${exportChannel === 'pickup' ? 'active' : ''}`}
                      onClick={() => setExportChannel('pickup')}
                    >{t.labelPickup || 'Pickup'}</button>
                    <button
                      type="button"
                      className={`filter-pill ${exportChannel === 'delivery' ? 'active' : ''}`}
                      onClick={() => setExportChannel('delivery')}
                    >{t.labelDelivery || 'Delivery'}</button>
                  </div>
                </div>
              </div>

              <div className="export-bulk-row">
                <span className="export-bulk-label">
                  {t.exportBulkLabel || 'Categories'}:
                </span>
                <button
                  type="button"
                  className={`filter-pill ${allCategoryState === 'all' ? 'active' : ''}`}
                  onClick={() => setAllCategories(true)}
                  disabled={allItems.length === 0}
                >
                  {t.exportSelectAllBtn || 'Select all'}
                </button>
                <button
                  type="button"
                  className={`filter-pill ${allCategoryState === 'none' ? 'active' : ''}`}
                  onClick={() => setAllCategories(false)}
                  disabled={allItems.length === 0}
                >
                  {t.exportClearAllBtn || 'Clear all'}
                </button>
                <span className="export-bulk-state">
                  {allItems.filter(i => i.isCategory).length} / {allItems.length} {t.exportSelectedSuffix || 'selected'}
                </span>
              </div>

              <div className="export-summary-preview">
                <span className="export-preview-pill"><strong>{exportPreview.orderCount}</strong> {t.labelOrders || 'orders'}</span>
                <span className="export-preview-pill"><strong>{formatCurrency(exportPreview.revenue)}</strong> {t.labelRevenue || 'revenue'}</span>
                <span className="export-preview-pill">
                  <strong>{Object.keys(exportPreview.categories).length}</strong>{' '}
                  {t.categoriesBadge || 'categories'}
                </span>
                {detectedDate && exportDate === detectedDate && (
                  <span className="export-preview-pill export-preview-auto">
                    {t.foodCostDateAuto || 'auto'}
                  </span>
                )}
                {exportChannel === 'none' && (
                  <span className="export-preview-pill export-preview-muted" title={t.exportChannelNoneTitle || 'Channel revenue stays at 0 for delivery and pickup; only the categories are pushed.'}>
                    {t.exportChannelNoneLabel || 'Channel skipped'}
                  </span>
                )}
              </div>

              {Object.keys(exportPreview.categories).length === 0 && (
                <p className="export-summary-hint">
                  {t.exportNoIncludedHint || 'No rows are checked. Use the checkboxes (or Select all) to choose which rows go into the summary — checked rows contribute to revenue and become category entries.'}
                </p>
              )}

              {Object.keys(exportPreview.categories).length > 0 && (
                <div className="export-summary-cats">
                  <span className="export-summary-cats-label">{t.revenueCategories || 'Revenue Categories'}</span>
                  <div className="category-list">
                    {Object.entries(exportPreview.categories).map(([name, cost]) => (
                      <div key={name} className="category-item">
                        <span className="category-name">{name}</span>
                        <span className="category-cost">{formatCurrency(cost)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {exportFeedback && (
                <div className={`export-feedback export-feedback-${exportFeedback.type}`}>
                  {exportFeedback.msg}
                </div>
              )}

              <div className="export-summary-actions">
                <button className="btn btn-ghost" onClick={() => { setShowExport(false); setExportFeedback(null); }}>
                  {t.cancelBtn || 'Cancel'}
                </button>
                <button className="btn btn-primary" onClick={handleExportToSummary}>
                  {t.exportConfirmBtn || 'Push to Summary'}
                </button>
              </div>
            </div>
          )}
          <div className={`results-body ${preview ? '' : 'no-preview'}`}>
            {preview && (
              <div className="preview-panel">
                <p className="preview-label">{t.badgeScanned}</p>
                <img src={preview} alt="Scanned ticket" className="preview-full" />
              </div>
            )}
            <div className="table-panel">
              <table className="order-table">
                <thead>
                  <tr>
                    <th>
                      <div className="th-item-with-toggle">
                        <label className="cat-toggle" title={t.selectAllToggleTitle || 'Toggle all rows'}>
                          <input
                            type="checkbox"
                            ref={(el) => { if (el) el.indeterminate = allCategoryState === 'some'; }}
                            checked={allCategoryState === 'all'}
                            onChange={() => setAllCategories(allCategoryState !== 'all')}
                            aria-label={t.selectAllToggleTitle || 'Toggle all rows'}
                            disabled={allItems.length === 0}
                          />
                        </label>
                        <span>{t.colItem}</span>
                      </div>
                    </th>
                    <th>{t.colUnitCost}</th>
                    <th>{t.colQty}</th>
                    <th>{t.colSubtotal}</th>
                    <th></th>
                  </tr>
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
        <CostAnalysis items={includedItems} itemCosts={itemCosts} onItemCostsChange={setItemCosts} />
      )}
    </div>
  );
}

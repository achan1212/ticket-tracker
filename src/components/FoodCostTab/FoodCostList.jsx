import { Fragment, useState } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';

const emptyEdit = { name: '', cost: '', quantity: '' };

// Items in the same file with identical name + unit cost get merged into a
// single parent row that can be expanded to reveal the individual entries.
const mergeKey = (item) => `${item.name}|${item.cost}`;

export default function FoodCostList({ fileGroups, onRemoveGroup, onUpdateItems, onSetGroupDate }) {
  const { t, formatCurrency } = useLang();
  const [editingKey, setEditingKey] = useState(null); // `${groupId}:${uid}`
  const [editForm, setEditForm] = useState(emptyEdit);
  // Set of group IDs that the user has manually collapsed. Default state is
  // expanded, matching the existing behavior — collapsing is opt-in.
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const toggleCollapsed = (id) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  // Set of merged-bucket keys `${groupId}|${name}|${cost}` that are currently
  // expanded. Default is collapsed (auto-merge is the new default behavior).
  const [expandedMerged, setExpandedMerged] = useState(() => new Set());
  const toggleMerged = (key) => {
    setExpandedMerged(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const startEdit = (groupId, item) => {
    setEditingKey(`${groupId}:${item._uid}`);
    setEditForm({
      name: item.name,
      cost: String(item.cost),
      quantity: String(item.quantity),
    });
  };
  const cancelEdit = () => { setEditingKey(null); setEditForm(emptyEdit); };
  const saveEdit = (groupId) => {
    if (!editingKey) return;
    const [, uid] = editingKey.split(':');
    const cost = parseFloat(editForm.cost);
    const quantity = parseInt(editForm.quantity, 10);
    const name = editForm.name.trim();
    if (!name || !Number.isFinite(cost) || cost < 0 || !Number.isInteger(quantity) || quantity < 1) return;
    const group = fileGroups.find(g => g.id === groupId);
    if (!group) return;
    onUpdateItems(groupId, group.items.map(i =>
      i._uid === uid ? { ...i, name, cost, quantity } : i
    ));
    cancelEdit();
  };
  const removeItem = (groupId, uid) => {
    const group = fileGroups.find(g => g.id === groupId);
    if (!group) return;
    onUpdateItems(groupId, group.items.filter(i => i._uid !== uid));
  };

  const renderItemRow = (item, groupId, isChild = false) => {
    const key = `${groupId}:${item._uid}`;
    const isEditing = editingKey === key;
    return (
      <tr key={item._uid} className={isChild ? 'fc-row-child' : undefined}>
        {isEditing ? (
          <>
            <td><input className="form-input form-input-inline" name="name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              autoFocus /></td>
            <td><input className="form-input form-input-inline form-input-num" type="number" min="0" step="0.01" name="cost"
              value={editForm.cost}
              onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })} /></td>
            <td><input className="form-input form-input-inline form-input-num" type="number" min="1" name="quantity"
              value={editForm.quantity}
              onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} /></td>
            <td>{formatCurrency((parseFloat(editForm.cost) || 0) * (parseInt(editForm.quantity, 10) || 0))}</td>
            <td className="fc-row-actions">
              <button className="btn-save" onClick={() => saveEdit(groupId)} title={t.saveBtn || 'Save'}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
              <button className="btn-remove" onClick={cancelEdit} title={t.cancelBtn || 'Cancel'} aria-label={t.cancelBtn || 'Cancel'}>×</button>
            </td>
          </>
        ) : (
          <>
            <td className="fc-item-name">{item.name}</td>
            <td>{formatCurrency(item.cost)}</td>
            <td><span className="qty-badge">{item.quantity}×</span></td>
            <td>{formatCurrency(item.cost * item.quantity)}</td>
            <td className="fc-row-actions">
              <button className="btn-edit" onClick={() => startEdit(groupId, item)} title={t.editBtn || 'Edit'}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                </svg>
              </button>
              <button className="btn-remove" onClick={() => removeItem(groupId, item._uid)} title={t.removeBtn || 'Remove'} aria-label={t.removeBtn || 'Remove'}>×</button>
            </td>
          </>
        )}
      </tr>
    );
  };

  return (
    <div className="fc-groups">
      {fileGroups.map(group => {
        const groupTotal = group.items.reduce((s, i) => s + i.cost * i.quantity, 0);
        const isCollapsed = collapsedIds.has(group.id);
        // Bucket items by name + unit cost. Preserves original order via the
        // first occurrence of each key.
        const mergeBuckets = [];
        const bucketByKey = new Map();
        for (const item of group.items) {
          const k = mergeKey(item);
          if (!bucketByKey.has(k)) {
            const b = { key: k, name: item.name, cost: item.cost, items: [] };
            bucketByKey.set(k, b);
            mergeBuckets.push(b);
          }
          bucketByKey.get(k).items.push(item);
        }
        return (
          <section key={group.id} className={`fc-group fc-group-${group.status} ${isCollapsed ? 'fc-group-collapsed' : ''}`}>
            <header className="fc-group-header">
              <button
                type="button"
                className="fc-group-chevron"
                onClick={() => toggleCollapsed(group.id)}
                aria-expanded={!isCollapsed}
                aria-label={isCollapsed ? (t.expandBtn || 'Expand') : (t.collapseBtn || 'Collapse')}
                title={isCollapsed ? (t.expandBtn || 'Expand') : (t.collapseBtn || 'Collapse')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              <div className="fc-group-meta">
                <span className="fc-group-name" title={group.name}>{group.name}</span>
                {group.status === 'processing' && (
                  <span className="fc-group-status">
                    {t.foodCostProcessing || 'Processing'}
                    {typeof group.progress === 'number' && group.progress > 0 ? ` · ${group.progress}%` : ''}
                  </span>
                )}
                {group.status === 'done' && (
                  <span className="fc-group-status">
                    {group.items.length} {group.items.length === 1
                      ? (t.foodCostItem || 'item')
                      : (t.foodCostItems || 'items')}
                    {' · '}{formatCurrency(groupTotal)}
                  </span>
                )}
                {group.status === 'error' && (
                  <span className="fc-group-status fc-group-status-error">
                    {t.foodCostErrorLabel || 'Error'}: {group.error}
                  </span>
                )}
              </div>
              <div className="fc-group-actions">
                {group.status === 'done' && (
                  <label className="fc-date-pick" title={t.foodCostDateTitle || 'Date this purchase counts toward'}>
                    <span className="fc-date-label">{t.foodCostDateLabel || 'Date'}</span>
                    <input
                      type="date"
                      className="form-input fc-date-input"
                      value={group.date || ''}
                      onChange={(e) => onSetGroupDate(group.id, e.target.value)}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                    />
                    {group.detectedDate && group.date === group.detectedDate && (
                      <span className="fc-date-auto" title={t.foodCostDateAutoTitle || 'Detected from the file'}>
                        {t.foodCostDateAuto || 'auto'}
                      </span>
                    )}
                  </label>
                )}
                <button
                  className="btn-remove"
                  title={t.removeBtn || 'Remove'}
                  onClick={() => onRemoveGroup(group.id)}
                >×</button>
              </div>
            </header>

            {!isCollapsed && group.status === 'done' && group.items.length === 0 && (
              <p className="fc-group-empty">{t.foodCostNoItemsInFile || 'No items detected in this file.'}</p>
            )}

            {!isCollapsed && group.status === 'done' && group.items.length > 0 && (
              <table className="fc-table">
                <thead>
                  <tr>
                    <th>{t.colItem || 'Item'}</th>
                    <th>{t.colUnitCost || 'Unit Cost'}</th>
                    <th>{t.colQty || 'Qty'}</th>
                    <th>{t.colSubtotal || 'Subtotal'}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {mergeBuckets.map(bucket => {
                    if (bucket.items.length === 1) {
                      return renderItemRow(bucket.items[0], group.id);
                    }
                    const bucketKey = `${group.id}|${bucket.key}`;
                    const isExpanded = expandedMerged.has(bucketKey);
                    const totalQty = bucket.items.reduce((s, i) => s + i.quantity, 0);
                    const totalSubtotal = bucket.cost * totalQty;
                    const entryLabel = t.foodCostItems || 'items';
                    return (
                      <Fragment key={bucketKey}>
                        <tr className={`fc-row-merged ${isExpanded ? 'fc-row-merged-expanded' : ''}`}>
                          <td className="fc-item-name">
                            <button
                              type="button"
                              className="fc-merge-toggle"
                              onClick={() => toggleMerged(bucketKey)}
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? (t.collapseBtn || 'Collapse') : (t.expandBtn || 'Expand')}
                              title={isExpanded ? (t.collapseBtn || 'Collapse') : (t.expandBtn || 'Expand')}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="6 9 12 15 18 9"/>
                              </svg>
                            </button>
                            <span>{bucket.name}</span>
                            <span className="fc-merge-count">{bucket.items.length} {entryLabel}</span>
                          </td>
                          <td>{formatCurrency(bucket.cost)}</td>
                          <td><span className="qty-badge">{totalQty}×</span></td>
                          <td>{formatCurrency(totalSubtotal)}</td>
                          <td className="fc-row-actions" />
                        </tr>
                        {isExpanded && bucket.items.map(item => renderItemRow(item, group.id, true))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}

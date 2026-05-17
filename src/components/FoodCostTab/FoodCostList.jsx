import { useState } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';
import { formatCurrency } from '@utils/helpers';

const emptyEdit = { name: '', cost: '', quantity: '' };

export default function FoodCostList({ fileGroups, onRemoveGroup, onUpdateItems, onSetGroupDate }) {
  const { t } = useLang();
  const [editingKey, setEditingKey] = useState(null); // `${groupId}:${uid}`
  const [editForm, setEditForm] = useState(emptyEdit);

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

  return (
    <div className="fc-groups">
      {fileGroups.map(group => {
        const groupTotal = group.items.reduce((s, i) => s + i.cost * i.quantity, 0);
        return (
          <section key={group.id} className={`fc-group fc-group-${group.status}`}>
            <header className="fc-group-header">
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

            {group.status === 'done' && group.items.length === 0 && (
              <p className="fc-group-empty">{t.foodCostNoItemsInFile || 'No items detected in this file.'}</p>
            )}

            {group.status === 'done' && group.items.length > 0 && (
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
                  {group.items.map(item => {
                    const key = `${group.id}:${item._uid}`;
                    const isEditing = editingKey === key;
                    return (
                      <tr key={item._uid}>
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
                              <button className="btn-save" onClick={() => saveEdit(group.id)} title={t.saveBtn || 'Save'}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              </button>
                              <button className="btn-remove" onClick={cancelEdit} title={t.cancelBtn || 'Cancel'}>×</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="fc-item-name">{item.name}</td>
                            <td>{formatCurrency(item.cost)}</td>
                            <td><span className="qty-badge">{item.quantity}×</span></td>
                            <td>{formatCurrency(item.cost * item.quantity)}</td>
                            <td className="fc-row-actions">
                              <button className="btn-edit" onClick={() => startEdit(group.id, item)} title={t.editBtn || 'Edit'}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 20h9"/>
                                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                                </svg>
                              </button>
                              <button className="btn-remove" onClick={() => removeItem(group.id, item._uid)} title={t.removeBtn || 'Remove'}>×</button>
                            </td>
                          </>
                        )}
                      </tr>
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

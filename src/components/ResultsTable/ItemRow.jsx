import { useLang } from '../../i18n/LangContext.jsx';

// Row-only icons. ItemRow is the sole consumer, so they live here rather
// than in a shared module.
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

// A single order row in the Scanner results table. Renders either a static
// view or an inline edit form depending on `isEditing`. All mutations are
// delegated to the parent through the on* callbacks; this component holds no
// state of its own.
export default function ItemRow({
  entry,
  displayIndex,
  isEditing,
  editForm,
  editLiveSubtotal,
  draggingUid,
  dragOverUid,
  onEditChange,
  onEditKeyDown,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onRemoveItem,
  onToggleCategory,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}) {
  const { t, formatCurrency } = useLang();
  const { uid, item, type } = entry;

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
      className={rowClass}
      style={{ animationDelay: `${displayIndex * 0.04}s` }}
      draggable={!isEditing}
      onDragStart={(e) => onDragStart(e, uid)}
      onDragOver={(e) => onDragOver(e, uid)}
      onDragLeave={(e) => onDragLeave(e, uid)}
      onDrop={(e) => onDrop(e, uid)}
      onDragEnd={onDragEnd}
    >
      <td className="item-name">
        <div className="name-cell">
          <span className="drag-handle" title={t.dragHandleTitle || 'Drag to reorder'} aria-hidden="true">{dragIcon}</span>
          <label className="cat-toggle" title={t.catToggleTitle || 'Include this row in the total'}>
            <input
              type="checkbox"
              checked={isIncluded}
              onChange={() => onToggleCategory(uid)}
              aria-label={t.catToggleTitle || 'Include this row in the total'}
            />
          </label>
          {isEditing ? (
            <input
              className="form-input form-input-inline"
              name="name"
              value={editForm.name}
              onChange={onEditChange}
              onKeyDown={onEditKeyDown}
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
            onChange={onEditChange}
            onKeyDown={onEditKeyDown}
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
            onChange={onEditChange}
            onKeyDown={onEditKeyDown}
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
            <button className="btn-save" title={t.saveBtn || 'Save'} onClick={onSaveEdit}>{saveIcon}</button>
            <button className="btn-remove" title={t.cancelBtn || 'Cancel'} aria-label={t.cancelBtn || 'Cancel'} onClick={onCancelEdit}>×</button>
          </>
        ) : (
          <>
            <button className="btn-edit" title={t.editBtn || 'Edit'} onClick={() => onStartEdit(uid)}>{editIcon}</button>
            <button className="btn-remove" title={t.removeBtn || 'Remove'} aria-label={t.removeBtn || 'Remove'} onClick={() => onRemoveItem(uid)}>×</button>
          </>
        )}
      </td>
    </tr>
  );
}

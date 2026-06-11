import { useMemo, useState } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';
import './InventoryTab.css';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthISO() {
  return new Date().toISOString().slice(0, 7);
}

function formatMonthYear(ym) {
  const [year, month] = ym.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDay(iso) {
  const [year, month, day] = iso.split('-');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const MOVEMENT_TYPES = ['restock', 'usage', 'waste'];
const MOVEMENTS_SHOWN = 40;

const emptyDraft = { type: 'usage', quantity: '', date: '', note: '' };

export default function InventoryTab({ inventory, foodCostGroups = [] }) {
  const { t } = useLang();
  const {
    items, movements, onHandByItem, importedGroupIds, lowStockCount,
    addItem, removeItem, addMovement, removeMovement, importFoodCostGroup,
  } = inventory;

  const [newItem, setNewItem] = useState({ name: '', unit: '', parLevel: '' });
  const [adjustingId, setAdjustingId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [summaryMonth, setSummaryMonth] = useState(currentMonthISO());

  const typeLabels = {
    restock: t.invTypeRestock || 'Restock',
    usage:   t.invTypeUsage   || 'Usage',
    waste:   t.invTypeWaste   || 'Waste',
  };

  const itemsById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );

  // Done food-cost groups that haven't been pulled into the ledger yet.
  const importableGroups = useMemo(
    () => foodCostGroups
      .filter(g => g.status === 'done' && !importedGroupIds.has(g.id))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [foodCostGroups, importedGroupIds]
  );

  // Per-item rollup for the selected month: restocked / used / wasted.
  const monthlySummary = useMemo(() => {
    const byItem = {};
    for (const m of movements) {
      if (!m.date || m.date.slice(0, 7) !== summaryMonth) continue;
      if (!byItem[m.itemId]) byItem[m.itemId] = { restock: 0, usage: 0, waste: 0 };
      byItem[m.itemId][m.type] += Number(m.quantity) || 0;
    }
    return Object.entries(byItem)
      .map(([itemId, sums]) => ({
        item: itemsById.get(itemId),
        ...sums,
        net: sums.restock - sums.usage - sums.waste,
      }))
      .filter(row => row.item)
      .sort((a, b) => a.item.name.localeCompare(b.item.name));
  }, [movements, summaryMonth, itemsById]);

  const canGoNextMonth = summaryMonth < currentMonthISO();

  const recentMovements = useMemo(
    () => [...movements]
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
      .slice(0, MOVEMENTS_SHOWN),
    [movements]
  );

  const handleAddItem = () => {
    if (!newItem.name.trim()) return;
    addItem(newItem);
    setNewItem({ name: '', unit: '', parLevel: '' });
  };

  const openAdjust = (itemId) => {
    setAdjustingId(itemId === adjustingId ? null : itemId);
    setDraft({ ...emptyDraft, date: todayISO() });
  };

  const handleRecord = (itemId) => {
    const qty = parseFloat(draft.quantity);
    if (!(qty > 0) || !draft.date) return;
    addMovement({ itemId, date: draft.date, type: draft.type, quantity: qty, note: draft.note.trim() });
    setAdjustingId(null);
    setDraft(emptyDraft);
  };

  return (
    <div className="inv-tab">
      <div className="inv-header">
        <h2 className="page-title">{t.tabInventory || 'Inventory'}</h2>
        {lowStockCount > 0 && (
          <span className="inv-low-badge" role="status">
            {lowStockCount} {t.invLowStock || 'low stock'}
          </span>
        )}
      </div>
      <p className="inv-sub">
        {t.invSub || 'Track what you have on hand. Every restock, usage, and waste entry is dated, so daily movements roll up into the monthly summary below.'}
      </p>

      {/* ── ADD ITEM ── */}
      <div className="inv-add-form">
        <input
          className="form-input"
          placeholder={t.invNamePlaceholder || 'Item name (e.g. Mozzarella Cheese (5 lb))'}
          value={newItem.name}
          onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && handleAddItem()}
        />
        <input
          className="form-input inv-unit-input"
          placeholder={t.invUnitPlaceholder || 'Unit (case, lb…)'}
          value={newItem.unit}
          onChange={e => setNewItem(n => ({ ...n, unit: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && handleAddItem()}
        />
        <input
          className="form-input inv-par-input"
          type="number" min="0" step="1"
          placeholder={t.invParPlaceholder || 'Par level'}
          value={newItem.parLevel}
          onChange={e => setNewItem(n => ({ ...n, parLevel: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && handleAddItem()}
        />
        <button className="btn btn-primary btn-sm" onClick={handleAddItem} disabled={!newItem.name.trim()}>
          {t.invAddBtn || 'Add Item'}
        </button>
      </div>

      {/* ── ITEMS TABLE ── */}
      {sortedItems.length === 0 ? (
        <div className="inv-empty">{t.invEmpty || 'No inventory items yet. Add one above, or pull in a food-cost import below.'}</div>
      ) : (
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th>{t.invColItem || 'Item'}</th>
                <th>{t.invColUnit || 'Unit'}</th>
                <th>{t.invColOnHand || 'On hand'}</th>
                <th>{t.invColPar || 'Par'}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sortedItems.map(item => {
                const onHand = onHandByItem[item.id] || 0;
                const isLow = (item.parLevel || 0) > 0 && onHand <= item.parLevel;
                const isAdjusting = adjustingId === item.id;
                return (
                  <InventoryRow
                    key={item.id}
                    item={item}
                    onHand={onHand}
                    isLow={isLow}
                    isAdjusting={isAdjusting}
                    draft={draft}
                    setDraft={setDraft}
                    typeLabels={typeLabels}
                    onToggleAdjust={() => openAdjust(item.id)}
                    onRecord={() => handleRecord(item.id)}
                    onRemove={() => removeItem(item.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── STOCK-IN FROM FOOD COST IMPORTS ── */}
      <section className="inv-section">
        <h3 className="inv-section-title">{t.invImportTitle || 'Add stock from Food Cost imports'}</h3>
        <p className="inv-section-hint">
          {t.invImportHint || 'Each delivery you imported on the Food Cost tab can be added to the ledger once — line items become restocks dated to the delivery.'}
        </p>
        {importableGroups.length === 0 ? (
          <div className="inv-empty inv-empty-sm">{t.invNoImports || 'Nothing to pull in — all food-cost imports are already in the ledger.'}</div>
        ) : (
          <ul className="inv-import-list">
            {importableGroups.map(g => (
              <li key={g.id} className="inv-import-item">
                <span className="inv-import-name" title={g.name}>{g.name}</span>
                <span className="inv-import-meta">{g.date} · {g.items.length} {t.itemsPlural || 'items'}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => importFoodCostGroup(g)}>
                  {t.invImportBtn || 'Add to inventory'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── MONTHLY SUMMARY ── */}
      <section className="inv-section">
        <h3 className="inv-section-title">{t.invMonthlyTitle || 'Monthly movement summary'}</h3>
        <div className="inv-month-nav">
          <button
            className="btn btn-ghost btn-sm"
            title={t.plPrevMonth || 'Previous month'}
            aria-label={t.plPrevMonth || 'Previous month'}
            onClick={() => setSummaryMonth(m => shiftMonth(m, -1))}
          >←</button>
          <span className="inv-month-label">{formatMonthYear(summaryMonth)}</span>
          <button
            className="btn btn-ghost btn-sm"
            title={t.plNextMonth || 'Next month'}
            aria-label={t.plNextMonth || 'Next month'}
            disabled={!canGoNextMonth}
            onClick={() => canGoNextMonth && setSummaryMonth(m => shiftMonth(m, 1))}
          >→</button>
        </div>
        {monthlySummary.length === 0 ? (
          <div className="inv-empty inv-empty-sm">{t.invNoMonthData || 'No inventory movements recorded this month.'}</div>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>{t.invColItem || 'Item'}</th>
                  <th>{t.invColRestocked || 'Restocked'}</th>
                  <th>{t.invColUsed || 'Used'}</th>
                  <th>{t.invColWasted || 'Wasted'}</th>
                  <th>{t.invColNet || 'Net'}</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummary.map(row => (
                  <tr key={row.item.id}>
                    <td className="inv-cell-name">{row.item.name}</td>
                    <td className="inv-cell-pos">{row.restock > 0 ? `+${row.restock}` : '—'}</td>
                    <td>{row.usage > 0 ? `−${row.usage}` : '—'}</td>
                    <td className="inv-cell-neg">{row.waste > 0 ? `−${row.waste}` : '—'}</td>
                    <td className={row.net < 0 ? 'inv-cell-neg' : 'inv-cell-pos'}>
                      {row.net > 0 ? `+${row.net}` : row.net}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── RECENT MOVEMENTS ── */}
      <section className="inv-section">
        <h3 className="inv-section-title">{t.invMovementsTitle || 'Recent movements'}</h3>
        {recentMovements.length === 0 ? (
          <div className="inv-empty inv-empty-sm">{t.invNoMovements || 'No movements yet — record a restock or usage from the items table.'}</div>
        ) : (
          <ul className="inv-movement-list">
            {recentMovements.map(m => {
              const item = itemsById.get(m.itemId);
              if (!item) return null;
              return (
                <li key={m.id} className="inv-movement-item">
                  <span className="inv-mv-date">{formatDay(m.date)}</span>
                  <span className={`inv-mv-type inv-mv-${m.type}`}>{typeLabels[m.type]}</span>
                  <span className="inv-mv-name">{item.name}</span>
                  <span className="inv-mv-qty">{m.type === 'restock' ? '+' : '−'}{m.quantity}{item.unit ? ` ${item.unit}` : ''}</span>
                  {m.note && <span className="inv-mv-note" title={m.note}>{m.note}</span>}
                  <button
                    className="btn-remove"
                    title={t.invRemoveMovement || 'Remove entry'}
                    aria-label={t.invRemoveMovement || 'Remove entry'}
                    onClick={() => removeMovement(m.id)}
                  >×</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// One item row + its expandable adjust form. Kept in this file — it owns no
// state and only exists to keep the table JSX readable.
function InventoryRow({ item, onHand, isLow, isAdjusting, draft, setDraft, typeLabels, onToggleAdjust, onRecord, onRemove }) {
  const { t } = useLang();
  return (
    <>
      <tr className={isLow ? 'inv-row-low' : ''}>
        <td className="inv-cell-name">
          {item.name}
          {isLow && <span className="inv-low-pill">{t.invLowStock || 'low stock'}</span>}
        </td>
        <td>{item.unit || '—'}</td>
        <td className={isLow ? 'inv-cell-neg' : ''}>{onHand}</td>
        <td>{item.parLevel > 0 ? item.parLevel : '—'}</td>
        <td className="inv-cell-actions">
          <button className="btn btn-ghost btn-sm" onClick={onToggleAdjust} aria-expanded={isAdjusting}>
            {isAdjusting ? (t.cancelBtn || 'Cancel') : (t.invAdjustBtn || 'Adjust')}
          </button>
          <button
            className="btn-remove"
            title={t.invRemoveItem || 'Remove item'}
            aria-label={t.invRemoveItem || 'Remove item'}
            onClick={onRemove}
          >×</button>
        </td>
      </tr>
      {isAdjusting && (
        <tr className="inv-adjust-row">
          <td colSpan={5}>
            <div className="inv-adjust-form">
              <div className="inv-adjust-pills">
                {['restock', 'usage', 'waste'].map(type => (
                  <button
                    key={type}
                    type="button"
                    className={`filter-pill ${draft.type === type ? 'active' : ''}`}
                    onClick={() => setDraft(d => ({ ...d, type }))}
                  >
                    {typeLabels[type]}
                  </button>
                ))}
              </div>
              <input
                className="form-input inv-qty-input"
                type="number" min="0" step="any"
                placeholder={t.invQtyPlaceholder || 'Qty'}
                value={draft.quantity}
                onChange={e => setDraft(d => ({ ...d, quantity: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && onRecord()}
              />
              <input
                type="date"
                className="form-input date-input"
                value={draft.date}
                max={todayISO()}
                onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
                onClick={e => e.currentTarget.showPicker?.()}
              />
              <input
                className="form-input inv-note-input"
                placeholder={t.invNotePlaceholder || 'Note (optional)'}
                value={draft.note}
                onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && onRecord()}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={onRecord}
                disabled={!(parseFloat(draft.quantity) > 0) || !draft.date}
              >
                {t.invRecordBtn || 'Record'}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

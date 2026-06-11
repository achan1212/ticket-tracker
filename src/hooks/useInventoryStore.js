import { useCallback, useMemo } from 'react';
import { useLocalStore } from './useLocalStore.js';

/**
 * Persisted inventory store — a dated stock ledger.
 *
 * Shape:
 *   {
 *     items: [
 *       { id, name, unit, parLevel }            // parLevel 0 = no par tracking
 *     ],
 *     movements: [
 *       { id, itemId, date: 'YYYY-MM-DD',
 *         type: 'restock' | 'usage' | 'waste',  // restock adds, usage/waste subtract
 *         quantity: number,                     // always positive; type carries the sign
 *         note: string,
 *         source: 'manual' | 'import' | 'demo',
 *         sourceGroupId?: string }              // food-cost group id when source === 'import'
 *     ],
 *   }
 *
 * On-hand is never stored — it's derived by summing movements, so the ledger
 * stays the single source of truth and day/month rollups always agree with
 * the headline number.
 */
const INITIAL = { items: [], movements: [] };

function freshId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useInventoryStore() {
  const [data, setData] = useLocalStore('inventory', { version: 1, initial: INITIAL });

  const items = data?.items || [];
  const movements = data?.movements || [];

  const addItem = useCallback(({ name, unit = '', parLevel = 0 }) => {
    const id = freshId('inv');
    setData(prev => {
      const base = prev || INITIAL;
      return { ...base, items: [...(base.items || []), { id, name: name.trim(), unit: unit.trim(), parLevel: Number(parLevel) || 0 }] };
    });
    return id;
  }, [setData]);

  const updateItem = useCallback((id, patch) => {
    setData(prev => {
      const base = prev || INITIAL;
      return { ...base, items: (base.items || []).map(i => i.id === id ? { ...i, ...patch } : i) };
    });
  }, [setData]);

  // Removing an item also drops its movement history — orphaned movements
  // would silently skew month rollups with rows no UI can show.
  const removeItem = useCallback((id) => {
    setData(prev => {
      const base = prev || INITIAL;
      return {
        items: (base.items || []).filter(i => i.id !== id),
        movements: (base.movements || []).filter(m => m.itemId !== id),
      };
    });
  }, [setData]);

  const addMovement = useCallback(({ itemId, date, type, quantity, note = '', source = 'manual', sourceGroupId }) => {
    const qty = Number(quantity);
    if (!itemId || !date || !(qty > 0)) return;
    setData(prev => {
      const base = prev || INITIAL;
      const movement = { id: freshId('mv'), itemId, date, type, quantity: qty, note, source };
      if (sourceGroupId) movement.sourceGroupId = sourceGroupId;
      return { ...base, movements: [...(base.movements || []), movement] };
    });
  }, [setData]);

  const removeMovement = useCallback((id) => {
    setData(prev => {
      const base = prev || INITIAL;
      return { ...base, movements: (base.movements || []).filter(m => m.id !== id) };
    });
  }, [setData]);

  // Pull one food-cost import group into the ledger: each line item becomes a
  // restock dated to the group's date. Items are matched by name
  // (case-insensitive) or created on the fly. Guarded by sourceGroupId so the
  // same group can't be imported twice.
  const importFoodCostGroup = useCallback((group) => {
    if (!group || group.status !== 'done') return;
    setData(prev => {
      const base = prev || INITIAL;
      const already = (base.movements || []).some(m => m.sourceGroupId === group.id);
      if (already) return base;

      const nextItems = [...(base.items || [])];
      const byName = new Map(nextItems.map(i => [i.name.trim().toLowerCase(), i]));
      const nextMovements = [...(base.movements || [])];

      for (const line of group.items || []) {
        const key = (line.name || '').trim().toLowerCase();
        if (!key) continue;
        let item = byName.get(key);
        if (!item) {
          item = { id: freshId('inv'), name: line.name.trim(), unit: '', parLevel: 0 };
          nextItems.push(item);
          byName.set(key, item);
        }
        nextMovements.push({
          id: freshId('mv'),
          itemId: item.id,
          date: group.date,
          type: 'restock',
          quantity: Number(line.quantity) || 1,
          note: group.name || '',
          source: 'import',
          sourceGroupId: group.id,
        });
      }
      return { items: nextItems, movements: nextMovements };
    });
  }, [setData]);

  // Demo loader: merge by id so re-loads replace demo rows and never touch
  // user-created items/movements. Same convention as upsertRecipes.
  const upsertDemo = useCallback(({ items: demoItems = [], movements: demoMovements = [] }) => {
    setData(prev => {
      const base = prev || INITIAL;
      const itemIds = new Set(demoItems.map(i => i.id));
      const mvIds = new Set(demoMovements.map(m => m.id));
      return {
        items: [...(base.items || []).filter(i => !itemIds.has(i.id)), ...demoItems],
        movements: [...(base.movements || []).filter(m => !mvIds.has(m.id)), ...demoMovements],
      };
    });
  }, [setData]);

  const clearAll = useCallback(() => setData(INITIAL), [setData]);

  // Derived: on-hand per item, which import groups are already pulled in, and
  // how many items sit at/below their par level.
  const { onHandByItem, importedGroupIds, lowStockCount } = useMemo(() => {
    const onHand = {};
    const imported = new Set();
    for (const m of movements) {
      const sign = m.type === 'restock' ? 1 : -1;
      onHand[m.itemId] = (onHand[m.itemId] || 0) + sign * (Number(m.quantity) || 0);
      if (m.sourceGroupId) imported.add(m.sourceGroupId);
    }
    let low = 0;
    for (const i of items) {
      if ((i.parLevel || 0) > 0 && (onHand[i.id] || 0) <= i.parLevel) low += 1;
    }
    return { onHandByItem: onHand, importedGroupIds: imported, lowStockCount: low };
  }, [items, movements]);

  return {
    items, movements,
    onHandByItem, importedGroupIds, lowStockCount,
    addItem, updateItem, removeItem,
    addMovement, removeMovement,
    importFoodCostGroup, upsertDemo, clearAll,
  };
}

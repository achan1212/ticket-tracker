import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';
import { parseFoodCostFile, flattenForExport } from '@utils/foodCostIO';
import { formatCurrency } from '@utils/helpers';
import { useFoodCostStore } from '@hooks/useFoodCostStore';
import FoodCostList from './FoodCostList.jsx';
import './FoodCostTab.css';

// Stable id for each upload, separate from item uids.
function makeFileId() {
  return `up-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function FoodCostTab() {
  const { t } = useLang();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const {
    groups: fileGroups,
    upsertGroup,
    patchGroup,
    removeGroup,
    updateItems,
    setGroupDate,
    clearAll,
  } = useFoodCostStore();

  const acceptString = 'image/*,.csv,.tsv,.xlsx,.xls';

  // Pending File handles can't be serialized into localStorage, so they're
  // kept in a ref keyed by group id and consumed once during processing.
  const pendingFiles = useRef(new Map());

  // If a tab reload happens mid-upload, any group still in 'processing' has
  // lost its File handle. Surface that as a recoverable error so the user
  // knows to re-upload rather than staring at a dead spinner.
  useEffect(() => {
    const stuck = fileGroups.filter(g => g.status === 'processing' && !pendingFiles.current.has(g.id));
    for (const g of stuck) {
      patchGroup(g.id, { status: 'error', error: t.foodCostInterruptedError || 'Upload interrupted — re-upload this file.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processOne = async (id) => {
    const file = pendingFiles.current.get(id);
    if (!file) return;
    try {
      const { fileName, items, detectedDate } = await parseFoodCostFile(file, (p) => {
        patchGroup(id, { progress: p });
      });
      patchGroup(id, {
        status: 'done',
        items,
        name: fileName,
        progress: 100,
        detectedDate: detectedDate || null,
        date: detectedDate || todayISO(),
      });
    } catch (err) {
      patchGroup(id, { status: 'error', error: err.message || String(err) });
    } finally {
      pendingFiles.current.delete(id);
    }
  };

  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const queued = files.map(f => {
      const id = makeFileId();
      pendingFiles.current.set(id, f);
      return {
        id,
        name: f.name,
        status: 'processing',
        items: [],
        progress: 0,
        date: null,
        importedAt: new Date().toISOString(),
      };
    });
    for (const g of queued) upsertGroup(g);
    // Process serially to avoid hammering the device with N parallel Tesseract
    // workers. Spreadsheets resolve instantly; only images take measurable time.
    (async () => {
      for (const q of queued) await processOne(q.id);
    })();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleClearAll = () => {
    // Safety against accidentally nuking persisted data — confirm because the
    // food cost store now lives across reloads.
    if (fileGroups.length === 0) return;
    const confirmed = window.confirm(t.foodCostClearConfirm || 'Clear all food cost imports? This cannot be undone.');
    if (confirmed) clearAll();
  };

  const doneGroups = fileGroups.filter(g => g.status === 'done');
  const totalItems = doneGroups.reduce((s, g) => s + g.items.length, 0);
  const totalCost  = doneGroups.reduce(
    (s, g) => s + g.items.reduce((a, i) => a + i.cost * i.quantity, 0),
    0
  );

  const handleExport = () => {
    const rows = flattenForExport(doneGroups);
    if (rows.length === 0) return;
    // Custom CSV: include the source-file column so provenance survives export.
    const header = 'Item,Quantity,Unit Cost,Subtotal,Source File\n';
    const body = rows.map(r =>
      `"${r.name.replace(/"/g, '""')}",${r.quantity},${r.cost.toFixed(2)},${(r.cost * r.quantity).toFixed(2)},"${r.sourceFile.replace(/"/g, '""')}"`
    ).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'food-cost-import.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fc-wrap">
      <div className="fc-header">
        <div>
          <h2 className="fc-title">{t.foodCostTitle || 'Food Cost Import'}</h2>
          <p className="fc-sub">{t.foodCostSub || 'Receipts, spreadsheets, or CSVs — drop them in and the items are consolidated into one list.'}</p>
        </div>
        {fileGroups.length > 0 && (
          <div className="fc-header-actions">
            <button className="btn btn-secondary" onClick={handleExport} disabled={totalItems === 0}>
              {t.exportCSV || 'Export CSV'}
            </button>
            <button className="btn btn-ghost" onClick={handleClearAll}>
              {t.foodCostClearBtn || 'Clear all'}
            </button>
          </div>
        )}
      </div>

      <div
        className={`fc-drop ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptString}
          style={{ display: 'none' }}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
        <div className="fc-drop-icon" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <p className="fc-drop-title">{t.foodCostDropTitle || 'Drop receipts, CSVs, or Excel files here'}</p>
        <p className="fc-drop-sub">{t.foodCostDropSub || 'You can select multiple files at once. Images go through OCR; spreadsheets are parsed by header.'}</p>
      </div>

      {fileGroups.length > 0 && (
        <>
          <div className="fc-summary">
            <span className="fc-summary-pill">
              {fileGroups.length} {fileGroups.length === 1
                ? (t.foodCostFile || 'file')
                : (t.foodCostFiles || 'files')}
            </span>
            <span className="fc-summary-pill">
              {totalItems} {totalItems === 1
                ? (t.foodCostItem || 'item')
                : (t.foodCostItems || 'items')}
            </span>
            <span className="fc-summary-pill fc-summary-total">
              {(t.total || 'Total')}: {formatCurrency(totalCost)}
            </span>
          </div>

          <FoodCostList
            fileGroups={fileGroups}
            onRemoveGroup={removeGroup}
            onUpdateItems={updateItems}
            onSetGroupDate={setGroupDate}
          />
        </>
      )}
    </div>
  );
}

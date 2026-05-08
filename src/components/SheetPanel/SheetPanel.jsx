import { useRef, useState } from 'react';
import { exportToXlsx, importFromXlsx } from '@utils/sheetIO';
import { useLang } from '../../i18n/LangContext.jsx';
import './SheetPanel.css';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function SheetPanel({ items, itemCosts, deliveryRates, orderCount, onImport }) {
  const importRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [sessionDate, setSessionDate] = useState(todayISO());
  const { t } = useLang();

  const handleExport = () => {
    if (items.length === 0) return;
    exportToXlsx(items, itemCosts, deliveryRates, orderCount, sessionDate);
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    setImporting(true);
    setImportError('');
    setImportSuccess('');
    try {
      const imported = await importFromXlsx(file);
      onImport(imported);
      const countLabel = `${imported.length} ${imported.length !== 1 ? t.itemsPlural : t.items}`;
      setImportSuccess(`✓ ${countLabel} — ${file.name}`);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
      importRef.current.value = '';
    }
  };

  return (
    <div className="sheet-panel">
      <div className="sheet-panel-inner">
        {/* DATE */}
        <div className="sheet-date-row">
          <div className="sheet-date-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="sheet-text">
            <p className="sheet-label">{t.orderDateLabel}</p>
            <p className="sheet-sub">{t.orderDateSub}</p>
          </div>
          <input type="date" className="form-input date-input" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
        </div>

        <div className="sheet-divider" />

        {/* EXPORT */}
        <div className="sheet-section">
          <div className="sheet-icon export-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <div className="sheet-text">
            <p className="sheet-label">{t.exportLabel}</p>
            <p className="sheet-sub">{t.exportSub} <strong>order-scanner-{sessionDate}.xlsx</strong> — {t.exportSub2}</p>
          </div>
          <button className={`btn btn-primary ${items.length === 0 ? 'btn-disabled' : ''}`} onClick={handleExport} disabled={items.length === 0}>
            {t.exportBtn}
          </button>
        </div>

        <div className="sheet-divider" />

        {/* IMPORT */}
        <div className="sheet-section">
          <div className="sheet-icon import-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <div className="sheet-text">
            <p className="sheet-label">{t.importLabel}</p>
            <p className="sheet-sub">{t.importSub}</p>
          </div>
          <button className="btn btn-secondary" onClick={() => importRef.current.click()} disabled={importing}>
            {importing ? t.importingBtn : t.importBtn}
          </button>
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
            onChange={(e) => handleImportFile(e.target.files[0])} />
        </div>
      </div>

      {importSuccess && <div className="sheet-feedback success">{importSuccess}</div>}
      {importError   && <div className="sheet-feedback error">⚠ {importError}</div>}

      <div className="sheet-howto">
        <p className="sheet-howto-title">{t.howToTitle}</p>
        <ol>
          <li>{t.howTo1} <strong>{t.howTo1b}</strong> {t.howTo1c} <strong>{t.howTo1d}</strong></li>
          <li>{t.howTo2} <strong>sheets.google.com</strong> {t.howTo2b}</li>
          <li>{t.howTo3}</li>
          <li>{t.howTo4} <strong>.xlsx</strong>{t.howTo4b}</li>
        </ol>
      </div>
    </div>
  );
}

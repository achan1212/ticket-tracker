import { useRef, useState } from 'react';
import { exportToXlsx, importFromXlsx } from '@utils/sheetIO';
import { useLang } from '../../i18n/LangContext.jsx';
import './SheetPanel.css';

export default function SheetPanel({ dailySummary, months, onImport }) {
  const importRef = useRef(null);
  const [importing, setImporting]     = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const { t } = useLang();

  const monthlyCount = Object.keys(months || {}).length;
  const isEmpty = dailySummary.length === 0 && monthlyCount === 0;

  const handleExport = () => {
    if (isEmpty) return;
    exportToXlsx(dailySummary, {}, months);
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    setImporting(true);
    setImportError('');
    setImportSuccess('');
    try {
      const { days, months: importedMonths } = await importFromXlsx(file);
      onImport({ days, months: importedMonths });
      const parts = [];
      if (days.length > 0) parts.push(`${days.length} ${days.length !== 1 ? t.daysPlural : t.days}`);
      if (importedMonths.length > 0) parts.push(`${importedMonths.length} ${importedMonths.length !== 1 ? t.monthsPlural : t.months}`);
      setImportSuccess(`✓ ${parts.join(' · ')} — ${file.name}`);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
      importRef.current.value = '';
    }
  };

  const dateSlug = new Date().toISOString().slice(0, 10);

  return (
    <div className="sheet-panel">
      <div className="sheet-panel-inner">

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
            <p className="sheet-sub">{t.exportSub} <strong>tracker-export-{dateSlug}.xlsx</strong> — {t.exportSub2}</p>
          </div>
          <button
            className={`btn btn-primary ${isEmpty ? 'btn-disabled' : ''}`}
            onClick={handleExport}
            disabled={isEmpty}
          >
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
          <input
            ref={importRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(e) => handleImportFile(e.target.files[0])}
          />
        </div>
      </div>

      {importSuccess && <div className="sheet-feedback success">{importSuccess}</div>}
      {importError   && <div className="sheet-feedback error">⚠ {importError}</div>}

      <div className="sheet-howto">
        <p className="sheet-howto-title">{t.howToTitle}</p>
        <ol>
          <li>{t.howTo1} <strong>{t.howTo1b}</strong></li>
          <li>{t.howTo2} <strong>sheets.google.com</strong> {t.howTo2b}</li>
          <li>{t.howTo3}</li>
          <li>{t.howTo4} <strong>.xlsx</strong>{t.howTo4b}</li>
        </ol>
      </div>
    </div>
  );
}

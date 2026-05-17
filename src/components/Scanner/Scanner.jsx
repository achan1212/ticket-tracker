import { useRef, useState } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';
import './Scanner.css';

export default function Scanner({ onScan, loading, progress, error, preview, chunkIndex, chunkCount, onManualEntry }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const { t } = useLang();

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    onScan(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="scanner-wrap">
      <div
        className={`drop-zone ${dragging ? 'dragging' : ''} ${loading ? 'scanning' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !loading && inputRef.current.click()}
      >
        <input ref={inputRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />

        {loading ? (
          <div className="scan-state">
            {preview && <img src={preview} alt="Scanning" className="preview-thumb" />}
            <div className="progress-wrap">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <p className="scan-label">
              {t.scanningLabel} — {progress}%
              {chunkCount > 1 && chunkIndex > 0 && ` · chunk ${chunkIndex}/${chunkCount}`}
            </p>
          </div>
        ) : preview ? (
          <div className="scan-state">
            <img src={preview} alt="Preview" className="preview-thumb" />
            <p className="scan-label muted">{t.scanningLabel}...</p>
          </div>
        ) : (
          <div className="drop-content">
            <div className="drop-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <p className="drop-title">{t.dropTitle}</p>
            <p className="drop-sub">{t.dropSub}</p>
            <p className="drop-note">{t.dropNote}</p>
          </div>
        )}
      </div>

      {error && <div className="error-banner"><span>⚠</span> {error}</div>}

      <div className="tips">
        <p className="tips-title">{t.tipsTitle}</p>
        <ul>
          <li>{t.tip1}</li>
          <li>{t.tip2}</li>
          <li>{t.tip3}</li>
        </ul>
      </div>

      <div className="manual-divider"><span>{t.orDivider}</span></div>

      <button className="btn-manual-entry" onClick={onManualEntry}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {t.manualEntryBtn}
      </button>
    </div>
  );
}

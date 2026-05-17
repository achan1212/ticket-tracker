import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrderScan } from '@hooks/useOrderScan';
import { useLocalStore } from '@hooks/useLocalStore';
import Scanner from '@components/Scanner/Scanner';
import ResultsTable from '@components/ResultsTable/ResultsTable';
import './ScannerTab.css';

export default function ScannerTab({ onUpsertDay, onUpsertMonth, days = {}, months = {} }) {
  const { scan, results, loading, progress, error, rawText, reset, chunkIndex, chunkCount, detectedDate } = useOrderScan();
  // Preview is a blob URL that can't survive a reload, so it stays ephemeral.
  const [preview, setPreview]       = useState(null);
  // Manual items + showResults persist so a user can review across sessions.
  const [manualItems, setManualItems] = useLocalStore('scanner-manual-items', { version: 1, initial: [] });
  const [showResults, setShowResults] = useLocalStore('scanner-show-results',  { version: 1, initial: false });
  const navigate = useNavigate();

  const handleScan = useCallback((file) => {
    setPreview(URL.createObjectURL(file));
    setShowResults(true);
    scan(file);
  }, [scan]);

  // Keep the Scanner (with its progress bar) on screen during OCR so the user
  // sees per-chunk progress instead of an empty ResultsTable.
  const showScannerView = !showResults || loading;

  const handleManualEntry = () => {
    navigate('/summary');
  };

  const handleReset = () => {
    reset();
    setPreview(null);
    setManualItems([]);
    setShowResults(false);
    // ResultsTable is about to unmount; its persisted state would otherwise
    // linger as orphan localStorage entries. Wipe them explicitly so the
    // next scan starts fully clean. (The orphan-prune effect inside
    // ResultsTable also covers this on the next mount, but doing it here
    // keeps localStorage tidy for users who never scan again.)
    try {
      localStorage.removeItem('ticket-tracker:scanner-edits');
      localStorage.removeItem('ticket-tracker:scanner-removed');
      localStorage.removeItem('ticket-tracker:scanner-order');
    } catch {}
  };

  const handleAddItem = (item) => {
    if (item.__removeManualIndex !== undefined) {
      setManualItems(prev => prev.filter((_, i) => i !== item.__removeManualIndex));
    } else {
      const uid = item._uid || `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      setManualItems(prev => [...prev, { ...item, _uid: uid }]);
    }
  };

  const handleUpdateManualItem = (index, next) => {
    setManualItems(prev => prev.map((item, i) => (i === index ? { ...next, _uid: item._uid } : item)));
  };

  if (showScannerView) {
    return (
      <Scanner
        onScan={handleScan}
        loading={loading}
        progress={progress}
        error={error}
        preview={preview}
        chunkIndex={chunkIndex}
        chunkCount={chunkCount}
        onManualEntry={handleManualEntry}
      />
    );
  }

  return (
    <ResultsTable
      scannedItems={results || []}
      manualItems={manualItems}
      onAddItem={handleAddItem}
      onUpdateManualItem={handleUpdateManualItem}
      onReset={handleReset}
      preview={preview}
      rawText={rawText}
      detectedDate={detectedDate}
      onUpsertDay={onUpsertDay}
      onUpsertMonth={onUpsertMonth}
      days={days}
      months={months}
    />
  );
}

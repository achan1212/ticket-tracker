import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrderScan } from '@hooks/useOrderScan';
import Scanner from '@components/Scanner/Scanner';
import ResultsTable from '@components/ResultsTable/ResultsTable';
import './ScannerTab.css';

export default function ScannerTab() {
  const { scan, results, loading, progress, error, rawText, reset, chunkIndex, chunkCount } = useOrderScan();
  const [preview, setPreview]       = useState(null);
  const [manualItems, setManualItems] = useState([]);
  const [showResults, setShowResults] = useState(false);
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
    />
  );
}

import { useState, useCallback } from 'react';
import { useOrderScan } from '@hooks/useOrderScan';
import Scanner from '@components/Scanner';
import ResultsTable from '@components/ResultsTable';

export default function ScannerTab() {
  const { scan, results, loading, progress, error, rawText, reset } = useOrderScan();
  const [preview, setPreview]       = useState(null);
  const [manualItems, setManualItems] = useState([]);
  const [showResults, setShowResults] = useState(false);

  const handleScan = useCallback((file) => {
    setPreview(URL.createObjectURL(file));
    setShowResults(true);
    scan(file);
  }, [scan]);

  const handleManualEntry = () => {
    setShowResults(true);
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
      setManualItems(prev => [...prev, item]);
    }
  };

  if (!showResults) {
    return (
      <Scanner
        onScan={handleScan}
        loading={loading}
        progress={progress}
        error={error}
        preview={preview}
        onManualEntry={handleManualEntry}
      />
    );
  }

  return (
    <ResultsTable
      scannedItems={results || []}
      manualItems={manualItems}
      onAddItem={handleAddItem}
      onReset={handleReset}
      preview={preview}
      rawText={rawText}
    />
  );
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LangProvider } from './i18n/LangContext.jsx';
import App from './App.jsx';

// Eagerly import every component's stylesheet so the global CSS bundle
// contains all selectors regardless of which lazy tab is mounted first.
// This avoids cross-tab class dependencies breaking when (for example)
// DeliveryAnalysis references .day-card from DailySummaryTable.css.
import './components/DailySummaryTable/DailySummaryTable.css';
import './components/MonthlySummaryTable/MonthlySummaryTable.css';
import './components/Dashboard/Dashboard.css';
import './components/CostAnalysis/CostAnalysis.css';
import './components/DeliveryAnalysis/DeliveryAnalysis.css';
import './components/SheetPanel/SheetPanel.css';
import './components/ResultsTable/ResultsTable.css';
import './components/Scanner/Scanner.css';
import './components/ScannerTab/ScannerTab.css';
import './components/PlatformBreakdown/PlatformBreakdown.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LangProvider>
        <App />
      </LangProvider>
    </BrowserRouter>
  </StrictMode>
);

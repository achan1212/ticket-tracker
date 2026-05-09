import { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOrderStore } from '@hooks/useOrderStore';
import { useMonthlyStore } from '@hooks/useMonthlyStore';
import { useTheme } from '@hooks/useTheme';
import { useLang } from './i18n/LangContext.jsx';
import '@styles/index.css';

const DailySummaryTable   = lazy(() => import('@components/DailySummaryTable/DailySummaryTable.jsx'));
const MonthlySummaryTable = lazy(() => import('@components/MonthlySummaryTable/MonthlySummaryTable.jsx'));
const Dashboard           = lazy(() => import('@components/Dashboard/Dashboard.jsx'));
const CostAnalysis        = lazy(() => import('@components/CostAnalysis/CostAnalysis'));
const DeliveryAnalysis    = lazy(() => import('@components/DeliveryAnalysis/DeliveryAnalysis'));
const SheetPanel          = lazy(() => import('@components/SheetPanel/SheetPanel'));
const ScannerTab          = lazy(() => import('@components/ScannerTab/ScannerTab'));

const TAB_KEYS = ['summary', 'monthly', 'dashboard', 'delivery', 'analysis', 'sheets', 'scanner'];

export default function App() {
  const { days, upsertDay, removeDay, dailySummary } = useOrderStore();
  const { months, upsertMonth, removeMonth } = useMonthlyStore();
  const { lang, setLang, LANGUAGES, t } = useLang();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const TABS = [
    { key: 'summary',   label: t.tabSummary,   icon: '📋' },
    { key: 'monthly',   label: t.tabMonthly,   icon: '📅' },
    { key: 'dashboard', label: t.tabDashboard,  icon: '📊' },
    { key: 'delivery',  label: t.tabDelivery,   icon: '🛵' },
    { key: 'analysis',  label: t.tabAnalysis,   icon: '💰' },
    { key: 'sheets',    label: t.tabSheets,     icon: '📄' },
    { key: 'scanner',   label: t.tabScanner,    icon: '📷' },
  ];

  const pathTab = location.pathname.replace(/^\//, '') || 'summary';
  const activeTab = TAB_KEYS.includes(pathTab) ? pathTab : 'summary';

  useEffect(() => {
    if (!TAB_KEYS.includes(pathTab)) navigate('/summary', { replace: true });
  }, [pathTab, navigate]);

  const [itemCosts, setItemCosts] = useState({});

  const allItems = dailySummary.map(d => ({
    name: `Day ${d.date}`,
    cost: d.revenue,
    quantity: 1,
  }));

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <span className="header-tag">{t.headerTag}</span>
          <h1>{t.headerTitle}</h1>
          <p className="header-sub">{t.headerSub}</p>
        </div>
        <div className="header-controls">
          <div className="theme-toggle">
            <button className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')} title="Dark mode" aria-label="Dark mode">🌙</button>
            <button className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')} title="Light mode" aria-label="Light mode">☀️</button>
          </div>
          <div className="lang-toggle">
            {LANGUAGES.map(l => (
              <button key={l.code} className={`lang-btn ${lang === l.code ? 'active' : ''}`}
                onClick={() => setLang(l.code)} title={l.name}>{l.label}</button>
            ))}
          </div>
        </div>
      </header>

      <div className="app-tab-bar">
        {TABS.map(tab => (
          <button key={tab.key} className={`app-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => navigate(`/${tab.key}`)}>
            <span className="app-tab-icon">{tab.icon}</span>
            <span className="app-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <main className="app-main app-main-tabs">
        <Suspense fallback={<div className="ca-empty">Loading…</div>}>
          {activeTab === 'summary' && (
            <DailySummaryTable
              dailySummary={dailySummary}
              days={days}
              onUpsertDay={upsertDay}
              onRemoveDay={removeDay}
            />
          )}
          {activeTab === 'monthly' && (
            <MonthlySummaryTable
              dailySummary={dailySummary}
              months={months}
              onUpsertMonth={upsertMonth}
              onRemoveMonth={removeMonth}
            />
          )}
          {activeTab === 'dashboard' && (
            <Dashboard dailySummary={dailySummary} days={days} months={months} />
          )}
          {activeTab === 'delivery' && (
            <DeliveryAnalysis days={days} dailySummary={dailySummary} onUpsertDay={upsertDay} />
          )}
          {activeTab === 'analysis' && (
            <CostAnalysis items={allItems} itemCosts={itemCosts} onItemCostsChange={setItemCosts} />
          )}
          {activeTab === 'scanner' && <ScannerTab />}
          {activeTab === 'sheets' && (
            <SheetPanel
              dailySummary={dailySummary}
              months={months}
              onImport={({ days, months: importedMonths }) => {
                days.forEach(d => upsertDay(d.date, d));
                importedMonths.forEach(m => upsertMonth(m.month, m));
              }}
            />
          )}
        </Suspense>
      </main>
    </div>
  );
}

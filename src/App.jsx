import { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const ScannerTab = lazy(() => import('@components/ScannerTab'));
import { useOrderStore } from '@hooks/useOrderStore';
import { useMonthlyStore } from '@hooks/useMonthlyStore';
import { useLang } from './i18n/LangContext.jsx';
import DailySummaryTable from '@components/DailySummaryTable.jsx';
import MonthlySummaryTable from '@components/MonthlySummaryTable.jsx';
import Dashboard from '@components/Dashboard.jsx';
import CostAnalysis from '@components/CostAnalysis';
import DeliveryAnalysis from '@components/DeliveryAnalysis';
import SheetPanel from '@components/SheetPanel';
import '@styles/index.css';

const TAB_KEYS = ['summary', 'monthly', 'dashboard', 'delivery', 'analysis', 'sheets', 'scanner'];

export default function App() {
  const { days, upsertDay, removeDay, importDays, dailySummary } = useOrderStore();
  const { months, upsertMonth, removeMonth } = useMonthlyStore();
  const { lang, setLang, LANGUAGES, t } = useLang();
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
  const [deliveryRates, setDeliveryRates] = useState({});

  const allItems = dailySummary.map(d => ({
    name: `Day ${d.date}`,
    cost: d.revenue,
    quantity: 1,
  }));

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <span className="header-tag">FREE · NO API KEY</span>
          <h1>Order<br />Scanner</h1>
          <p className="header-sub">Track daily sales, compare delivery vs pickup, and analyze platform fees.</p>
        </div>
        <div className="lang-toggle">
          {LANGUAGES.map(l => (
            <button key={l.code} className={`lang-btn ${lang === l.code ? 'active' : ''}`}
              onClick={() => setLang(l.code)} title={l.name}>{l.label}</button>
          ))}
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
        {activeTab === 'scanner' && (
          <Suspense fallback={<div className="ca-empty">Loading scanner…</div>}>
            <ScannerTab />
          </Suspense>
        )}
        {activeTab === 'sheets' && (
          <SheetPanel
            items={dailySummary.map(d => ({ name: d.date, cost: d.revenue, quantity: 1, addedAt: d.date }))}
            itemCosts={itemCosts}
            deliveryRates={deliveryRates}
            orderCount={dailySummary.reduce((s, d) => s + d.orderCount, 0)}
            onImport={(imported) => imported.forEach(i => upsertDay(i.date || i.name, i))}
          />
        )}
      </main>
    </div>
  );
}

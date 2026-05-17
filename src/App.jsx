import { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOrderStore } from '@hooks/useOrderStore';
import { useMonthlyStore } from '@hooks/useMonthlyStore';
import { useFoodCostStore } from '@hooks/useFoodCostStore';
import { useTheme } from '@hooks/useTheme';
import { useLang } from './i18n/LangContext.jsx';
import Navbar from '@components/Navbar/Navbar.jsx';
import Hamburger from '@components/Navbar/Hamburger.jsx';
import MobileDrawer from '@components/Navbar/MobileDrawer.jsx';
import { getAllTabKeys, getPathForTab, getTabFromPath } from '@components/Navbar/navConfig.js';
import '@styles/index.css';

const DailySummaryTable   = lazy(() => import('@components/DailySummaryTable/DailySummaryTable.jsx'));
const MonthlySummaryTable = lazy(() => import('@components/MonthlySummaryTable/MonthlySummaryTable.jsx'));
const Dashboard           = lazy(() => import('@components/Dashboard/Dashboard.jsx'));
const CostAnalysis        = lazy(() => import('@components/CostAnalysis/CostAnalysis'));
const DeliveryAnalysis    = lazy(() => import('@components/DeliveryAnalysis/DeliveryAnalysis'));
const SheetPanel          = lazy(() => import('@components/SheetPanel/SheetPanel'));
const ScannerTab          = lazy(() => import('@components/ScannerTab/ScannerTab'));
const FoodCostTab         = lazy(() => import('@components/FoodCostTab/FoodCostTab.jsx'));

const TAB_KEYS = getAllTabKeys();

export default function App() {
  const { days, upsertDay, removeDay, dailySummary } = useOrderStore();
  const { months, upsertMonth, removeMonth } = useMonthlyStore();
  const { foodCostByDay, foodCostByMonth } = useFoodCostStore();
  const { lang, setLang, LANGUAGES, t } = useLang();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const resolvedTab = getTabFromPath(location.pathname);
  const activeTab = resolvedTab && TAB_KEYS.includes(resolvedTab) ? resolvedTab : 'summary';

  // Redirect any non-canonical URL (legacy flat /summary, bare group /data,
  // unknown /foo, or root /) to the breadcrumbed form for the active tab.
  useEffect(() => {
    const canonical = getPathForTab(activeTab);
    if (canonical && location.pathname !== canonical) {
      navigate(canonical, { replace: true });
    }
  }, [location.pathname, activeTab, navigate]);

  // Close the mobile drawer whenever the active tab changes.
  useEffect(() => { setDrawerOpen(false); }, [activeTab]);

  const handleNavigate = (tabKey) => {
    const path = getPathForTab(tabKey);
    if (path) navigate(path);
  };

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
          <Hamburger
            open={drawerOpen}
            onClick={() => setDrawerOpen(o => !o)}
            label={t.menuLabel || 'Menu'}
          />
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

      <Navbar activeTab={activeTab} onNavigate={handleNavigate} />
      <MobileDrawer
        open={drawerOpen}
        activeTab={activeTab}
        onClose={() => setDrawerOpen(false)}
        onNavigate={handleNavigate}
      />

      <main className="app-main app-main-tabs">
        <Suspense fallback={<div className="ca-empty">Loading…</div>}>
          {activeTab === 'summary' && (
            <DailySummaryTable
              dailySummary={dailySummary}
              days={days}
              onUpsertDay={upsertDay}
              onRemoveDay={removeDay}
              foodCostByDay={foodCostByDay}
            />
          )}
          {activeTab === 'monthly' && (
            <MonthlySummaryTable
              dailySummary={dailySummary}
              months={months}
              onUpsertMonth={upsertMonth}
              onRemoveMonth={removeMonth}
              foodCostByMonth={foodCostByMonth}
            />
          )}
          {activeTab === 'dashboard' && (
            <Dashboard dailySummary={dailySummary} days={days} months={months} />
          )}
          {activeTab === 'delivery' && (
            <DeliveryAnalysis
              days={days}
              months={months}
              dailySummary={dailySummary}
              onUpsertDay={upsertDay}
              onUpsertMonth={upsertMonth}
              foodCostByDay={foodCostByDay}
            />
          )}
          {activeTab === 'analysis' && (
            <CostAnalysis items={allItems} itemCosts={itemCosts} onItemCostsChange={setItemCosts} />
          )}
          {activeTab === 'scanner' && (
            <ScannerTab
              onUpsertDay={upsertDay}
              onUpsertMonth={upsertMonth}
              days={days}
              months={months}
            />
          )}
          {activeTab === 'foodcost' && <FoodCostTab />}
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

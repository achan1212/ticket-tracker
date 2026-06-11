import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOrderStore } from '@hooks/useOrderStore';
import { useMonthlyStore } from '@hooks/useMonthlyStore';
import { useFoodCostStore } from '@hooks/useFoodCostStore';
import { useOperatingCostsStore } from '@hooks/useOperatingCostsStore';
import { useLocalStore } from '@hooks/useLocalStore';
import { useRecipeStore } from '@hooks/useRecipeStore';
import { useInventoryStore } from '@hooks/useInventoryStore';
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
const MenuAnalytics       = lazy(() => import('@components/MenuAnalytics/MenuAnalytics.jsx'));
const ProfitLossTab       = lazy(() => import('@components/ProfitLossTab/ProfitLossTab.jsx'));
const OperatingCostsTab   = lazy(() => import('@components/OperatingCostsTab/OperatingCostsTab.jsx'));
const RecipeTab           = lazy(() => import('@components/RecipeTab/RecipeTab.jsx'));
const InventoryTab        = lazy(() => import('@components/InventoryTab/InventoryTab.jsx'));

const TAB_KEYS = getAllTabKeys();

export default function App() {
  const { days, upsertDay, removeDay, clearAll: clearAllDays, dailySummary } = useOrderStore();
  const { months, upsertMonth, removeMonth, clearAll: clearAllMonths } = useMonthlyStore();
  const { groups: foodCostGroups, foodCostByDay, foodCostByMonth, upsertGroup: upsertFoodCostGroup, clearAll: clearAllFoodCost } = useFoodCostStore();
  const opCosts = useOperatingCostsStore();
  const recipes = useRecipeStore();
  const inventory = useInventoryStore();

  // Ingredient names + per-unit costs derived from food cost imports.
  // Used by RecipeTab to suggest unit costs when the user types an ingredient name.
  const ingredientSuggestions = useMemo(() => {
    const map = new Map();
    for (const g of foodCostGroups) {
      if (g.status !== 'done') continue;
      for (const item of g.items) {
        const qty = Math.max(item.quantity, 1);
        const unitCost = item.cost / qty;
        const key = item.name.trim().toLowerCase();
        if (!map.has(key)) map.set(key, { name: item.name.trim(), unitCost });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [foodCostGroups]);

  // Every DATA key the danger-zone wipe must cover. Preference keys
  // (dashboard-colors — like theme/language) intentionally survive clear-all.
  const CLEAR_ALL_EXTRA_KEYS = [
    'pl-targets',
    'item-costs',
    'menu-item-costs',
    'scanner-results',
    'scanner-manual-items',
    'scanner-edits',
    'scanner-removed',
    'scanner-order',
    'scanner-rawtext',
    'scanner-file-name',
    'scanner-detected-date',
    'scanner-show-results',
  ];

  const handleClearAllData = () => {
    clearAllDays();
    clearAllMonths();
    clearAllFoodCost();
    opCosts.clearAll();
    recipes.clearAll();
    inventory.clearAll();
    // item-costs lives in an App-level useLocalStore, so just removing the key
    // isn't enough — the store's beforeunload flush would write the in-memory
    // copy straight back. Reset the state so the flush writes an empty map.
    setItemCosts({});
    try {
      CLEAR_ALL_EXTRA_KEYS.forEach(k => localStorage.removeItem(`ticket-tracker:${k}`));
    } catch { /* quota / private browsing */ }
    // Reload so every component re-reads from a clean localStorage. The stores
    // above already cleared their in-memory state, but child components like
    // ProfitLossTab read their own slice via useLocalStore and would otherwise
    // keep stale in-memory copies until next reload.
    setTimeout(() => window.location.reload(), 50);
  };
  const { lang, setLang, LANGUAGES, t } = useLang();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    const handler = () => setStorageWarning(true);
    window.addEventListener('tt:storage-error', handler);
    return () => window.removeEventListener('tt:storage-error', handler);
  }, []);

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

  const [itemCosts, setItemCosts] = useLocalStore('item-costs', { version: 2, initial: {} });

  const allItems = dailySummary.map(d => ({
    key: d.date,
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

      {storageWarning && (
        <div className="storage-warning-banner" role="alert">
          <span>{t.storageWarning}</span>
          <button
            className="storage-warning-dismiss"
            onClick={() => setStorageWarning(false)}
            aria-label={t.storageWarningDismiss}
          >×</button>
        </div>
      )}

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
              onUpsertFoodCostGroup={upsertFoodCostGroup}
              onSetLaborForMonth={opCosts.setLaborForMonth}
              onSetFixedForMonth={opCosts.setFixedForMonth}
              onUpsertRecipes={recipes.upsertRecipes}
              onUpsertInventory={inventory.upsertDemo}
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
            <Dashboard
              dailySummary={dailySummary}
              days={days}
              months={months}
              foodCostByDay={foodCostByDay}
              foodCostByMonth={foodCostByMonth}
              laborByMonth={opCosts.laborByMonth}
              fixedByMonth={opCosts.fixedByMonth}
            />
          )}
          {activeTab === 'pl' && (
            <ProfitLossTab
              dailySummary={dailySummary}
              months={months}
              foodCostByMonth={foodCostByMonth}
              laborByMonth={opCosts.laborByMonth}
              fixedByMonth={opCosts.fixedByMonth}
            />
          )}
          {activeTab === 'opcosts' && (
            <OperatingCostsTab
              data={opCosts.data}
              laborByMonth={opCosts.laborByMonth}
              fixedByMonth={opCosts.fixedByMonth}
              setLaborForMonth={opCosts.setLaborForMonth}
              addFixedCost={opCosts.addFixedCost}
              updateFixedCost={opCosts.updateFixedCost}
              removeFixedCost={opCosts.removeFixedCost}
            />
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
          {activeTab === 'menu' && (
            <MenuAnalytics
              days={days}
              months={months}
              dailySummary={dailySummary}
              foodCostByDay={foodCostByDay}
            />
          )}
          {activeTab === 'recipes' && (
            <RecipeTab
              recipes={recipes.recipes}
              addRecipe={recipes.addRecipe}
              updateRecipe={recipes.updateRecipe}
              removeRecipe={recipes.removeRecipe}
              addIngredient={recipes.addIngredient}
              updateIngredient={recipes.updateIngredient}
              removeIngredient={recipes.removeIngredient}
              ingredientSuggestions={ingredientSuggestions}
            />
          )}
          {activeTab === 'inventory' && (
            <InventoryTab
              inventory={inventory}
              foodCostGroups={foodCostGroups}
            />
          )}
          {activeTab === 'scanner' && (
            <ScannerTab
              onUpsertDay={upsertDay}
              onUpsertMonth={upsertMonth}
              days={days}
              months={months}
            />
          )}
          {activeTab === 'foodcost' && (
            <FoodCostTab
              onUpsertMonth={upsertMonth}
              months={months}
            />
          )}
          {activeTab === 'sheets' && (
            <SheetPanel
              dailySummary={dailySummary}
              months={months}
              foodCostByDay={foodCostByDay}
              foodCostByMonth={foodCostByMonth}
              foodCostGroups={foodCostGroups}
              onImport={({ days, months: importedMonths }) => {
                days.forEach(d => upsertDay(d.date, d));
                importedMonths.forEach(m => upsertMonth(m.month, m));
              }}
              onClearAll={handleClearAllData}
            />
          )}
        </Suspense>
      </main>
    </div>
  );
}

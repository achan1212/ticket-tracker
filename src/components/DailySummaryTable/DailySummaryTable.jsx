import { useState } from 'react';
import PlatformBreakdown from '@components/PlatformBreakdown/PlatformBreakdown';
import RevenueForm from '@components/RevenueForm/RevenueForm.jsx';
import { useLang } from '../../i18n/LangContext.jsx';
import { generateDemoDays, generateDemoFoodCostGroups, generateDemoLabor, generateDemoFixedCosts } from '@utils/demoData';
import './DailySummaryTable.css';

function formatDate(iso) {
  const [year, month, day] = iso.split('-');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function DailySummaryTable({ dailySummary, days, onUpsertDay, onRemoveDay, onUpsertFoodCostGroup, onSetLaborForMonth, onSetFixedForMonth, foodCostByDay = {} }) {
  const { t, formatCurrency } = useLang();
  const [editingDate, setEditingDate] = useState(null);
  const [addingDate, setAddingDate]   = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterType, setFilterType]   = useState('all');

  const handleLoadDemo = () => {
    const confirmed = window.confirm(t.loadDemoConfirm || 'Load 90 days of demo data? This will be added to your records.');
    if (!confirmed) return;
    const demoData = generateDemoDays();
    demoData.forEach(day => onUpsertDay(day.date, day));
    if (onUpsertFoodCostGroup) {
      const demoFoodCost = generateDemoFoodCostGroups();
      demoFoodCost.forEach(group => onUpsertFoodCostGroup(group));
    }
    if (onSetLaborForMonth) {
      const demoLabor = generateDemoLabor(demoData);
      Object.entries(demoLabor).forEach(([month, amount]) => onSetLaborForMonth(month, amount));
    }
    if (onSetFixedForMonth) {
      const demoFixed = generateDemoFixedCosts(demoData);
      Object.entries(demoFixed).forEach(([month, items]) => onSetFixedForMonth(month, items));
    }
    alert(t.loadDemoSuccess || 'Demo data loaded!');
  };

  const handleAddSave = (data) => {
    if (!addingDate) return;
    onUpsertDay(addingDate, data);
    setShowAddForm(false);
    setAddingDate('');
  };

  const handleEditSave = (date, data) => {
    onUpsertDay(date, data);
    setEditingDate(null);
  };

  const filtered = dailySummary.filter(d => {
    if (filterType === 'delivery') return (d.deliveryOrders || 0) > 0;
    if (filterType === 'pickup')   return (d.pickupOrders   || 0) > 0;
    return true;
  });

  return (
    <div className="daily-summary">
      <h2 className="page-title">{t.tabSummary}</h2>

      <div className="ds-controls">
        <div className="ds-filter-pills">
          {[
            { key: 'all',      label: t.filterAll },
            { key: 'delivery', label: t.labelDelivery },
            { key: 'pickup',   label: t.labelPickup },
          ].map(f => (
            <button key={f.key} className={`filter-pill ${filterType === f.key ? 'active' : ''}`}
              onClick={() => setFilterType(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        <button className="btn btn-primary btn-sm"
          onClick={() => { setAddingDate(todayISO()); setShowAddForm(true); }}>
          {t.addDayBtn}
        </button>
      </div>

      {showAddForm && (
        <div className="day-card">
          <div className="day-card-header" style={{ cursor: 'default' }}>
            <div className="day-date-col">
              <span className="day-date">{t.newDayEntryLabel}</span>
            </div>
            <input type="date" className="form-input date-input"
              value={addingDate} max={todayISO()}
              onChange={e => setAddingDate(e.target.value)}
              onClick={e => e.currentTarget.showPicker?.()} />
          </div>
          <RevenueForm
            initial={{ deliveryRevenue: '', pickupRevenue: '', deliveryOrders: '', pickupOrders: '', categories: {}, notes: '' }}
            onSave={handleAddSave}
            onCancel={() => { setShowAddForm(false); setAddingDate(''); }}
            notesPlaceholder={t.formNotesPlaceholderDay}
            saveLabel={t.saveDayBtn}
          />
        </div>
      )}

      {!showAddForm && filtered.length === 0 && (
        <div className="ds-empty">
          <p>{t.emptyDailyPre} <strong>{t.addDayBtn}</strong> {t.emptyDailySuffix}</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary"
              onClick={() => { setAddingDate(todayISO()); setShowAddForm(true); }}>
              {t.addTodayBtn}
            </button>
            <button className="btn btn-secondary"
              onClick={handleLoadDemo}>
              {t.loadDemoBtn || 'Load Demo Data'}
            </button>
          </div>
        </div>
      )}

      {filtered.map(day => (
        <div key={day.date} className="day-card">
          <div className="day-card-header"
            onClick={() => setEditingDate(editingDate === day.date ? null : day.date)}>
            <div className="day-date-col">
              <span className="day-date">{formatDate(day.date)}</span>
              <div className="day-type-pills">
                {day.deliveryRevenue > 0 && <span className="type-pill delivery">{t.labelDelivery} {formatCurrency(day.deliveryRevenue)}</span>}
                {day.pickupRevenue   > 0 && <span className="type-pill pickup">{t.labelPickup} {formatCurrency(day.pickupRevenue)}</span>}
                {day.revenue > 0 && day.revenue !== day.deliveryRevenue && day.revenue !== day.pickupRevenue && (
                  <span className="type-pill total">{t.total || 'Total'} {formatCurrency(day.revenue)}</span>
                )}
                {day.notes && <span className="type-pill notes-pill">📝 {day.notes}</span>}
                {days[day.date]?.categories && Object.keys(days[day.date].categories).length > 0 && (
                  <span className="type-pill category-pill">💰 {Object.keys(days[day.date].categories).length} {t.categoriesBadge}</span>
                )}
                {day.source === 'imported' && (
                  <span className="source-badge imported">{t.importedBadge}</span>
                )}
                {day.source && day.source !== 'imported' && (
                  <span className="source-badge manual">{t.manualBadge}</span>
                )}
              </div>
            </div>
            <div className="day-stats">
              <div className="day-stat">
                <span className="day-stat-label">{t.labelRevenue}</span>
                <span className="day-stat-value">{formatCurrency(day.revenue)}</span>
              </div>
              <div className="day-stat">
                <span className="day-stat-label">{t.labelOrders}</span>
                <span className="day-stat-value">{day.orderCount}</span>
              </div>
              <div className="day-stat">
                <span className="day-stat-label">{t.labelAvg}</span>
                <span className="day-stat-value">{day.orderCount > 0 ? formatCurrency(day.avgOrderValue) : '—'}</span>
              </div>
              {(() => {
                const fc = foodCostByDay[day.date] ?? days[day.date]?.foodCost;
                if (!fc) return null;
                const pct = day.revenue > 0 ? (fc / day.revenue) * 100 : null;
                // Industry benchmark: 28–32 % is healthy for full-service casual.
                const tone = pct == null ? '' : pct > 35 ? ' fc-high' : pct < 25 ? ' fc-low' : '';
                return (
                  <div className={`day-stat day-stat-fc${tone}`} title={`${t.foodCostStatTitle || 'Food cost'}: ${formatCurrency(fc)}`}>
                    <span className="day-stat-label">{t.foodCostStatLabel || 'Food %'}</span>
                    <span className="day-stat-value">{pct == null ? formatCurrency(fc) : `${pct.toFixed(1)}%`}</span>
                  </div>
                );
              })()}
            </div>
            <div className="day-actions">
              <button className="btn btn-ghost btn-sm"
                onClick={e => { e.stopPropagation(); setEditingDate(day.date); }}>{t.editBtn}</button>
              <button className="btn-remove" title={t.deleteDay} aria-label={t.deleteDay}
                onClick={e => { e.stopPropagation(); onRemoveDay(day.date); }}>×</button>
            </div>
          </div>

          {editingDate === day.date && (
            <RevenueForm
              initial={days[day.date]}
              onSave={(data) => handleEditSave(day.date, data)}
              onCancel={() => setEditingDate(null)}
              notesPlaceholder={t.formNotesPlaceholderDay}
              saveLabel={t.saveDayBtn}
            />
          )}

          {editingDate !== day.date && (
            <div style={{ padding: '0 1.5rem' }}>
              <PlatformBreakdown record={days[day.date]} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

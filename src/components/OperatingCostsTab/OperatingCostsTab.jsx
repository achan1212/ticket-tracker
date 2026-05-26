import { useEffect, useMemo, useState } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';
import Dropdown from '@components/ui/Dropdown.jsx';
import './OperatingCostsTab.css';

const FIXED_CATEGORIES = [
  'Rent', 'Utilities', 'Insurance', 'Internet', 'Phone',
  'Software', 'Marketing', 'Equipment', 'Repairs',
  'Licenses', 'Bookkeeping', 'Other',
];

function currentMonthISO() {
  return new Date().toISOString().slice(0, 7);
}

function formatMonthYear(ym) {
  const [year, month] = ym.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function OperatingCostsTab({
  data,
  laborByMonth,
  fixedByMonth,
  setLaborForMonth,
  addFixedCost,
  updateFixedCost,
  removeFixedCost,
}) {
  const { t, formatCurrency } = useLang();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthISO);
  const [laborInput, setLaborInput]       = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftAmount, setDraftAmount]     = useState('');
  const [draftNotes, setDraftNotes]       = useState('');

  const today = currentMonthISO();
  const canGoNext = selectedMonth < today;

  // Months that have any data, plus the current month, plus the selected month.
  const monthOptions = useMemo(() => {
    const keys = new Set([
      today,
      selectedMonth,
      ...Object.keys(data.labor || {}),
      ...Object.keys(data.fixed || {}),
    ]);
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [data, selectedMonth, today]);

  const laborForMonth   = laborByMonth[selectedMonth] || 0;
  const fixedItems      = (data.fixed || {})[selectedMonth] || [];
  const fixedTotal      = fixedByMonth[selectedMonth] || 0;
  const total           = laborForMonth + fixedTotal;

  useEffect(() => {
    setLaborInput(laborByMonth[selectedMonth] != null ? String(laborByMonth[selectedMonth]) : '');
  }, [selectedMonth, laborByMonth]);

  const commitLabor = () => {
    setLaborForMonth(selectedMonth, parseFloat(laborInput) || 0);
  };

  const handleAddFixed = () => {
    const amt = parseFloat(draftAmount);
    if (!draftCategory.trim() || !(amt > 0)) return;
    addFixedCost(selectedMonth, {
      category: draftCategory.trim(),
      amount: Math.round(amt * 100) / 100,
      notes: draftNotes.trim(),
    });
    setDraftCategory('');
    setDraftAmount('');
    setDraftNotes('');
  };

  return (
    <div className="oc-tab">
      <h2 className="page-title">{t.opCostsTitle || 'Operating Costs'}</h2>
      <p className="oc-sub">{t.opCostsSub || 'Track actual labor and fixed costs by month. Used by the P&L and Dashboard when present.'}</p>

      {/* ── MONTH NAVIGATION ── */}
      <div className="oc-month-nav">
        <button
          className="btn btn-ghost btn-sm oc-nav-btn"
          title={t.plPrevMonth || 'Previous month'}
          aria-label={t.plPrevMonth || 'Previous month'}
          onClick={() => setSelectedMonth(m => shiftMonth(m, -1))}
        >←</button>

        <Dropdown
          className="oc-month-dd"
          value={selectedMonth}
          onChange={setSelectedMonth}
          options={monthOptions.map(m => ({ value: m, label: formatMonthYear(m) }))}
          ariaLabel={t.opCostsMonthPicker || 'Select month'}
        />

        <button
          className="btn btn-ghost btn-sm oc-nav-btn"
          title={t.plNextMonth || 'Next month'}
          aria-label={t.plNextMonth || 'Next month'}
          disabled={!canGoNext}
          onClick={() => canGoNext && setSelectedMonth(m => shiftMonth(m, 1))}
        >→</button>
      </div>

      {/* ── LABOR ── */}
      <section className="oc-section">
        <h3 className="oc-section-title">{t.opCostsLaborSection || 'Labor'}</h3>
        <p className="oc-section-hint">{t.opCostsLaborHint || 'Total monthly labor (wages, taxes, benefits).'}</p>
        <div className="oc-labor-row">
          <div className="target-input-wrap oc-labor-input-wrap">
            <span className="target-prefix">$</span>
            <input
              className="form-input form-input-sm"
              type="number" min="0" step="0.01"
              placeholder="0.00"
              value={laborInput}
              onChange={e => setLaborInput(e.target.value)}
              onBlur={commitLabor}
              onKeyDown={e => e.key === 'Enter' && commitLabor()}
            />
          </div>
          <span className="oc-labor-month">{formatMonthYear(selectedMonth)}</span>
        </div>
      </section>

      {/* ── FIXED COSTS ── */}
      <section className="oc-section">
        <h3 className="oc-section-title">{t.opCostsFixedSection || 'Fixed Costs'}</h3>
        <p className="oc-section-hint">{t.opCostsFixedHint || 'Add one line per recurring expense (rent, utilities, insurance, etc.).'}</p>

        <div className="oc-fixed-add">
          <input
            className="form-input"
            list="oc-fixed-categories"
            placeholder={t.opCostsCategoryPlaceholder || 'Category'}
            value={draftCategory}
            onChange={e => setDraftCategory(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddFixed()}
          />
          <datalist id="oc-fixed-categories">
            {FIXED_CATEGORIES.map(c => <option key={c} value={c} />)}
          </datalist>
          <div className="target-input-wrap oc-fixed-amount-wrap">
            <span className="target-prefix">$</span>
            <input
              className="form-input form-input-sm"
              type="number" min="0" step="0.01"
              placeholder="0.00"
              value={draftAmount}
              onChange={e => setDraftAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddFixed()}
            />
          </div>
          <input
            className="form-input oc-fixed-notes"
            placeholder={t.opCostsNotesPlaceholder || 'Notes (optional)'}
            value={draftNotes}
            onChange={e => setDraftNotes(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddFixed()}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleAddFixed}
            disabled={!draftCategory.trim() || !(parseFloat(draftAmount) > 0)}
          >
            {t.opCostsAddBtn || 'Add'}
          </button>
        </div>

        {fixedItems.length === 0 ? (
          <div className="oc-empty">{t.opCostsNoFixed || 'No fixed costs entered for this month yet.'}</div>
        ) : (
          <ul className="oc-fixed-list">
            {fixedItems.map(item => (
              <li key={item.id} className="oc-fixed-item">
                <span className="oc-fixed-category">{item.category}</span>
                <span className="oc-fixed-amount">{formatCurrency(item.amount)}</span>
                <span className="oc-fixed-notes-cell">{item.notes || '—'}</span>
                <button
                  type="button"
                  className="btn-remove"
                  title={t.opCostsRemoveTitle || 'Remove'}
                  aria-label={t.opCostsRemoveTitle || 'Remove'}
                  onClick={() => removeFixedCost(selectedMonth, item.id)}
                >×</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── TOTALS ── */}
      <div className="oc-totals">
        <div className="oc-total-row">
          <span>{t.opCostsTotalLabor || 'Total Labor'}</span>
          <strong>{formatCurrency(laborForMonth)}</strong>
        </div>
        <div className="oc-total-row">
          <span>{t.opCostsTotalFixed || 'Total Fixed Costs'}</span>
          <strong>{formatCurrency(fixedTotal)}</strong>
        </div>
        <div className="oc-total-row oc-total-grand">
          <span>{t.opCostsTotal || 'Total Operating Costs'}</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
      </div>
    </div>
  );
}

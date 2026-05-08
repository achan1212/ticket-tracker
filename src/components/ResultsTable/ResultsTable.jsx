import { useState } from 'react';
import { exportToCSV, calcTotal, formatCurrency } from '@utils/helpers';
import { useLang } from '../../i18n/LangContext.jsx';
import CostAnalysis from '@components/CostAnalysis/CostAnalysis';
import './ResultsTable.css';

const emptyForm = { name: '', cost: '', quantity: '1' };

export default function ResultsTable({ scannedItems, manualItems, onAddItem, onReset, preview, rawText }) {
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState('summary');
  const [showRaw, setShowRaw] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [removedScanned, setRemovedScanned] = useState([]);
  const [itemCosts, setItemCosts] = useState({});

  const visibleScanned = scannedItems.filter((_, i) => !removedScanned.includes(i));
  const allItems = [...visibleScanned, ...manualItems];
  const total = calcTotal(allItems);

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFormError('');
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return setFormError(t.errorName);
    const cost = parseFloat(form.cost);
    const quantity = parseInt(form.quantity, 10);
    if (isNaN(cost) || cost < 0) return setFormError(t.errorCost);
    if (isNaN(quantity) || quantity < 1) return setFormError(t.errorQty);
    onAddItem({ name: form.name.trim(), cost, quantity, addedAt: new Date().toISOString(), source: 'manual' });
    setForm(emptyForm);
    setFormError('');
    setShowForm(false);
  };

  const tabs = [
    { key: 'summary',  label: t.tabSummary,  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg> },
    { key: 'analysis', label: t.tabAnalysis, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  ];

  return (
    <div className="results-wrap">
      <div className="results-header">
        <div className="results-meta">
          <h2>{t.tabSummary.split('订')[0] ? 'Order Scanner' : '订单扫描仪'}</h2>
          <span className="item-count">{allItems.length} {allItems.length !== 1 ? t.itemsPlural : t.items}</span>
        </div>
        <div className="results-actions">
          {rawText && activeTab === 'summary' && (
            <button className="btn btn-ghost" onClick={() => setShowRaw(!showRaw)}>
              {showRaw ? t.hideRawOCR : t.viewRawOCR}
            </button>
          )}
          {activeTab === 'summary' && (
            <button className="btn btn-secondary" onClick={() => exportToCSV(allItems)}>{t.exportCSV}</button>
          )}
          <button className="btn btn-primary" onClick={onReset}>{t.startOver}</button>
        </div>
      </div>

      <div className="tab-bar">
        {tabs.map(tab => (
          <button key={tab.key} className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <>
          {showRaw && rawText && (
            <div className="raw-text"><p className="raw-label">{t.rawOCRLabel}</p><pre>{rawText}</pre></div>
          )}
          <div className="results-body">
            {preview && (
              <div className="preview-panel">
                <p className="preview-label">{t.badgeScanned}</p>
                <img src={preview} alt="Scanned ticket" className="preview-full" />
              </div>
            )}
            <div className="table-panel">
              <table className="order-table">
                <thead>
                  <tr><th>{t.colItem}</th><th>{t.colUnitCost}</th><th>{t.colQty}</th><th>{t.colSubtotal}</th><th></th></tr>
                </thead>
                <tbody>
                  {visibleScanned.map((item, i) => (
                    <tr key={`scanned-${i}`} style={{ animationDelay: `${i * 0.04}s` }}>
                      <td className="item-name">{item.name}<span className="item-source-badge">{t.badgeScanned}</span></td>
                      <td className="item-cost">{formatCurrency(item.cost)}</td>
                      <td className="item-qty"><span className="qty-badge">{item.quantity}×</span></td>
                      <td className="item-subtotal">{formatCurrency(item.cost * item.quantity)}</td>
                      <td className="item-actions">
                        <button className="btn-remove" title="Remove"
                          onClick={() => setRemovedScanned(prev => [...prev, scannedItems.indexOf(item)])}>×</button>
                      </td>
                    </tr>
                  ))}
                  {manualItems.map((item, i) => (
                    <tr key={`manual-${i}`} style={{ animationDelay: `${(visibleScanned.length + i) * 0.04}s` }} className="manual-row">
                      <td className="item-name">{item.name}<span className="item-source-badge manual">{t.badgeManual}</span></td>
                      <td className="item-cost">{formatCurrency(item.cost)}</td>
                      <td className="item-qty"><span className="qty-badge">{item.quantity}×</span></td>
                      <td className="item-subtotal">{formatCurrency(item.cost * item.quantity)}</td>
                      <td className="item-actions">
                        <button className="btn-remove" title="Remove"
                          onClick={() => onAddItem({ __removeManualIndex: i })}>×</button>
                      </td>
                    </tr>
                  ))}
                  {allItems.length === 0 && (
                    <tr><td colSpan="5" className="empty-row">{t.noItems}</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="total-row"><td colSpan="4">{t.total}</td><td>{formatCurrency(total)}</td></tr>
                </tfoot>
              </table>

              <div className="add-item-section">
                {!showForm ? (
                  <button className="btn-add-item" onClick={() => setShowForm(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    {t.addItemBtn}
                  </button>
                ) : (
                  <div className="add-item-form">
                    <p className="form-title">{t.addItemTitle}</p>
                    <div className="form-fields">
                      <input className="form-input" name="name" placeholder={t.itemNamePlaceholder} value={form.name} onChange={handleFormChange} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
                      <input className="form-input form-input-sm" name="cost" placeholder={t.costPlaceholder} value={form.cost} onChange={handleFormChange} type="number" min="0" step="0.01" onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
                      <input className="form-input form-input-sm" name="quantity" placeholder={t.qtyPlaceholder} value={form.quantity} onChange={handleFormChange} type="number" min="1" onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
                    </div>
                    {formError && <p className="form-error">{formError}</p>}
                    <div className="form-actions">
                      <button className="btn btn-ghost" onClick={() => { setShowForm(false); setForm(emptyForm); setFormError(''); }}>{t.cancelBtn}</button>
                      <button className="btn btn-primary" onClick={handleSubmit}>{t.addBtn}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'analysis' && (
        <CostAnalysis items={allItems} itemCosts={itemCosts} onItemCostsChange={setItemCosts} />
      )}
    </div>
  );
}

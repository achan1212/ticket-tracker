import { useRef, useState } from 'react';
import { formatCurrency } from '@utils/helpers';
import { parsePlatformReport } from '@utils/platformReportIO';
import { useLang } from '../../i18n/LangContext.jsx';
import './DeliveryAnalysis.css';

const PLATFORMS = {
  doordash: { name: 'DoorDash', color: '#FF3008', icon: '🔴', commissionPct: 25, paymentProcessingPct: 2.5, flatFeePerOrder: 0, marketingPct: 0 },
  ubereats:  { name: 'Uber Eats', color: '#06C167', icon: '🟢', commissionPct: 27, paymentProcessingPct: 2.5, flatFeePerOrder: 0, marketingPct: 0 },
  grubhub:   { name: 'Grubhub', color: '#F63440', icon: '🟠', commissionPct: 20, paymentProcessingPct: 3.05, flatFeePerOrder: 0.30, marketingPct: 0 },
};

function PlatformSalesRow({ platformKey, platform, days, months = {} }) {
  const { t } = useLang();
  const [rates, setRates]       = useState({ ...platform });
  const [showRates, setShowRates] = useState(false);

  const sumPlatform = (collection, suffix = '') =>
    Object.values(collection).reduce((s, r) => s + (r[`${platformKey}${suffix}`] || 0), 0);

  const totalRevenue = sumPlatform(days)         + sumPlatform(months);
  const totalOrders  = sumPlatform(days, 'Orders') + sumPlatform(months, 'Orders');
  const commissionAmt   = totalRevenue * (rates.commissionPct / 100);
  const processingAmt   = totalRevenue * (rates.paymentProcessingPct / 100);
  const flatAmt         = rates.flatFeePerOrder * totalOrders;
  const marketingAmt    = totalRevenue * (rates.marketingPct / 100);
  const totalDeductions = commissionAmt + processingAmt + flatAmt + marketingAmt;
  const netRevenue      = totalRevenue - totalDeductions;
  const effectiveRate   = totalRevenue > 0 ? (totalDeductions / totalRevenue) * 100 : 0;

  const fields = [
    { key: 'commissionPct',        label: t.commissionLabel,  suffix: '%', help: t.commissionHelp },
    { key: 'paymentProcessingPct', label: t.processingLabel,  suffix: '%', help: t.processingHelp },
    { key: 'flatFeePerOrder',      label: t.flatFeeLabel,     prefix: '$', help: t.flatFeeHelp },
    { key: 'marketingPct',         label: t.marketingLabel,   suffix: '%', help: t.marketingHelp },
  ];

  return (
    <div className="platform-card" style={{ '--platform-color': platform.color }}>
      <div className="platform-card-header" onClick={() => setShowRates(!showRates)}>
        <div className="platform-title-row">
          <span className="platform-icon">{platform.icon}</span>
          <div>
            <h4 className="platform-name" style={{ color: platform.color }}>{platform.name}</h4>
            <p className="platform-note">{totalOrders} {t.dashOrdersUnit} · {formatCurrency(totalRevenue)} {t.daGrossLabel}</p>
          </div>
        </div>
        <div className="platform-header-meta">
          {totalRevenue > 0 && (
            <div className="platform-summary-pills">
              <span className="pill pill-cost">−{formatCurrency(totalDeductions)}</span>
              <span className="pill pill-net">{t.daNetLabel} {formatCurrency(netRevenue)}</span>
              <span className="pill pill-rate">{effectiveRate.toFixed(1)}{t.daTakeLabel}</span>
            </div>
          )}
          <span className="item-cost-chevron">{showRates ? '▲' : '▼'}</span>
        </div>
      </div>

      {showRates && (
        <div className="platform-body">
          <div className="platform-fields">
            {fields.map(({ key, label, suffix, prefix, help }) => (
              <div className="platform-field" key={key}>
                <label className="target-label">{label}</label>
                <p className="target-help">{help}</p>
                <div className="target-input-wrap">
                  {prefix && <span className="target-prefix">{prefix}</span>}
                  <input className="form-input form-input-sm" type="number" min="0"
                    step={suffix === '%' ? '0.5' : '0.01'}
                    value={rates[key]}
                    onChange={e => setRates(r => ({ ...r, [key]: parseFloat(e.target.value) || 0 }))} />
                  {suffix && <span className="target-suffix">{suffix}</span>}
                </div>
              </div>
            ))}
          </div>

          {totalRevenue > 0 && (
            <div className="platform-breakdown">
              <table className="breakdown-table">
                <thead>
                  <tr><th>{t.colFeeType}</th><th>{t.colRate}</th><th>{t.colAmount}</th></tr>
                </thead>
                <tbody>
                  <tr><td>{t.grossRevenue}</td><td>—</td><td className="bd-positive">{formatCurrency(totalRevenue)}</td></tr>
                  <tr><td>{t.commission}</td><td>{rates.commissionPct}%</td><td className="bd-negative">−{formatCurrency(commissionAmt)}</td></tr>
                  <tr><td>{t.paymentProcessing}</td><td>{rates.paymentProcessingPct}%</td><td className="bd-negative">−{formatCurrency(processingAmt)}</td></tr>
                  <tr><td>{t.flatFees} ({totalOrders} × ${rates.flatFeePerOrder.toFixed(2)})</td><td>—</td><td className="bd-negative">−{formatCurrency(flatAmt)}</td></tr>
                  <tr><td>{t.marketing}</td><td>{rates.marketingPct}%</td><td className="bd-negative">−{formatCurrency(marketingAmt)}</td></tr>
                </tbody>
                <tfoot>
                  <tr className="bd-total-row"><td>{t.totalDeductions}</td><td>{effectiveRate.toFixed(1)}%</td><td className="bd-negative">−{formatCurrency(totalDeductions)}</td></tr>
                  <tr className="bd-net-row" style={{ color: platform.color }}><td colSpan="2">{t.netRevenueTo}</td><td>{formatCurrency(netRevenue)}</td></tr>
                </tfoot>
              </table>
              <div className="platform-bar-wrap">
                <div className="platform-bar-track">
                  <div className="platform-bar-fill" style={{ width: `${Math.min(effectiveRate, 100)}%`, background: platform.color, opacity: 0.7 }} />
                  <div className="platform-bar-net" style={{ background: platform.color, opacity: 0.2, width: `${Math.max(100 - effectiveRate, 0)}%` }} />
                </div>
                <div className="platform-bar-labels">
                  <span style={{ color: platform.color }}>{t.platformTakes} {effectiveRate.toFixed(1)}%</span>
                  <span>{t.youKeep} {(100 - effectiveRate).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}
          <button className="btn-reset-platform" onClick={() => setRates({ ...platform })}>{t.resetToDefaults}</button>
        </div>
      )}
    </div>
  );
}

function DayPlatformEntry({ date, day, onUpsertDay }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    doordash:       day.doordash       || '',
    doordashOrders: day.doordashOrders || '',
    ubereats:       day.ubereats       || '',
    ubereatsOrders: day.ubereatsOrders || '',
    grubhub:        day.grubhub        || '',
    grubhubOrders:  day.grubhubOrders  || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    onUpsertDay(date, {
      doordash:       parseFloat(form.doordash)       || 0,
      doordashOrders: parseInt(form.doordashOrders)   || 0,
      ubereats:       parseFloat(form.ubereats)       || 0,
      ubereatsOrders: parseInt(form.ubereatsOrders)   || 0,
      grubhub:        parseFloat(form.grubhub)        || 0,
      grubhubOrders:  parseInt(form.grubhubOrders)    || 0,
    });
    setOpen(false);
  };

  const hasData = (day.doordash || 0) + (day.ubereats || 0) + (day.grubhub || 0) > 0;
  const [year, month, d] = date.split('-');
  const fmtDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(d))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="day-card">
      <div className="day-card-header" onClick={() => setOpen(!open)}>
        <div className="day-date-col">
          <span className="day-date">{fmtDate}</span>
          {hasData && (
            <div className="day-type-pills">
              {day.doordash > 0 && <span className="type-pill" style={{ background: 'rgba(255,48,8,0.1)', color: '#FF3008', border: '1px solid rgba(255,48,8,0.3)' }}>DD {formatCurrency(day.doordash)}</span>}
              {day.ubereats > 0 && <span className="type-pill" style={{ background: 'rgba(6,193,103,0.1)', color: '#06C167', border: '1px solid rgba(6,193,103,0.3)' }}>UE {formatCurrency(day.ubereats)}</span>}
              {day.grubhub  > 0 && <span className="type-pill" style={{ background: 'rgba(246,52,64,0.1)', color: '#F63440', border: '1px solid rgba(246,52,64,0.3)' }}>GH {formatCurrency(day.grubhub)}</span>}
            </div>
          )}
        </div>
        <span className="item-cost-chevron">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="day-form">
          <div className="day-form-grid">
            {[
              { key: 'doordash', ordKey: 'doordashOrders', label: 'DoorDash', color: '#FF3008' },
              { key: 'ubereats', ordKey: 'ubereatsOrders', label: 'Uber Eats', color: '#06C167' },
              { key: 'grubhub',  ordKey: 'grubhubOrders',  label: 'Grubhub',   color: '#F63440' },
            ].map(p => (
              <div className="day-form-section" key={p.key}>
                <p className="day-form-section-label" style={{ color: p.color }}>{p.label}</p>
                <div className="day-form-row">
                  <div className="day-form-field">
                    <label className="target-label">{t.labelRevenue}</label>
                    <div className="target-input-wrap">
                      <span className="target-prefix">$</span>
                      <input className="form-input form-input-sm" type="number" min="0" step="0.01"
                        placeholder="0.00" value={form[p.key]}
                        onChange={e => set(p.key, e.target.value)} />
                    </div>
                  </div>
                  <div className="day-form-field">
                    <label className="target-label">{t.labelOrders}</label>
                    <input className="form-input form-input-sm" type="number" min="0"
                      placeholder="0" value={form[p.ordKey]}
                      onChange={e => set(p.ordKey, e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="day-form-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>{t.cancelBtn}</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>{t.saveBtn}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DeliveryAnalysis({ days, months = {}, dailySummary, onUpsertDay, onUpsertMonth }) {
  const { t } = useLang();
  const [activeSection, setActiveSection] = useState('entry');
  const [uploadingPlatform, setUploadingPlatform] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null); // { type: 'success'|'error', msg }
  const uploadRef = useRef(null);

  const sortedDates = Object.keys(days).sort((a, b) => b.localeCompare(a));

  const totals = {
    doordash: Object.values(days).reduce((s, d) => s + (d.doordash || 0), 0)
            + Object.values(months).reduce((s, m) => s + (m.doordash || 0), 0),
    ubereats:  Object.values(days).reduce((s, d) => s + (d.ubereats  || 0), 0)
            + Object.values(months).reduce((s, m) => s + (m.ubereats  || 0), 0),
    grubhub:   Object.values(days).reduce((s, d) => s + (d.grubhub   || 0), 0)
            + Object.values(months).reduce((s, m) => s + (m.grubhub   || 0), 0),
  };

  const triggerUpload = (platformKey) => {
    setUploadingPlatform(platformKey);
    setUploadStatus(null);
    uploadRef.current.click();
  };

  const handleUpload = async (file) => {
    if (!file || !uploadingPlatform) return;
    const platformKey = uploadingPlatform;
    try {
      const { days: importedDays, months: importedMonths } = await parsePlatformReport(file);

      let dayCount = 0;
      let monthCount = 0;
      let totalRev = 0;

      Object.entries(importedDays).forEach(([date, { revenue, orders, breakdown }]) => {
        onUpsertDay(date, {
          [platformKey]:               revenue,
          [`${platformKey}Orders`]:    orders,
          ...(breakdown && { [`${platformKey}Breakdown`]: breakdown }),
          // Preserve a manual flag if the user had already typed this day in.
          source: days[date]?.source || 'imported',
        });
        dayCount++;
        totalRev += revenue;
      });

      Object.entries(importedMonths).forEach(([month, { revenue, orders, breakdown }]) => {
        if (!onUpsertMonth) return;
        onUpsertMonth(month, {
          [platformKey]:               revenue,
          [`${platformKey}Orders`]:    orders,
          ...(breakdown && { [`${platformKey}Breakdown`]: breakdown }),
          source: months[month]?.source || 'imported',
        });
        monthCount++;
        totalRev += revenue;
      });

      const parts = [];
      if (dayCount > 0)   parts.push(`${dayCount} ${dayCount !== 1 ? t.daysPlural : t.days}`);
      if (monthCount > 0) parts.push(`${monthCount} ${monthCount !== 1 ? t.monthsPlural : t.months}`);
      setUploadStatus({
        type: 'success',
        msg: `✓ ${PLATFORMS[platformKey].name}: ${parts.join(' · ')} · ${formatCurrency(totalRev)}`,
      });
    } catch (err) {
      setUploadStatus({ type: 'error', msg: `⚠ ${err.message}` });
    } finally {
      setUploadingPlatform(null);
      uploadRef.current.value = '';
    }
  };

  return (
    <div className="delivery-analysis">
      <div className="da-section-toggle">
        <button className={`tab-btn ${activeSection === 'entry' ? 'active' : ''}`}
          onClick={() => setActiveSection('entry')}>
          {t.daPlatformSalesTab}
        </button>
        <button className={`tab-btn ${activeSection === 'fees' ? 'active' : ''}`}
          onClick={() => setActiveSection('fees')}>
          {t.daFeeAnalysisTab}
        </button>
      </div>

      {activeSection === 'entry' && (
        <div>
          <div className="da-intro">
            <div>
              <h3 className="ca-section-title">{t.daPlatformSalesTitle}</h3>
              <p className="ca-section-sub">{t.daPlatformSalesSub}</p>
            </div>
            <div className="platform-totals-row">
              {Object.entries(totals).map(([key, val]) => (
                <div key={key} className="platform-total-pill" style={{ color: PLATFORMS[key].color }}>
                  {PLATFORMS[key].name}: {formatCurrency(val)}
                </div>
              ))}
            </div>
          </div>

          <div className="da-upload-section">
            <div>
              <h4 className="da-upload-title">{t.uploadReportTitle}</h4>
              <p className="da-upload-sub">{t.uploadReportSub}</p>
            </div>
            <div className="da-upload-buttons">
              {Object.entries(PLATFORMS).map(([key, p]) => (
                <button key={key} className="btn btn-secondary btn-sm"
                  style={{ color: p.color, borderColor: p.color }}
                  onClick={() => triggerUpload(key)}>
                  {p.icon} {t.uploadReportBtn} {p.name}
                </button>
              ))}
            </div>
            {uploadStatus && (
              <div className={`da-upload-feedback ${uploadStatus.type}`}>{uploadStatus.msg}</div>
            )}
            <input
              ref={uploadRef}
              type="file"
              accept=".csv,.xlsx,.xls,.pdf,application/pdf"
              style={{ display: 'none' }}
              onChange={e => handleUpload(e.target.files[0])}
            />
          </div>

          {sortedDates.length === 0 ? (
            <div className="ca-empty">{t.daNoData}</div>
          ) : (
            <div className="platform-list">
              {sortedDates.map(date => (
                <DayPlatformEntry key={date} date={date} day={days[date]} onUpsertDay={onUpsertDay} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'fees' && (
        <div>
          <div className="da-intro">
            <div>
              <h3 className="ca-section-title">{t.daFeeAnalysisTitle}</h3>
              <p className="ca-section-sub">{t.daFeeAnalysisSub}</p>
            </div>
          </div>
          <div className="platform-list">
            {Object.entries(PLATFORMS).map(([key, p]) => (
              <PlatformSalesRow key={key} platformKey={key} platform={p} days={days} months={months} />
            ))}
          </div>

          {(totals.doordash + totals.ubereats + totals.grubhub) > 0 && (
            <div className="comparison-section" style={{ marginTop: '1rem' }}>
              <h4 className="comparison-title">{t.comparisonTitle}</h4>
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>{t.colPlatform}</th>
                    <th>{t.grossRevenue}</th>
                    <th>{t.colEstDeductions}</th>
                    <th>{t.colEstNet}</th>
                    <th>{t.colYouKeep}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(PLATFORMS).map(([key, p]) => {
                    const rev = totals[key];
                    const orders = Object.values(days).reduce((s, d) => s + (d[`${key}Orders`] || 0), 0)
                                 + Object.values(months).reduce((s, m) => s + (m[`${key}Orders`] || 0), 0);
                    const deductions = rev * ((p.commissionPct + p.paymentProcessingPct + p.marketingPct) / 100) + p.flatFeePerOrder * orders;
                    const net = rev - deductions;
                    const keepPct = rev > 0 ? (net / rev) * 100 : 0;
                    return (
                      <tr key={key}>
                        <td><span style={{ color: p.color, fontWeight: 600 }}>{p.icon} {p.name}</span></td>
                        <td>{formatCurrency(rev)}</td>
                        <td className="bd-negative">−{formatCurrency(deductions)}</td>
                        <td>{formatCurrency(net)}</td>
                        <td><span className={`pill ${keepPct >= 70 ? 'pill-net' : keepPct >= 65 ? 'pill-warn' : 'pill-cost'}`}>{keepPct.toFixed(1)}%</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

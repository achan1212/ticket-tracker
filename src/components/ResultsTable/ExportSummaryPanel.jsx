import { useLang } from '../../i18n/LangContext.jsx';

// The "Export to Summary" panel shown above the results table when the user
// clicks Export to Summary. Lets them pick a daily/monthly target, a date, an
// optional channel, choose which rows to include, preview the aggregate, and
// push it into the order/monthly stores. Holds no state — every value and
// mutation comes from the parent ResultsTable through props.
export default function ExportSummaryPanel({
  exportTarget,
  setExportTarget,
  exportDate,
  setExportDate,
  exportChannel,
  setExportChannel,
  exportPreview,
  allItems,
  allCategoryState,
  setAllCategories,
  detectedDate,
  exportFeedback,
  onExport,
  onClose,
}) {
  const { t, formatCurrency } = useLang();

  return (
    <div className="export-summary-panel">
      <div className="export-summary-row">
        <div className="export-summary-field">
          <label className="target-label">{t.exportTargetLabel || 'Send to'}</label>
          <div className="export-target-pills">
            <button
              type="button"
              className={`filter-pill ${exportTarget === 'daily' ? 'active' : ''}`}
              onClick={() => setExportTarget('daily')}
            >{t.tabSummary || 'Daily'}</button>
            <button
              type="button"
              className={`filter-pill ${exportTarget === 'monthly' ? 'active' : ''}`}
              onClick={() => setExportTarget('monthly')}
            >{t.tabMonthly || 'Monthly'}</button>
          </div>
        </div>

        <div className="export-summary-field">
          <label className="target-label">
            {exportTarget === 'daily' ? (t.colDate || 'Date') : (t.labelMonth || 'Month')}
          </label>
          <input
            type={exportTarget === 'daily' ? 'date' : 'month'}
            className="form-input"
            value={exportTarget === 'daily' ? exportDate : exportDate.slice(0, 7)}
            onChange={(e) => {
              const v = e.target.value;
              setExportDate(exportTarget === 'daily' ? v : `${v}-01`);
            }}
            onClick={(e) => e.currentTarget.showPicker?.()}
          />
        </div>

        <div className="export-summary-field">
          <label className="target-label">
            {t.exportChannelLabel || 'Channel'}
            <span className="export-optional-tag">{t.exportOptional || 'optional'}</span>
          </label>
          <div className="export-target-pills">
            <button
              type="button"
              className={`filter-pill ${exportChannel === 'none' ? 'active' : ''}`}
              onClick={() => setExportChannel('none')}
            >{t.exportChannelNone || 'Unspecified'}</button>
            <button
              type="button"
              className={`filter-pill ${exportChannel === 'pickup' ? 'active' : ''}`}
              onClick={() => setExportChannel('pickup')}
            >{t.labelPickup || 'Pickup'}</button>
            <button
              type="button"
              className={`filter-pill ${exportChannel === 'delivery' ? 'active' : ''}`}
              onClick={() => setExportChannel('delivery')}
            >{t.labelDelivery || 'Delivery'}</button>
          </div>
        </div>
      </div>

      <div className="export-bulk-row">
        <span className="export-bulk-label">
          {t.exportBulkLabel || 'Categories'}:
        </span>
        <button
          type="button"
          className={`filter-pill ${allCategoryState === 'all' ? 'active' : ''}`}
          onClick={() => setAllCategories(true)}
          disabled={allItems.length === 0}
        >
          {t.exportSelectAllBtn || 'Select all'}
        </button>
        <button
          type="button"
          className={`filter-pill ${allCategoryState === 'none' ? 'active' : ''}`}
          onClick={() => setAllCategories(false)}
          disabled={allItems.length === 0}
        >
          {t.exportClearAllBtn || 'Clear all'}
        </button>
        <span className="export-bulk-state">
          {allItems.filter(i => i.isCategory).length} / {allItems.length} {t.exportSelectedSuffix || 'selected'}
        </span>
      </div>

      <div className="export-summary-preview">
        <span className="export-preview-pill"><strong>{exportPreview.orderCount}</strong> {t.labelOrders || 'orders'}</span>
        <span className="export-preview-pill"><strong>{formatCurrency(exportPreview.revenue)}</strong> {t.labelRevenue || 'revenue'}</span>
        <span className="export-preview-pill">
          <strong>{Object.keys(exportPreview.categories).length}</strong>{' '}
          {t.categoriesBadge || 'categories'}
        </span>
        {detectedDate && exportDate === detectedDate && (
          <span className="export-preview-pill export-preview-auto">
            {t.foodCostDateAuto || 'auto'}
          </span>
        )}
        {exportChannel === 'none' && (
          <span className="export-preview-pill export-preview-muted" title={t.exportChannelNoneTitle || 'Channel revenue stays at 0 for delivery and pickup; only the categories are pushed.'}>
            {t.exportChannelNoneLabel || 'Channel skipped'}
          </span>
        )}
      </div>

      {Object.keys(exportPreview.categories).length === 0 && (
        <p className="export-summary-hint">
          {t.exportNoIncludedHint || 'No rows are checked. Use the checkboxes (or Select all) to choose which rows go into the summary — checked rows contribute to revenue and become category entries.'}
        </p>
      )}

      {Object.keys(exportPreview.categories).length > 0 && (
        <div className="export-summary-cats">
          <span className="export-summary-cats-label">{t.revenueCategories || 'Revenue Categories'}</span>
          <div className="category-list">
            {Object.entries(exportPreview.categories).map(([name, cost]) => (
              <div key={name} className="category-item">
                <span className="category-name">{name}</span>
                <span className="category-cost">{formatCurrency(cost)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {exportFeedback && (
        <div className={`export-feedback export-feedback-${exportFeedback.type}`}>
          {exportFeedback.msg}
        </div>
      )}

      <div className="export-summary-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          {t.cancelBtn || 'Cancel'}
        </button>
        <button className="btn btn-primary" onClick={onExport}>
          {t.exportConfirmBtn || 'Push to Summary'}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';
import { NAV_GROUPS, getGroupKeyForTab } from './navConfig.js';

export default function MobileDrawer({ open, activeTab, onClose, onNavigate }) {
  const { t } = useLang();
  const activeGroupKey = getGroupKeyForTab(activeTab);
  const drawerRef = useRef(null);

  // Esc closes; body scroll lock prevents iOS rubber-band while open.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Focus trap: move focus into the drawer on open and cycle Tab/Shift-Tab within it.
  useEffect(() => {
    if (!open) return;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const focusable = Array.from(drawer.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.disabled);
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    first?.focus();
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    };
    drawer.addEventListener('keydown', trap);
    return () => drawer.removeEventListener('keydown', trap);
  }, [open]);

  const handleSelect = (tabKey) => {
    onNavigate(tabKey);
    onClose();
  };

  return (
    <>
      <div
        className={`nav-drawer-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        ref={drawerRef}
        className={`nav-drawer ${open ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label="Navigation"
      >
        <div className="nav-drawer-header">
          <button
            type="button"
            className="nav-drawer-close"
            aria-label="Close menu"
            onClick={onClose}
          >×</button>
        </div>
        <div className="nav-drawer-body">
          {NAV_GROUPS.map(node => {
            if (node.type === 'group') {
              return (
                <div key={node.key} className="drawer-group">
                  <div className="drawer-group-label">{t[node.labelKey] || node.labelKey}</div>
                  {node.items.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      className={`drawer-item ${item.key === activeTab ? 'active' : ''}`}
                      onClick={() => handleSelect(item.key)}
                    >
                      <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                      <span className="nav-label">{t[item.labelKey] || item.labelKey}</span>
                    </button>
                  ))}
                </div>
              );
            }
            const isActive = activeGroupKey === node.key;
            return (
              <div key={node.key} className="drawer-group">
                <button
                  type="button"
                  className={`drawer-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelect(node.key)}
                >
                  <span className="nav-icon" aria-hidden="true">{node.icon}</span>
                  <span className="nav-label">{t[node.labelKey] || node.labelKey}</span>
                </button>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}

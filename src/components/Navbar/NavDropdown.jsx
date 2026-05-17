import { useEffect, useId, useRef } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';

export default function NavDropdown({ group, isOpen, isActive, activeTabKey, onToggle, onSelect, onClose }) {
  const { t } = useLang();
  const menuId = useId();
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);

  // When the menu opens via ArrowDown, focus the first item. Plain mouse-click
  // opens the menu without stealing focus.
  const focusItem = (index) => {
    const el = itemRefs.current[index];
    if (el) el.focus();
  };

  // Esc closes and returns focus to the trigger.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        onClose();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) onToggle();
      // Focus first item on next paint so the menu has mounted.
      setTimeout(() => focusItem(0), 0);
    }
  };

  const handleItemKeyDown = (e, index) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusItem((index + 1) % group.items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusItem((index - 1 + group.items.length) % group.items.length);
    }
  };

  return (
    <div className="nav-group">
      <button
        ref={triggerRef}
        className={`nav-trigger ${isActive ? 'active' : ''}`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={onToggle}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="nav-label">{t[group.labelKey] || group.labelKey}</span>
        <span className="nav-caret" aria-hidden="true">▾</span>
      </button>
      {isOpen && (
        <ul
          id={menuId}
          className="nav-menu"
          role="menu"
          aria-label={t[group.labelKey] || group.labelKey}
        >
          {group.items.map((item, i) => {
            const isItemActive = item.key === activeTabKey;
            return (
              <li key={item.key} role="none">
                <button
                  ref={(el) => { itemRefs.current[i] = el; }}
                  role="menuitem"
                  className={`nav-menu-item ${isItemActive ? 'active' : ''}`}
                  type="button"
                  onClick={() => onSelect(item.key)}
                  onKeyDown={(e) => handleItemKeyDown(e, i)}
                >
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                  <span className="nav-label">{t[item.labelKey] || item.labelKey}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

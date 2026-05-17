import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';
import { NAV_GROUPS, getGroupKeyForTab } from './navConfig.js';
import NavDropdown from './NavDropdown.jsx';

export default function Navbar({ activeTab, onNavigate }) {
  const { t } = useLang();
  const [openMenuKey, setOpenMenuKey] = useState(null);
  const navRef = useRef(null);
  const activeGroupKey = getGroupKeyForTab(activeTab);

  // Click outside the navbar closes any open menu.
  useEffect(() => {
    if (!openMenuKey) return;
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenMenuKey(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuKey]);

  // Sync with the router: any route change (item click, browser back/forward,
  // deep-link, programmatic navigate from a child) should drop the menu.
  useEffect(() => { setOpenMenuKey(null); }, [activeTab]);

  const handleSelect = (tabKey) => {
    setOpenMenuKey(null);
    onNavigate(tabKey);
  };

  const toggleMenu = (groupKey) => {
    setOpenMenuKey(prev => (prev === groupKey ? null : groupKey));
  };

  return (
    <nav className="app-navbar" ref={navRef}>
      {NAV_GROUPS.map(node => {
        if (node.type === 'group') {
          return (
            <NavDropdown
              key={node.key}
              group={node}
              isOpen={openMenuKey === node.key}
              isActive={activeGroupKey === node.key}
              activeTabKey={activeTab}
              onToggle={() => toggleMenu(node.key)}
              onSelect={handleSelect}
              onClose={() => setOpenMenuKey(null)}
            />
          );
        }
        const isActive = activeGroupKey === node.key;
        return (
          <button
            key={node.key}
            type="button"
            className={`nav-link ${isActive ? 'active' : ''}`}
            onClick={() => handleSelect(node.key)}
          >
            <span className="nav-icon" aria-hidden="true">{node.icon}</span>
            <span className="nav-label">{t[node.labelKey] || node.labelKey}</span>
          </button>
        );
      })}
    </nav>
  );
}

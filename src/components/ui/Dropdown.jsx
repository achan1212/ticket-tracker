import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import './Dropdown.css';

/**
 * Reusable single-select dropdown with built-in scroll + "jump to bottom"
 * arrow for long lists.
 *
 *   <Dropdown
 *     value={selectedMonth}
 *     onChange={setSelectedMonth}
 *     options={[{ value: '2026-05', label: 'May 2026' }, ...]}
 *     maxHeight={280}
 *     className="pl-month-dd"
 *   />
 */
export default function Dropdown({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  maxHeight = 280,
  className = '',
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showJumpBottom, setShowJumpBottom] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const itemRefs = useRef([]);
  const menuId = useId();

  const currentIdx = options.findIndex(o => o.value === value);
  const currentLabel = currentIdx >= 0 ? options[currentIdx].label : placeholder;

  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Close on Esc, return focus to trigger.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // When opened, scroll the selected item into view + focus it.
  useLayoutEffect(() => {
    if (!open) return;
    const startIdx = currentIdx >= 0 ? currentIdx : 0;
    setActiveIndex(startIdx);
    const el = itemRefs.current[startIdx];
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
      el.focus({ preventScroll: true });
    }
    updateOverflowState();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track whether the list is overflowing AND not yet scrolled to the bottom.
  const updateOverflowState = () => {
    const el = listRef.current;
    if (!el) return;
    const overflowing = el.scrollHeight > el.clientHeight + 1;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    setShowJumpBottom(overflowing && !atBottom);
  };

  const jumpToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    const lastIdx = options.length - 1;
    setActiveIndex(lastIdx);
    setTimeout(() => itemRefs.current[lastIdx]?.focus({ preventScroll: true }), 200);
  };

  const focusIndex = (idx) => {
    setActiveIndex(idx);
    const el = itemRefs.current[idx];
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
      el.focus({ preventScroll: true });
    }
  };

  const handleTriggerKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleItemKey = (e, idx) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusIndex((idx + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusIndex((idx - 1 + options.length) % options.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusIndex(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(options[idx].value);
    }
  };

  const pick = (val) => {
    onChange(val);
    close();
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className={`ui-dropdown ${open ? 'is-open' : ''} ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="ui-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={ariaLabel}
        onClick={() => setOpen(o => !o)}
        onKeyDown={handleTriggerKey}
      >
        <span className="ui-dropdown-value">{currentLabel}</span>
        <span className="ui-dropdown-caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="ui-dropdown-panel" role="presentation">
          <ul
            id={menuId}
            ref={listRef}
            className="ui-dropdown-list"
            role="listbox"
            aria-activedescendant={activeIndex >= 0 ? `${menuId}-opt-${activeIndex}` : undefined}
            style={{ maxHeight }}
            onScroll={updateOverflowState}
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              return (
                <li key={opt.value} role="none">
                  <button
                    id={`${menuId}-opt-${i}`}
                    ref={(el) => { itemRefs.current[i] = el; }}
                    role="option"
                    aria-selected={isSelected}
                    type="button"
                    className={`ui-dropdown-item ${isSelected ? 'is-selected' : ''} ${i === activeIndex ? 'is-active' : ''}`}
                    onClick={() => pick(opt.value)}
                    onKeyDown={(e) => handleItemKey(e, i)}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>

          {showJumpBottom && (
            <button
              type="button"
              className="ui-dropdown-jump"
              aria-label="Jump to bottom of list"
              title="Jump to bottom"
              onClick={jumpToBottom}
            >
              ↓
            </button>
          )}
        </div>
      )}
    </div>
  );
}

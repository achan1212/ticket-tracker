import { useState, useRef, useEffect } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';
import './ColorPicker.css';

const HEX_RE = /^#[0-9a-f]{6}$/i;

// Simple color picker component for dashboard color customization
export default function ColorPicker({ label, color, onChange }) {
  const { t } = useLang();
  const [isOpen, setIsOpen] = useState(false);
  // The text field holds a local draft so the user can type through invalid
  // intermediate states ("#", "#f9", "#f973a") without pushing garbage into
  // chart strokes or the native color input (which only accepts #rrggbb).
  const [draft, setDraft] = useState(color);
  const pickerRef = useRef(null);

  // Re-sync the draft when the committed color changes from outside (native
  // picker drag, reset-to-default).
  useEffect(() => { setDraft(color); }, [color]);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleTextChange = (e) => {
    const next = e.target.value;
    setDraft(next);
    if (HEX_RE.test(next)) onChange(next);
  };

  // On blur, snap an uncommitted draft back to the last valid color.
  const handleTextBlur = () => {
    if (!HEX_RE.test(draft)) setDraft(color);
  };

  return (
    <div className="color-picker" ref={pickerRef}>
      <div className="cp-label">{label}</div>
      <button
        className="cp-swatch"
        style={{ background: color }}
        onClick={() => setIsOpen(!isOpen)}
        title={`${t.colorPickerEditTitle || 'Edit color'}: ${label}`}
        aria-label={`${t.colorPickerEditTitle || 'Edit color'}: ${label}`}
      >
        <span className="cp-value">{color}</span>
      </button>
      {isOpen && (
        <div className="cp-dropdown">
          <input
            type="color"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className="cp-input"
          />
          <input
            type="text"
            value={draft}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            className="cp-text-input"
            placeholder="#000000"
          />
        </div>
      )}
    </div>
  );
}

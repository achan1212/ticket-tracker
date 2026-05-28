import { useState, useRef, useEffect } from 'react';
import './ColorPicker.css';

// Simple color picker component for dashboard color customization
export default function ColorPicker({ label, color, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef(null);

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

  return (
    <div className="color-picker" ref={pickerRef}>
      <div className="cp-label">{label}</div>
      <button
        className="cp-swatch"
        style={{ background: color }}
        onClick={() => setIsOpen(!isOpen)}
        title={`Edit ${label} color`}
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
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className="cp-text-input"
            placeholder="#000000"
          />
        </div>
      )}
    </div>
  );
}

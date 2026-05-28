import ColorPicker from './ColorPicker.jsx';
import './ColorEditor.css';

// Color editor panel for customizing dashboard colors
export default function ColorEditor({ editableColors, onColorChange, onReset, hasCustomColors }) {
  return (
    <div className="color-editor">
      <div className="ce-header">
        <h3 className="ce-title">Customize Dashboard Colors</h3>
        {hasCustomColors && (
          <button className="ce-reset-btn" onClick={onReset}>
            Reset to Default
          </button>
        )}
      </div>

      <div className="ce-section">
        <h4 className="ce-section-title">Chart Colors</h4>
        <div className="ce-grid">
          {editableColors.slice(0, 4).map(({ key, label, value }) => (
            <ColorPicker
              key={key}
              label={label}
              color={value}
              onChange={(newColor) => onColorChange(key, newColor)}
            />
          ))}
        </div>
      </div>

      <div className="ce-section">
        <h4 className="ce-section-title">Platform Colors</h4>
        <div className="ce-grid">
          {editableColors.slice(4).map(({ key, label, value }) => (
            <ColorPicker
              key={key}
              label={label}
              color={value}
              onChange={(newColor) => onColorChange(key, newColor)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

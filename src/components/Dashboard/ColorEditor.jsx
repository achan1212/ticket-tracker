import { useLang } from '../../i18n/LangContext.jsx';
import ColorPicker from './ColorPicker.jsx';
import './ColorEditor.css';

// Color editor panel for customizing dashboard colors. Labels arrive as
// `labelKey` (resolved through translations) with an English/brand-name
// fallback for keys that don't translate (DoorDash, Uber Eats, …).
export default function ColorEditor({ editableColors, onColorChange, onReset, hasCustomColors }) {
  const { t } = useLang();
  const resolveLabel = ({ labelKey, fallback }) => (labelKey && t[labelKey]) || fallback;

  return (
    <div className="color-editor">
      <div className="ce-header">
        <h3 className="ce-title">{t.colorEditorTitle || 'Customize Dashboard Colors'}</h3>
        {hasCustomColors && (
          <button className="ce-reset-btn" onClick={onReset}>
            {t.colorEditorReset || 'Reset to Default'}
          </button>
        )}
      </div>

      <div className="ce-section">
        <h4 className="ce-section-title">{t.colorEditorChartSection || 'Chart Colors'}</h4>
        <div className="ce-grid">
          {editableColors.slice(0, 4).map((entry) => (
            <ColorPicker
              key={entry.key}
              label={resolveLabel(entry)}
              color={entry.value}
              onChange={(newColor) => onColorChange(entry.key, newColor)}
            />
          ))}
        </div>
      </div>

      <div className="ce-section">
        <h4 className="ce-section-title">{t.colorEditorPlatformSection || 'Platform Colors'}</h4>
        <div className="ce-grid">
          {editableColors.slice(4).map((entry) => (
            <ColorPicker
              key={entry.key}
              label={resolveLabel(entry)}
              color={entry.value}
              onChange={(newColor) => onColorChange(entry.key, newColor)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

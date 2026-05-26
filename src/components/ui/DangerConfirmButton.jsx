import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';

/**
 * Two-click destructive button. First click flips to a red "armed" state
 * for `resetMs` ms; a second click within that window fires `onConfirm`.
 * The armed state auto-reverts on timeout. Replaces window.confirm for
 * destructive inline actions.
 */
export default function DangerConfirmButton({
  onConfirm,
  children,
  confirmLabel,
  className = 'btn btn-danger',
  disabled = false,
  resetMs = 3000,
  ...rest
}) {
  const { t } = useLang();
  const [armed, setArmed] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Cancel the armed state if the button gets disabled mid-window.
  useEffect(() => {
    if (disabled && armed) {
      clearTimeout(timerRef.current);
      setArmed(false);
    }
  }, [disabled, armed]);

  const handleClick = () => {
    if (disabled) return;
    if (armed) {
      clearTimeout(timerRef.current);
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timerRef.current = setTimeout(() => setArmed(false), resetMs);
  };

  const label = armed
    ? (confirmLabel || t.clickAgainToConfirm || 'Click again to confirm')
    : children;

  return (
    <button
      type="button"
      className={`${className}${armed ? ' is-armed' : ''}`}
      onClick={handleClick}
      disabled={disabled}
      aria-pressed={armed}
      {...rest}
    >
      {label}
    </button>
  );
}

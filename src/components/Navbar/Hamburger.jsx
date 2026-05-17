export default function Hamburger({ open, onClick, label = 'Menu' }) {
  return (
    <button
      type="button"
      className="nav-hamburger"
      aria-label={label}
      aria-expanded={open}
      onClick={onClick}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <line x1="3" y1="6"  x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
  );
}

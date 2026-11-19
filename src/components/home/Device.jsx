// Device frames drawn in CSS: a MacBook Pro-style laptop (thin black bezel, camera, aluminium base
// with finger notch) and an iPhone 16 Pro-style phone (titanium rim, Dynamic Island, status bar,
// side buttons, home indicator). Children render inside the screen; callouts can sit in them.

export function Laptop({ children, className = "" }) {
  return (
    <div className={`laptop ${className}`}>
      <div className="laptop-lid">
        <div className="laptop-screen">
          <div className="laptop-glass">{children}</div>
        </div>
      </div>
      <div className="laptop-base" aria-hidden="true" />
    </div>
  );
}

function StatusBar() {
  return (
    <div className="phone-status" aria-hidden="true">
      <b>9:41</b>
      <span>
        <svg viewBox="0 0 18 12" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="0.8" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="0.8" />
          <rect x="10" y="3" width="3" height="9" rx="0.8" />
          <rect x="15" y="0" width="3" height="12" rx="0.8" />
        </svg>
        <svg viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M1 4.2a10 10 0 0 1 14 0M3.4 6.9a6.4 6.4 0 0 1 9.2 0" />
          <circle cx="8" cy="10" r="1.1" fill="currentColor" stroke="none" />
        </svg>
        <svg viewBox="0 0 27 13" fill="none">
          <rect x="0.7" y="0.7" width="22.6" height="11.6" rx="3.6" stroke="currentColor" strokeOpacity="0.45" />
          <rect x="2.4" y="2.4" width="19.2" height="8.2" rx="2.2" fill="currentColor" />
          <path d="M25 4.4v4.2c.9-.3 1.6-1.2 1.6-2.1S25.900 4.700 25 4.400Z" fill="currentColor" fillOpacity="0.5" />
        </svg>
      </span>
    </div>
  );
}

export function Phone({ children, className = "" }) {
  return (
    <div className={`phone ${className}`}>
      <span className="phone-btn b-action" aria-hidden="true" />
      <span className="phone-btn b-up" aria-hidden="true" />
      <span className="phone-btn b-down" aria-hidden="true" />
      <span className="phone-btn b-power" aria-hidden="true" />
      <div className="phone-rim">
        <div className="phone-body">
          <div className="phone-screen">
            <i className="phone-island" aria-hidden="true" />
            <StatusBar />
            <div className="phone-content">{children}</div>
            <i className="phone-home" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}

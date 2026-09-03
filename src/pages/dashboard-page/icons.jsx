const makeIcon = (paths) =>
  function IconComponent({ className = "", ...rest }) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={`dash-icon ${className}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...rest}
      >
        {paths}
      </svg>
    );
  };

export const Icons = {
  table: makeIcon(
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
      <line x1="9.5" y1="9.5" x2="9.5" y2="19.5" />
    </>
  ),

  grid: makeIcon(
    <>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="1.5" />
    </>
  ),

  clipboard: makeIcon(
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4.5V3.8A1.3 1.3 0 0 1 10.3 2.5h3.4A1.3 1.3 0 0 1 15 3.8v.7" />
      <path d="M9 12.5l2 2 4-4.2" />
    </>
  ),

  book: makeIcon(
    <>
      <path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H18v15H6.5A1.5 1.5 0 0 1 5 17.5v-12Z" />
      <path d="M18 19H6.5A1.5 1.5 0 0 0 5 20.5" />
    </>
  ),

  fileText: makeIcon(
    <>
      <path d="M6 3.5h9l3 3V20a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z" />
      <path d="M9 12h6M9 15.5h6" />
    </>
  ),

  settings: makeIcon(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M17.7 17.7l-1.4-1.4M7.7 7.7 6.3 6.3" />
    </>
  ),

  logout: makeIcon(
    <>
      <path d="M9 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H9" />
      <path d="M14 16l4-4-4-4" />
      <path d="M18 12H9" />
    </>
  ),

  search: makeIcon(
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <line x1="19" y1="19" x2="15" y2="15" />
    </>
  ),

  copy: makeIcon(
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5.5 15H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h8.5A1.5 1.5 0 0 1 15 5v.5" />
    </>
  ),

  check: makeIcon(<path d="M5 12.5l4.5 4.5L19 7" />),

  pulse: makeIcon(<path d="M3.5 12h3.5l2-6 4 12 2-8 1.5 2h3.5" />),

  users: makeIcon(
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19.5c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" />
      <path d="M16 8.8a2.6 2.6 0 1 1 0 5.1" />
      <path d="M15 14.6c2.4.3 4.5 2.3 4.5 4.9" />
    </>
  ),

  arrowRight: makeIcon(
    <>
      <line x1="4" y1="12" x2="18" y2="12" />
      <path d="M13 7l5 5-5 5" />
    </>
  ),

  plus: makeIcon(
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),

  close: makeIcon(
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),

  arrowLeft: makeIcon(
    <>
      <line x1="20" y1="12" x2="6" y2="12" />
      <path d="M11 7l-5 5 5 5" />
    </>
  ),

  trash: makeIcon(
    <>
      <path d="M5 7h14" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M6.5 7l.7 12a1.5 1.5 0 0 0 1.5 1.4h6.6a1.5 1.5 0 0 0 1.5-1.4l.7-12" />
    </>
  ),

  lock: makeIcon(
    <>
      <rect x="5.5" y="10.5" width="13" height="9" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),

  bell: makeIcon(
    <>
      <path d="M6 10.5a6 6 0 0 1 12 0c0 4 1.5 5.2 1.5 5.2H4.5S6 14.5 6 10.5Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </>
  ),

  pause: makeIcon(
    <>
      <rect x="7" y="5" width="3.2" height="14" rx="1" fill="currentColor" stroke="none" />
      <rect x="13.8" y="5" width="3.2" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),

  play: makeIcon(<path d="M7 5.5v13l11-6.5-11-6.5Z" fill="currentColor" stroke="none" />),

  square: makeIcon(<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none" />),

  download: makeIcon(
    <>
      <path d="M12 4v11" />
      <path d="M8 11l4 4 4-4" />
      <path d="M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16" />
    </>
  ),
};

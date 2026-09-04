const makeIcon = (paths) =>
  function IconComponent({ className = "", ...rest }) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={`icon ${className}`}
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
  shortAnswer: makeIcon(
    <>
      <path d="M5 8h4l2 8 2-8h6" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </>
  ),

  paragraph: makeIcon(
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="11" x2="20" y2="11" />
      <line x1="4" y1="16" x2="14" y2="16" />
    </>
  ),

  multipleChoice: makeIcon(
    <>
      <circle cx="6" cy="7" r="2" />
      <line x1="12" y1="7" x2="20" y2="7" />
      <circle cx="6" cy="17" r="2" />
      <line x1="12" y1="17" x2="20" y2="17" />
    </>
  ),

  checkboxes: makeIcon(
    <>
      <rect x="4" y="4.5" width="6" height="6" rx="1.3" />
      <path d="M5.3 7.5l1.2 1.2 2-2.4" />
      <line x1="13" y1="7.5" x2="20" y2="7.5" />
      <rect x="4" y="13.5" width="6" height="6" rx="1.3" />
      <line x1="13" y1="16.5" x2="20" y2="16.5" />
    </>
  ),

  dropdown: makeIcon(
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <path d="M9 12l2.5 2.5L14 12" />
    </>
  ),

  linearScale: makeIcon(
    <>
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="8" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="14" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),

  date: makeIcon(
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <line x1="4" y1="9.5" x2="20" y2="9.5" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </>
  ),

  time: makeIcon(
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 2" />
    </>
  ),

  fileUpload: makeIcon(
    <>
      <path d="M12 16V6" />
      <path d="M8 10l4-4 4 4" />
      <path d="M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16" />
    </>
  ),

  image: makeIcon(
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M4 16l5-5 4 4 3-3 4 4" />
    </>
  ),

  plus: makeIcon(
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),

  trash: makeIcon(
    <>
      <path d="M5 7h14" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M6.5 7l.7 12a1.5 1.5 0 0 0 1.5 1.4h6.6a1.5 1.5 0 0 0 1.5-1.4l.7-12" />
    </>
  ),

  copy: makeIcon(
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5.5 15H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h8.5A1.5 1.5 0 0 1 15 5v.5" />
    </>
  ),

  close: makeIcon(
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),

  chevronUp: makeIcon(<path d="M6 15l6-6 6 6" />),
  arrowLeft: makeIcon(
    <>
      <line x1="19" y1="12" x2="5" y2="12" />
      <path d="M11 6l-6 6 6 6" />
    </>
  ),
  chevronDown: makeIcon(<path d="M6 9l6 6 6-6" />),

  check: makeIcon(<path d="M5 13l4 4L19 7" />),

  section: makeIcon(
    <>
      <line x1="4" y1="7" x2="9" y2="7" />
      <line x1="15" y1="7" x2="20" y2="7" />
      <line x1="4" y1="17" x2="9" y2="17" />
      <line x1="15" y1="17" x2="20" y2="17" />
      <rect x="9.5" y="10.5" width="5" height="3" rx="0.8" />
    </>
  ),
};

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
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        {paths}
      </svg>
    );
  };

export const Icons = {
  network: makeIcon(
    <>
      <rect x="9" y="3.5" width="6" height="5" rx="1.2" />
      <rect x="3" y="15.5" width="6" height="5" rx="1.2" />
      <rect x="15" y="15.5" width="6" height="5" rx="1.2" />
      <path d="M12 8.5v3M12 11.5H6v4M12 11.5h6v4" />
    </>
  ),
  bolt: makeIcon(<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />),
  qrCode: makeIcon(
    <>
      <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
      <path d="M14.5 15h2.5v2.5H14.5zM19.5 15v2.5M14.5 20h2.5M19.5 20v-1" />
    </>
  ),
  chart: makeIcon(
    <>
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M3 20h18" />
    </>
  ),
  layers: makeIcon(
    <>
      <path d="M12 3.5 21 8l-9 4.5L3 8l9-4.5Z" />
      <path d="m3 13 9 4.5 9-4.5" />
      <path d="m3 17 9 4.5 9-4.5" />
    </>
  ),
  bank: makeIcon(
    <>
      <path d="M4 9.5 12 4l8 5.5" />
      <path d="M5 9.5h14V19H5z" />
      <path d="M9 9.5V19M15 9.5V19" />
      <path d="M3 19h18" />
    </>
  ),
  questionBank: makeIcon(
    <>
      <path d="M6 3.5h9l3 3V20a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z" />
      <path d="M9 9.3a1.7 1.7 0 1 1 2.6 1.4c-.7.5-1.1.9-1.1 1.8" />
      <circle cx="10.5" cy="15.2" r="0.15" fill="currentColor" />
    </>
  ),
  clock: makeIcon(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  trophy: makeIcon(
    <>
      <path d="M7 4.5h10v5a5 5 0 0 1-10 0v-5Z" />
      <path d="M7 6H4.5A2.5 2.5 0 0 0 7 9.5M17 6h2.5A2.5 2.5 0 0 1 17 9.5" />
      <path d="M12 14.5v3M9 20.5h6M9.5 17.5h5l.5 3h-6l.5-3Z" />
    </>
  ),
  devices: makeIcon(
    <>
      <rect x="3" y="4.5" width="13" height="9.5" rx="1.2" />
      <path d="M8 17.5h4" />
      <rect x="17.5" y="9.5" width="4" height="8" rx="1" />
    </>
  ),
  wifiOff: makeIcon(
    <>
      <path d="M2 8.5a17 17 0 0 1 5.3-3.1M9.9 4.4A17 17 0 0 1 22 8.5" />
      <path d="M5.5 12a12 12 0 0 1 3.6-2.2M14.9 9.8A12 12 0 0 1 18.5 12" />
      <path d="M9 15.3a7 7 0 0 1 6 0" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
      <path d="M2 2l20 20" />
    </>
  ),
  userX: makeIcon(
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M17 8.5l4 4M21 8.5l-4 4" />
    </>
  ),
  hourglass: makeIcon(
    <>
      <path d="M6 3.5h12M6 20.5h12" />
      <path d="M7 3.5v3.2a5 5 0 0 0 2 4 5.4 5.4 0 0 1 0 8.8v1" />
      <path d="M17 3.5v3.2a5 5 0 0 1-2 4 5.4 5.4 0 0 0 0 8.8v1" />
    </>
  ),
  cloud: makeIcon(
    <path d="M7 18.5a4.5 4.5 0 0 1-.5-9 5.5 5.5 0 0 1 10.7-1.7A4 4 0 0 1 17 18.5H7Z" />
  ),
  checkCircle: makeIcon(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.3 12.3 2.4 2.4 5-5" />
    </>
  ),
  arrowRight: makeIcon(<path d="M4 12h16M14 6l6 6-6 6" />),
  chevronDown: makeIcon(<path d="m6 9 6 6 6-6" />),
  menu: makeIcon(<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />),
  close: makeIcon(<path d="M6 6l12 12M18 6 6 18" />),
  plug: makeIcon(
    <>
      <path d="M9 2.5v5M15 2.5v5" />
      <path d="M6.5 7.5h11v3a5.5 5.5 0 0 1-11 0v-3Z" />
      <path d="M12 16v5.5" />
    </>
  ),
  monitor: makeIcon(
    <>
      <rect x="2.5" y="4" width="19" height="12.5" rx="1.5" />
      <path d="M8.5 20.5h7M12 16.5v4" />
    </>
  ),
  users: makeIcon(
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6M20 20a6 6 0 0 0-4-5.7" />
    </>
  ),
  shield: makeIcon(
    <path d="M12 3.5 19 6v5.5c0 4.5-3 7.3-7 9-4-1.7-7-4.5-7-9V6l7-2.5Z" />
  ),
  play: makeIcon(<path d="M7 5.2v13.6a1 1 0 0 0 1.5.9l11-6.8a1 1 0 0 0 0-1.7l-11-6.8A1 1 0 0 0 7 5.2Z" />),
  file: makeIcon(
    <>
      <path d="M6 3.5h9l3 3V20a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z" />
      <path d="M9 12h6M9 15.5h6M9 8.5h2" />
    </>
  ),
  github: makeIcon(
    <path d="M12 2.5a9.5 9.5 0 0 0-3 18.5c.5.1.6-.2.6-.5v-1.7c-2.6.6-3.2-1.1-3.2-1.1-.4-1-1-1.3-1-1.3-.9-.6.1-.6.1-.6 1 .1 1.4 1 1.4 1 .9 1.5 2.3 1 2.9.8.1-.7.4-1 .6-1.3-2-.2-4.2-1-4.2-4.5 0-1 .3-1.8 1-2.5-.1-.2-.4-1.2.1-2.5 0 0 .8-.3 2.7 1a9 9 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.5.6.7 1 1.5 1 2.5 0 3.5-2.2 4.3-4.2 4.5.3.3.6.9.6 1.8v2.6c0 .3.2.6.6.5A9.5 9.5 0 0 0 12 2.5Z" />
  ),
  calendar: makeIcon(
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="1.8" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  upload: makeIcon(
    <>
      <path d="M12 15.5V4M8 8l4-4 4 4" />
      <path d="M4.5 15.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
    </>
  ),
  download: makeIcon(
    <>
      <path d="M12 4v11.5M8 11.5l4 4 4-4" />
      <path d="M4.5 15.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
    </>
  ),
  share: makeIcon(
    <>
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" />
    </>
  ),
  database: makeIcon(
    <>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.7" />
      <path d="M4.5 5.5v13c0 1.5 3.4 2.7 7.5 2.7s7.5-1.2 7.5-2.7v-13" />
      <path d="M4.5 12c0 1.5 3.4 2.7 7.5 2.7s7.5-1.2 7.5-2.7" />
    </>
  ),
  copy: makeIcon(
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="1.5" />
      <path d="M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5" />
    </>
  ),
  sliders: makeIcon(
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h13M21 18h-1" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  edit: makeIcon(
    <>
      <path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z" />
      <path d="M13 6.5 17.5 11" />
    </>
  ),
};

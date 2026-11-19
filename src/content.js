// Short on purpose: the page tells its story through motion, so copy is labels, not paragraphs.
// Every claim here was checked against the app (see ../README and the app's REDESIGN_PLAN.md):
// vocabulary follows the app: Host, Respondent, Participant list, Ranking, Results matrix, Folders.

export const NAV_LINKS = [
  { id: "how-it-works", label: "How it works" },
  { id: "features", label: "Features" },
  { id: "local-first", label: "Local first" },
  { id: "download", label: "Download" },
  { id: "setup", label: "Setup" },
  { id: "faq", label: "FAQ" },
];

export const FAQS = [
  {
    q: "What is it for?",
    a: "Anything that collects answers from people on your network or over a public link: classroom quizzes and tests, training check-ins, event registrations, feedback forms, surveys, sign-up sheets and internal polls.",
  },
  {
    q: "Is it free?",
    a: "Free to run for personal, educational and internal institutional use. The source is available to read, but it isn't open source: redistribution, resale, hosting it as a service and commercial use need permission.",
  },
  {
    q: "Where is my data stored?",
    a: "In a local SQLite database on the computer running the app. Nothing goes to a cloud service unless you choose to connect a Google account for the optional Drive sync.",
  },
  {
    q: "Do respondents need an account?",
    a: "No. They open the link, scan the QR code or type the code, and answer. Only the host has a password.",
  },
  {
    q: "What if people aren't on my Wi-Fi?",
    a: "In the desktop app, start a temporary public link. It uses a Cloudflare tunnel, so there is no port forwarding. Stop it, or close the app, and the link goes down.",
  },
  {
    q: "Can it prevent cheating in tests?",
    a: "It can require fullscreen, lock the screen when someone switches away, and restrict copying. These are deterrents. A browser can't fully lock down a device, so supervise high-stakes tests.",
  },
  {
    q: "Which platforms are supported?",
    a: "Windows, macOS and Linux (x64) desktops. Respondents use any modern browser. An experimental Android build can host from a phone: same Wi-Fi only, and the app must stay open.",
  },
  {
    q: "Can several people manage forms?",
    a: "Not with separate accounts yet. Each installation has one host password.",
  },
];

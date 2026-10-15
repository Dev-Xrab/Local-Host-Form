import dashboardImg from "./assets/screenshots/dashboard-home.jpg";
import builderImg from "./assets/screenshots/form-builder.jpg";
import sessionImg from "./assets/screenshots/session-share.jpg";
import respondentImg from "./assets/screenshots/respondent-view.jpg";
import leaderboardImg from "./assets/screenshots/leaderboard.jpg";

// All marketing copy lives here so it can be checked against the app in one place.
// Every claim below was verified against the app's source (see git history for details).

export const NAV_LINKS = [
  { id: "how-it-works", label: "How it works" },
  { id: "features", label: "Features" },
  { id: "live-demo", label: "See it live" },
  { id: "self-hosting", label: "Self-hosting" },
  { id: "who-its-for", label: "Who it's for" },
  { id: "faq", label: "FAQ" },
];

export const SHOWCASE = [
  {
    id: "dashboard",
    tab: "Dashboard",
    src: dashboardImg,
    alt: "Self Host Form dashboard showing live sessions, the local server address with a join QR code, and form and folder counts",
    caption: "Your server address, live sessions and QR code in one place.",
  },
  {
    id: "builder",
    tab: "Form builder",
    src: builderImg,
    alt: "Form builder showing a quiz with the correct answer marked, a points field, and a sidebar of question types",
    caption: "11 question types, correct answers and points on every question.",
  },
  {
    id: "session",
    tab: "Live session",
    src: sessionImg,
    alt: "Session screen with the join code, QR code, live counts and a table of respondents with scores",
    caption: "Join code, QR and live respondent status while people answer.",
  },
  {
    id: "leaderboard",
    tab: "Leaderboard",
    src: leaderboardImg,
    alt: "Session leaderboard ranking respondents by score",
    caption: "Scores and ranks update the moment people submit.",
  },
];

export const FACTS = [
  "Forms, quizzes & surveys",
  "Join by code, link or QR",
  "Works on local Wi-Fi",
  "No respondent accounts",
  "Auto-graded answers",
  "Excel & PDF export",
  "Data stays on your machine",
  "16 ready-made templates",
  "One-click public link",
  "Dark, light & system themes",
];

export const STEPS = [
  {
    number: "01",
    title: "Build the form",
    text: "Pick from 11 question types plus section breaks, or start from one of 16 templates. For quizzes, mark the correct answer and set points so answers grade themselves.",
    image: builderImg,
    alt: "Form builder showing a quiz with a multiple choice question, the correct answer marked, a points field, and a sidebar listing every question type",
    label: "Form builder",
  },
  {
    number: "02",
    title: "Start a session and share the code",
    text: "A session gives your form a join code, a link and a QR code. Set an optional time limit, turn on fullscreen or tab-switch locks, and watch people join in real time.",
    image: sessionImg,
    alt: "Session screen showing the join code, a link and QR code, live respondent counts, an average score and a table of respondents with their status and score",
    label: "Sessions",
  },
  {
    number: "03",
    title: "Respond on any device",
    text: "People enter their name and the code in any modern browser on a phone, tablet or laptop. Time limits are tracked per person and enforced by the server, and in-progress answers survive a page reload.",
    image: respondentImg,
    alt: "The respondent-facing form showing a multiple choice question, a checkbox question and a short answer field, with a countdown timer at the top",
    label: "Respondent view",
  },
  {
    number: "04",
    title: "Review results and export",
    text: "Responses, scores, averages and a leaderboard update as answers come in. When the session ends, export to Excel or PDF, or combine several sessions into one workbook.",
    image: leaderboardImg,
    alt: "Session leaderboard ranking respondents by score, with score bars and submission times",
    label: "Leaderboard",
  },
];

// size: "lg" spans two columns in the bento grid on wide screens.
export const FEATURES = [
  {
    icon: "questionBank",
    title: "Form builder",
    text: "Short answer, paragraph, multiple choice, checkboxes, dropdown, linear scale, date, time, file upload and two grid types, plus section breaks and 16 ready-made templates.",
    size: "lg",
  },
  {
    icon: "checkCircle",
    title: "Automatic grading",
    text: "Multiple choice, dropdown, checkboxes, short answer and paragraph questions can be scored automatically, with per-question points and accepted answer variations for text.",
  },
  {
    icon: "users",
    title: "Live sessions",
    text: "Each session gets a join code, link and QR code. Add a per-person time limit enforced by the server, and watch respondents, submissions and average score update live.",
  },
  {
    icon: "trophy",
    title: "Leaderboard",
    text: "Rank a session's respondents by score as submissions arrive, or open any respondent to review their answers question by question.",
  },
  {
    icon: "shield",
    title: "Exam integrity tools",
    text: "For tests and assessments, require fullscreen, lock the screen with a countdown when someone switches tabs, and restrict copying and printing. These are deterrents, not a guarantee against a determined cheater.",
    size: "lg",
  },
  {
    icon: "bank",
    title: "Folders & rosters",
    text: "Organise forms into folders. Keep a roster with aliases so \"Jon\" and \"Jonathan D.\" match one person across sessions.",
  },
  {
    icon: "upload",
    title: "Bulk export",
    text: "Pick several finished sessions, see who responded to each, and export everything to a single Excel workbook. Uploaded files are bundled into a ZIP.",
  },
  {
    icon: "download",
    title: "Excel & PDF export",
    text: "Export any session's responses to Excel or PDF straight from your machine. Forms can also be exported and imported as files.",
  },
  {
    icon: "network",
    title: "Remote access",
    text: "Respondents outside your Wi-Fi? Start a temporary public link in one click, with no port forwarding or router setup. Stop it and the link goes down. Desktop app only.",
  },
  {
    icon: "cloud",
    title: "Google Forms import",
    text: "Optionally sign in with Google to import an existing Google Form and its responses, or publish forms to your account. The local app works fully without it.",
  },
  {
    icon: "database",
    title: "Private by default",
    text: "Responses live in a local database on your machine. The host password is created on first launch from the host computer itself, and login attempts are rate-limited.",
    size: "lg",
  },
  {
    icon: "devices",
    title: "Any device, any theme",
    text: "Respondents answer from a phone, tablet or laptop. The host interface adapts to each screen size and ships with dark, light and follow-system themes.",
  },
];

export const WHY = [
  { icon: "monitor", title: "Runs on your computer", text: "Install it on a Windows PC and it starts its own local server. Nothing to sign up for and nothing to subscribe to." },
  { icon: "database", title: "Data stays with you", text: "Forms and responses are stored in a local database on the host machine, not on a vendor's servers." },
  { icon: "wifiOff", title: "Works without internet", text: "Run a whole session over your office, venue or classroom Wi-Fi, even when the internet connection is down." },
];

export const SELF_POINTS = [
  "Forms, responses and uploaded files are stored on the host machine. No account is needed to use the app.",
  "You choose the network: local Wi-Fi, a LAN, or a temporary public link when people are remote.",
  "You start, end and reopen every session yourself, and nothing external can change that.",
];

export const COMPARISON = [
  ["Where it runs", "On the provider's servers", "On a computer you own"],
  ["Where responses live", "In the provider's database", "In a local database on your machine"],
  ["Respondent sign-in", "Depends on the provider and plan", "None. People join with a code and a name"],
  ["Internet required", "Yes, for everyone", "No. Local Wi-Fi is enough"],
  ["Remote respondents", "Always reachable online", "Optional temporary public link"],
  ["Test controls", "Depends on the provider", "Fullscreen gate, tab-switch lock, copy restrictions"],
];

export const AUDIENCES = [
  {
    id: "educators",
    title: "Educators & trainers",
    text: "Run a quiz, check-in or assessment over your own Wi-Fi. Multiple choice, checkbox, dropdown and short-answer questions grade themselves, you see who has finished as it happens, and participants never need an account. Turn on fullscreen and tab-switch locks when you want test conditions.",
    examples: ["Quizzes", "Exit tickets", "Training checks"],
  },
  {
    id: "events",
    title: "Events & communities",
    text: "Collect RSVPs, sign-ups and feedback at a venue, a meetup or a club night, even with patchy internet. Share a QR code on a screen, let people answer on their phones, and export the list to Excel afterwards.",
    examples: ["RSVPs", "Sign-up sheets", "Event feedback"],
  },
  {
    id: "teams",
    title: "Teams & organisations",
    text: "Use the built-in templates for registration, applications, time-off requests and feedback, and keep the responses on a machine your own team manages. Rosters match differently typed names to the same person, and bulk export collects many sessions into one workbook.",
    examples: ["Internal surveys", "Registrations", "Intake forms"],
  },
  {
    id: "developers",
    title: "Developers",
    text: "A Node and Express server with SQLite, packaged as a desktop app or run standalone. The source is available to read and contribute to, and free to run for personal and educational use. Commercial use and redistribution need permission.",
    examples: ["Source-available", "Node + SQLite", "Self-hosted"],
  },
];

export const FAQS = [
  { q: "What is Self Host Form?", a: "A form, quiz and survey builder that runs on your own computer. You build a form, start a session, people join with a code, and the responses are stored on your machine instead of a third-party service." },
  { q: "What can I use it for?", a: "Anything that collects answers from people in the same place or on the same network: quizzes and tests, surveys, event RSVPs and registrations, feedback forms, applications, sign-up sheets and internal polls." },
  { q: "Is it free?", a: "It's free to run for personal, educational and internal institutional use. The source is available to read, but it isn't open source. You can't redistribute or sell it, offer it as a hosted service, or use it commercially without permission." },
  { q: "Is it similar to Google Forms?", a: "The basics are the same: build a form, share it, collect responses. The differences are that it runs on your own computer, works over a local network without internet, and is built around live sessions with join codes, time limits, grading and test controls." },
  { q: "Which platforms does it run on?", a: "The installer is for Windows. Respondents can answer from any device with a modern browser. There is also an experimental Android build that can host from a phone, with some limits: no public link, and the app must stay open during a session." },
  { q: "Where is my data stored?", a: "In a local SQLite database on the computer running the app. Nothing is sent to a cloud service unless you choose to connect a Google account." },
  { q: "Do respondents need an account?", a: "No. They open the link, scan the QR code or type the session code, enter a name, email or N/A, and answer. Only the host needs a password." },
  { q: "What question types are supported?", a: "Short answer, paragraph, multiple choice, checkboxes, dropdown, linear scale, date, time, file upload, multiple choice grid and checkbox grid, plus section breaks. There are also 16 templates for common forms." },
  { q: "How does grading work?", a: "Mark the correct answer and set points on multiple choice, dropdown, checkboxes, short answer or paragraph questions. Text questions accept a list of correct variations. Scores are calculated on the server when someone submits, and the session shows averages and a leaderboard. Forms without answer keys simply collect responses." },
  { q: "Can I run timed tests and stop cheating?", a: "You can set a time limit per person, require fullscreen, lock the screen with a countdown when someone switches tabs, and restrict copying and printing. These are deterrents that work in the browser and desktop app. They are not a guarantee against a determined cheater." },
  { q: "What if people aren't on my Wi-Fi?", a: "In the desktop app you can start a temporary public link with one click. It uses a Cloudflare tunnel, so there's no port forwarding or router setup. Stopping it or closing the app takes the link down, and the host login isn't reachable through it." },
  { q: "Can I export results?", a: "Yes. Export a session to Excel or PDF, or pick several finished sessions and export them into one Excel workbook, matched against your roster. Uploaded files are bundled into a ZIP with the workbook." },
  { q: "Can multiple people manage forms?", a: "Not with separate accounts yet. Each installation has a single host password, so sharing access means sharing that login. Per-person accounts and roles aren't built yet." },
  { q: "What does the optional Google account do?", a: "Signing in with Google lets you import an existing Google Form, with its responses if you want them, and publish forms to your account. It's an optional layer that is currently in beta with limited access. The local app doesn't need it." },
  { q: "Can I run it on a server?", a: "Yes. The Node and Express server that powers the desktop app can run on its own and serve the web UI, so you can host it on a machine you manage." },
];

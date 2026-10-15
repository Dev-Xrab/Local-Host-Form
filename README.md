# Self Host Form

A desktop app for teachers to build forms, quizzes, and exams and host them from their own computer. Students answer in a browser on the same network, or over a public link through a Cloudflare tunnel. Responses stay on the host machine by default.

## Features

- **Form builder** with many question types, including matrix questions, file uploads, and templates
- **Subjects, rosters, and sessions** to organize classes and track who answered
- **Automatic grading** and response analytics
- **Exam integrity tools**: fullscreen gate, refocus lock, and connection overlays for respondents
- **Exports** to Excel, PDF, and ZIP
- **Public links** through a built-in Cloudflare tunnel, with no port forwarding needed
- **Optional cloud sync** and Google Forms import through the separate `cloud-server`

## Tech stack

React Native (Expo + expo-router, rendered to the web with React Native Web) · TypeScript · Express 5 · Electron · SQLite (Node's built-in `node:sqlite`) · Zustand · PostgreSQL (cloud server only)

## Getting started

Requires **Node.js 22.5 or newer**.

```bash
git clone https://github.com/Dev-Xrab/self-host-form-app.git
cd self-host-form-app
npm install
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Expo dev server for the web UI (port 8081; proxies `/api` to the local server) |
| `npm run server` | Start the local API server with auto-reload (port 5174) |
| `npm run build` | Export the web UI into `dist/`, which the Express server and Electron serve |
| `npm run start` | Serve the built UI and API from one process on port 5174 |
| `npm run desktop` | Launch the Electron desktop app (run `npm run build` first) |
| `npm run dist` | Build the UI and installers into `release/` |
| `npm run lint` | Lint with oxlint |
| `npm run typecheck` | Type-check the TypeScript UI |
| `npm test` | Run the unit tests (Vitest) |

For day-to-day UI work run `npm run server` and `npm run dev` together, then open http://localhost:8081.

### Cloud server (optional)

The cloud server handles sync and Google sign-in. It needs PostgreSQL and a Google OAuth client.

```bash
cd cloud-server
npm install
cp .env.example .env   # then fill in the values
cd ..
npm run cloud-server
```

Never commit `cloud-server/.env`.

## Project layout

```
electron/      Electron main process, preload, and splash screen
server/        Local Express API (auth, forms, responses, sessions, tunnel, ...)
cloud-server/  Optional central sync server (PostgreSQL + Google OAuth)
app/           Screens and routes (expo-router; URLs match the old app: /dashboard, /forms/:id, /s/:code)
components/    App-level components: shell, editor, respondent flow, sessions, settings
ui/            Design system: tokens, theme, Text, Button, TextField, Dialog, Select, ...
lib/           Typed wrappers and platform helpers (.web.ts / .ts splits for web-only features)
src/           Shared logic reused unchanged: API clients, data hooks, grading and export utils
store/         Zustand stores
tests/         Unit tests
scripts/       Build helper scripts
```

## UI architecture

The UI is React Native, so the same components can target web, desktop (Electron loads the web export) and, later, Android and iOS.

- **Design system** in `ui/`: all colors, type sizes, radii and spacing live in `ui/tokens.ts`. Dark is the default theme, with a light theme and follow-system option under Settings > Appearance. Screens do not use raw colors or sizes.
- **Layouts differ by size**, not just scale: a sidebar on desktop, an icon rail on tablets, and a bottom tab bar plus bottom-sheet dialogs on phones.
- **Platform splits** use `.web.ts(x)` beside a default file. Web-only: fullscreen and copy protection on the respondent screen, Excel/PDF exports and file downloads, the Electron title bar.
- **Backend untouched**: the Express API, database and auth are unchanged. The UI still talks to same-origin `/api/*` with the session cookie.

### Hosting on a phone (Android)

The mobile app can be the host, the same way the desktop app is: it runs the real server code (`server/`) inside the app, stores everything on the phone, serves the web UI to students on the same Wi-Fi, and syncs to your cloud account when it's online. Choose **Host on this phone** the first time you open the app, or **connect to a host computer** to use a desktop as the host.

How it works (no code is duplicated; `mobile-server/` only supplies what Node provides on desktop):
- `server/createApp.js` builds the Express app; both `server/index.js` (desktop) and the phone call it.
- `mobile-server/http/` is a small Express-compatible framework plus an HTTP/1.1 parser over TCP (`react-native-tcp-socket`).
- `mobile-server/shims/` replace `node:sqlite` (with `expo-sqlite`), `node:crypto` (pure-JS scrypt/sha256, byte-identical to Node's), `express-rate-limit`, `helmet` and a few others. Metro swaps them in for imports made from `server/`, on native builds only.
- The web UI is zipped into the app (`npm run pack:web-ui`) and served from memory.
- A foreground service (`modules/host-service`) keeps hosting alive when the app is in the background.

Build and run on a phone: `npm run build && npm run pack:web-ui`, then `npx expo run:android` (a phone with USB debugging, or an emulator). Tests: `npm run test:phone` runs the API smoke test and the HTTP edge-case suite against the phone runtime in Node.

**Phone hosting limits**
- Remote access through the Cloudflare tunnel is desktop-only. Students must be on the same Wi-Fi as the phone (or use your cloud sync).
- Keep the app open during a session. Android keeps it running in the background with a notification; iOS suspends background apps, so on iOS the app must stay in the foreground.
- Signing in with Google opens your phone's browser and returns to the app's own server on the phone.
- Logging in is slower on a phone (password hashing runs in JavaScript).

### Not yet supported
- **Android / iOS builds have not been run on a device by the author of this section.** The Android APK compiles; see the phone-hosting notes above for what was verified.
- Excel/PDF export, file downloads and the "download my answers" PDF are web and desktop only.
- Printing a single response from the respondent detail dialog was dropped; use the PDF export.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) to get started, and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

To report a security vulnerability, see [SECURITY.md](SECURITY.md). Please don't open a public issue for it.

## License

This project is **source-available, not open source.** You can view the code, run it for personal or school use, and change it to send us contributions. You may **not** redistribute or sell it, or modified versions of it, without permission. See [LICENSE](LICENSE) for the full terms.

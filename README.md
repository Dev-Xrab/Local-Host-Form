# Self Host Form

A self-hosted, classroom-oriented form platform for creating forms, running timed response sessions on a local network, and grading the results — without depending on a third-party cloud service.

A host (teacher/admin) runs the app on one computer. Students on the same Wi-Fi/LAN — or anywhere, if the optional cloud sync is enabled — open a short session code or QR code in their browser and respond. No accounts are required on the student side.

> **Note:** This repository contains documentation only. The application's source code is maintained privately.

## Overview

Self Host Form started as a "Google Forms without the cloud" tool for classrooms: build a form, hand out a code, collect and grade responses, all from a machine the teacher controls. It has since grown into a small suite covering the full session lifecycle — building, distributing, monitoring, grading, and exporting.

It ships two ways:
- **As a desktop app** (Windows, via Electron) that bundles the server and opens straight to the UI — no terminal, no `npm install`.
- **As a Node/Express + React web app**, run directly on a host machine and reached from other devices over the LAN.

## Core Features

**Form building**
- Drag-and-organize form editor with sections and per-question settings
- Nine question types: short answer, paragraph, multiple choice, checkboxes, dropdown, linear scale, date, time, and file upload
- Per-question correct-answer/points configuration for auto-graded question types
- Subjects for grouping related forms

**Running a session**
- One-tap "start session" that generates a short access code and a scannable QR code
- Live session control (open/close responses, see respondents arrive in real time)
- Works purely over LAN — the host machine's local IP is detected and displayed automatically, distinguishing real Wi-Fi/Ethernet adapters from virtual ones (VPNs, VMs, WSL) so the address shown is one students can actually reach

**Responding**
- No student account needed — join with a code or QR scan, answer, submit
- Optional roster matching, so submissions can be tied to a known student list

**Grading & records**
- Automatic scoring for objective question types, manual override where needed
- A gradebook view aggregating scores across sessions per student, exportable to Excel
- Per-session response review and CSV/PDF/Excel export, including bulk export across sessions

**Accounts & access**
- Separate host and respondent login flows
- Host password recovery flow
- Session-scoped access — respondents only ever see the form they joined, never the dashboard

**Optional cloud sync**
- A small companion service that can sync forms/responses across devices for a host who uses more than one machine
- Google OAuth–based import of existing Google Forms into Self Host Form, so a teacher doesn't have to rebuild forms that already exist
- Entirely optional: the core app works fully offline/LAN-only without it

## Architecture

```text
                     Host Computer
                          |
                 +-------------------+
                 |   Express Server  |
                 |  (forms, sessions,|
                 |  roster, grading, |
                 |  auth)            |
                 +---------+---------+
                          |
                 Local network / Wi-Fi
                 +--------+---------+
                 |        |         |
                 v        v         v
             Student  Student   Student
             Device   Device    Device
                 (browser, via
                  code or QR)
```

- **Frontend:** React (Vite), client-side routed, talking to the local server over `/api`.
- **Server:** Express, serving both the built frontend and the JSON API from a single process/port, so the whole app is one thing to run.
- **Desktop shell:** Electron spawns the same Express server as a child process, waits for it to become healthy, then opens a window pointed at `localhost`. Closing the app shuts the server down with it.
- **Storage:** Local, on the host machine — no data leaves the network unless cloud sync is explicitly enabled.
- **Cloud sync (optional):** A separate lightweight server that the desktop app talks to for cross-device sync and Google Forms import; it is not required for local/offline use and only ever contacted for that specific feature.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, React Router, Zustand |
| Build tooling | Vite |
| Backend | Node.js, Express |
| Desktop packaging | Electron, electron-builder |
| Exports | ExcelJS / SheetJS, jsPDF, JSZip |
| QR codes | qrcode |
| Optional cloud sync | Node.js/Express service with Google OAuth (PKCE) integration |

## Status

Actively developed. Recent/ongoing focus areas include the gradebook and roster-matching workflow, bulk export, QR-code session joining, and the optional Google Forms cloud-sync integration.

## License

MIT.

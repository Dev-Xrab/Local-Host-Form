// Single source of truth for external links, so a repo move or a new release
// only needs an edit here instead of a hunt across every component.

// The app's own repo (server, Electron, everything) — not this website's repo.
export const APP_REPO_URL = "https://github.com/Dev-Xrab/Local-Host-Form";

// GitHub's "latest release" alias always resolves to whichever release is
// currently marked latest, as long as its asset keeps this exact filename —
// so shipping a new version only means uploading a new release asset named
// Self-Host-Form-Setup.exe, never touching this URL or any component.
export const WINDOWS_DOWNLOAD_URL =
  "https://github.com/Dev-Xrab/Local-Host-Form/releases/latest/download/Self-Host-Form-Setup.exe";

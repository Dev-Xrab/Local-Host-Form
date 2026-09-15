// Single source of truth for external links, so a repo move or a new release
// only needs an edit here instead of a hunt across every component.

// The app's own repo (server, Electron, everything) — not this website's repo.
export const APP_REPO_URL = "https://github.com/Dev-Xrab/Local-Host-Form";

// Served directly from this site's public/downloads folder (see the README
// there) — shipping a new version only means replacing that file with the
// same name and pushing, never touching this URL or any component.
export const WINDOWS_DOWNLOAD_URL = "/downloads/Self-Host-Form-Setup.exe";

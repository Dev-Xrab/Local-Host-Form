// Single source of truth for external links, so a repo move or a new release
// only needs an edit here instead of a hunt across every component.

// GitHub's "latest release" alias always resolves to whichever release is
// currently marked latest, as long as its asset keeps this exact filename —
// so shipping a new version only means uploading a new release asset named
// Self-Host-Form-Setup.exe, never touching this URL or any component. (Not
// a local downloads folder: GitHub rejects any git blob over 100MB, and the
// installer is well past that.)
export const WINDOWS_DOWNLOAD_URL =
  "https://github.com/Dev-Xrab/Local-Host-Form/releases/latest/download/Self-Host-Form-Setup.exe";

// Same pattern for the Android build: upload the APK to the latest release as
// Self-Host-Form.apk and this link follows it.
export const ANDROID_DOWNLOAD_URL =
  "https://github.com/Dev-Xrab/Local-Host-Form/releases/latest/download/Self-Host-Form.apk";

export const RELEASE_VERSION = "v1.2.0";

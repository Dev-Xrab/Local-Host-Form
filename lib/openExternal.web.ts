// Browser: a new tab. Electron's window-open handler routes anything off-origin to the OS browser.
export async function openExternal(url: string): Promise<void> {
  window.open(url, "_blank", "noopener,noreferrer");
}

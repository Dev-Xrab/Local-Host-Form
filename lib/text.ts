/**
 * A name collapsed onto one line: line breaks, tabs and runs of spaces become a single space, and the
 * ends are trimmed. Names such as a form title can contain a line break (pasted text, or Enter in the
 * title field). Dropped raw into a sentence like `Delete "<title>"?`, that splits the closing quote
 * and question mark onto a line of their own.
 */
export function oneLine(text?: string | null, fallback = ""): string {
  return (text ?? "").replace(/\s+/g, " ").trim() || fallback;
}

/**
 * What to show where a session's code normally goes. A placeholder session (responses synced from
 * another device, imported, or fetched from Google) has a label like "SYNCED-7F3A21B9", which looks
 * like a join code but is not one, so it is described instead of shown.
 */
export function sessionCodeLabel(session: { code: string; joinable?: boolean }): string {
  return session.joinable === false ? "Synced responses" : session.code;
}

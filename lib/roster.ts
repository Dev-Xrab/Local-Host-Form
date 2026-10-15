import { rosterApi } from "../src/features/roster/services/rosterApi";

export interface Student { id: string; name: string; studentId?: string; email?: string; aliases?: string[] }

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

interface ParsedStudent { name: string; studentId: string; email: string }

/** One student per line: "Name, Student ID, Email" (ID and email optional). Later lines win for the same name; a line with no name is ignored. */
export function parseRosterText(text: string): ParsedStudent[] {
  const byName = new Map<string, ParsedStudent>();
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [name, studentId, email] = line.split(",").map((p) => p.trim());
      if (!name) return;
      byName.set(norm(name), { name, studentId: studentId || "", email: email || "" });
    });
  return [...byName.values()];
}

export function rosterToText(students: Student[]): string {
  return students.map((s) => [s.name, s.studentId || "", s.email || ""].join(", ").replace(/(,\s*)+$/, "")).join("\n");
}

/**
 * The text box IS the roster: whatever is in it after an edit is what the roster becomes. Each run
 * re-reads the current roster from the server so the diff is never against a stale list.
 * studentId/email are sent as "" rather than omitted so a field cleared in the text clears the
 * stored value; aliases aren't in the text and are left untouched.
 */
export async function syncRoster(text: string): Promise<void> {
  const wanted = parseRosterText(text);
  const existing: Student[] = await rosterApi.list();
  const existingByName = new Map(existing.map((s) => [norm(s.name), s]));
  const wantedNames = new Set(wanted.map((w) => norm(w.name)));

  for (const w of wanted) {
    const current = existingByName.get(norm(w.name));
    if (!current) await rosterApi.create(w);
    else if ((current.studentId || "") !== w.studentId || (current.email || "") !== w.email || current.name !== w.name) await rosterApi.update(current.id, w);
  }
  for (const s of existing) if (!wantedNames.has(norm(s.name))) await rosterApi.remove(s.id);
}

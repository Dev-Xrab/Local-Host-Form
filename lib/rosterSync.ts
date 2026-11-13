import { rosterApi } from "../src/features/roster/services/rosterApi";
import { parseRosterText, type Student } from "./roster";

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

/** Applies the edited roster text against the latest server state. */
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

import { useState } from "react";
import { rosterApi } from "../services/rosterApi";

const norm = (s) => String(s ?? "").trim().toLowerCase();

// One student per line, comma-separated: "Name, alias one, alias two". A pasted line
// only ever touches that student's name+aliases — student ID and email (set once via
// the API/roster import elsewhere) are left alone, so re-pasting an updated list never
// wipes them out.
async function importRosterText(text, existingStudents) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let imported = 0;

  for (const line of lines) {
    const [namePart, ...aliasParts] = line.split(",").map((p) => p.trim());
    if (!namePart) continue;
    const aliases = aliasParts.filter(Boolean);

    const existing = existingStudents.find((s) => norm(s.name) === norm(namePart));
    if (existing) {
      await rosterApi.update(existing.id, { name: namePart, aliases });
    } else {
      await rosterApi.create({ name: namePart, aliases });
    }
    imported += 1;
  }

  return imported;
}

// The roster is what lets many differently-typed respondent names (e.g. "Jon" vs
// "Jonathan D.") fold into a single real student row in the Gradebook — a student's
// canonical name plus any aliases they might type when joining a session.
export default function RosterManager({ students, onChanged }) {
  const [pasteText, setPasteText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importedCount, setImportedCount] = useState(null);

  const handleImport = async () => {
    if (!pasteText.trim() || importing) return;
    setImporting(true);
    setImportError(null);
    setImportedCount(null);
    try {
      const count = await importRosterText(pasteText, students);
      setImportedCount(count);
      onChanged();
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="roster-manager">
      <div className="roster-paste-block">
        <span className="dash-form-label">Paste roster</span>
        <p className="dash-item-meta roster-paste-hint">
          One student per line. Name first, then any aliases, separated by commas — e.g. "Juan Dela Cruz, JC,
          Juan D".
        </p>
        <textarea
          className="dash-form-input roster-paste-textarea"
          placeholder={"Juan Dela Cruz, JC, Juan D\nMaria Santos, Mars"}
          value={pasteText}
          onChange={(e) => {
            setPasteText(e.target.value);
            setImportedCount(null);
          }}
          rows={4}
        />
        <div className="roster-paste-actions">
          <button type="button" className="dash-primary-btn" onClick={handleImport} disabled={importing}>
            {importing ? "Importing…" : "Import Roster"}
          </button>
          {importedCount !== null && (
            <span className="dash-settings-note dash-settings-note-success">
              Added/updated {importedCount} student{importedCount === 1 ? "" : "s"}.
            </span>
          )}
        </div>
        {importError && <p className="dash-form-error">{importError}</p>}
        {students.length === 0 && (
          <p className="dash-item-meta roster-empty-note">
            No students yet. Paste your roster above — their aliases let different names they type when joining
            a session fold into this one gradebook row, and only students on this list appear once a roster is
            set.
          </p>
        )}
      </div>
    </div>
  );
}

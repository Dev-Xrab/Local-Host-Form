import { useState } from "react";
import { rosterApi } from "../services/rosterApi";
import { Icons } from "../../../pages/dashboard-page/icons";

const norm = (s) => String(s ?? "").trim().toLowerCase();

// One student per line: "Name, Student ID, Email" — ID and email are both optional. A
// field left blank on a re-pasted line leaves that student's existing value alone (so
// re-pasting an updated list never wipes out an ID/email set some other way); aliases
// aren't touched by paste at all.
async function importRosterText(text, existingStudents) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let imported = 0;

  for (const line of lines) {
    const [namePart, idPart, emailPart] = line.split(",").map((p) => p.trim());
    if (!namePart) continue;

    const payload = {
      name: namePart,
      ...(idPart ? { studentId: idPart } : {}),
      ...(emailPart ? { email: emailPart } : {}),
    };

    const existing = existingStudents.find((s) => norm(s.name) === norm(namePart));
    if (existing) {
      await rosterApi.update(existing.id, payload);
    } else {
      await rosterApi.create(payload);
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
  const [removingId, setRemovingId] = useState(null);
  const [removeError, setRemoveError] = useState(null);

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

  const handleRemove = async (student) => {
    setRemovingId(student.id);
    setRemoveError(null);
    try {
      await rosterApi.remove(student.id);
      onChanged();
    } catch (err) {
      setRemoveError(err.message);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="roster-manager">
      <div className="roster-paste-block">
        <span className="dash-form-label">Paste roster</span>
        <p className="dash-item-meta roster-paste-hint">
          One student per line: name, then optionally a student ID and email, separated by commas — e.g. "Juan
          Dela Cruz, 2021-0456, juan@school.edu".
        </p>
        <textarea
          className="dash-form-input roster-paste-textarea"
          placeholder={"Juan Dela Cruz, 2021-0456, juan@school.edu\nMaria Santos, 2021-0457"}
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
            No students yet. Paste your roster above — only students on this list appear in the Gradebook once a
            roster is set, and their aliases (editable via the API) let different names they type when joining a
            session fold into this one row.
          </p>
        )}
      </div>

      {students.length > 0 && (
        <div className="roster-table-wrap">
          <table className="roster-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Student ID</th>
                <th>Email</th>
                <th>Aliases</th>
                <th aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.studentId || "—"}</td>
                  <td>{s.email || "—"}</td>
                  <td>{s.aliases?.length ? s.aliases.join(", ") : "—"}</td>
                  <td className="roster-row-remove">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleRemove(s)}
                      disabled={removingId === s.id}
                      title={`Remove ${s.name}`}
                    >
                      <Icons.trash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {removeError && <p className="dash-form-error">{removeError}</p>}
        </div>
      )}
    </div>
  );
}

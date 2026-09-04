import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { useSessions } from "../../features/sessions/hooks/useSessions";
import { sessionsApi } from "../../features/sessions/services/sessionsApi";
import { useRoster, matchStudentByName } from "../../features/roster/hooks/useRoster";
import RosterManager from "../../features/roster/components/RosterManager";
import { Icons } from "./icons";
import PageHeader from "./PageHeader";

const average = (values) => {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
};

const percentage = (score, max) => (max ? Math.round((score / max) * 1000) / 10 : null);

function exportGradebook(sessions, rows) {
  const data = rows.map((row) => {
    const out = { Respondent: row.name };
    if (row.studentId) out["Student ID"] = row.studentId;
    sessions.forEach((s) => {
      const cell = row.scores[s.id];
      out[s.name || s.formTitle] = cell ? `${cell.score}/${cell.maxScore}` : "";
    });
    out.Average = row.averagePct != null ? `${row.averagePct}%` : "";
    return out;
  });
  const sheet = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Gradebook");
  XLSX.writeFile(wb, `gradebook-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export default function GradebookPage() {
  const { sessions: allSessions, loading } = useSessions();
  const endedSessions = allSessions.filter((s) => s.status === "ended");
  const { students, refresh: refreshRoster } = useRoster();

  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [respondentsBySession, setRespondentsBySession] = useState({});
  const [fetching, setFetching] = useState(false);
  const [includeNonRoster, setIncludeNonRoster] = useState(false);

  const filteredSessions = endedSessions.filter((s) =>
    `${s.name || ""} ${s.formTitle || ""}`.toLowerCase().includes(query.toLowerCase())
  );
  const selectedSessions = endedSessions.filter((s) => selectedIds.includes(s.id));

  useEffect(() => {
    if (selectedIds.length === 0) return;
    setFetching(true);
    Promise.all(selectedIds.map((id) => sessionsApi.respondents(id).then((r) => [id, r])))
      .then((pairs) => setRespondentsBySession(Object.fromEntries(pairs)))
      .finally(() => setFetching(false));
  }, [selectedIds]);

  const toggleSession = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // One row per distinct student across the selected sessions. A respondent's typed
  // name is first resolved against the roster (by exact name or alias) so that e.g.
  // "Jon" and "Jonathan D." from different sessions land in the same row; anyone not
  // on the roster still gets their own row, keyed by whatever name they typed.
  //
  // Every roster student gets a row even if they never submitted anything — a roster
  // student is a known, expected participant, so a session they skipped counts as a
  // 0 (out of that session's max), not a blank. Non-roster respondents don't get that
  // treatment since they're not a known/expected list, just whoever happened to join.
  const rows = (() => {
    const byKey = new Map();
    students.forEach((s) => {
      byKey.set(`student:${s.id}`, { name: s.name, studentId: s.studentId || "", matched: true, scores: {} });
    });

    const maxScoreBySession = {};
    selectedSessions.forEach((session) => {
      (respondentsBySession[session.id] || [])
        .filter((r) => r.status === "submitted")
        .forEach((r) => {
          const match = matchStudentByName(students, r.respondentName);
          const key = match ? `student:${match.id}` : `name:${(r.respondentName || "").trim().toLowerCase()}`;
          if (!key || key === "name:") return;
          if (!byKey.has(key)) {
            byKey.set(key, {
              name: match ? match.name : r.respondentName,
              studentId: match?.studentId || "",
              matched: !!match,
              scores: {},
            });
          }
          byKey.get(key).scores[session.id] = { score: r.score, maxScore: r.maxScore };
          if (r.maxScore != null) maxScoreBySession[session.id] = r.maxScore;
        });
    });

    byKey.forEach((row) => {
      if (!row.matched) return;
      selectedSessions.forEach((session) => {
        if (row.scores[session.id] || maxScoreBySession[session.id] == null) return;
        row.scores[session.id] = { score: 0, maxScore: maxScoreBySession[session.id] };
      });
    });

    return Array.from(byKey.values())
      .map((row) => {
        const pcts = Object.values(row.scores)
          .map((s) => percentage(s.score, s.maxScore))
          .filter((p) => p != null);
        return { ...row, averagePct: average(pcts) };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  // With no roster entered, there's nothing to scope to — show/export everyone. Once
  // students are on the roster, only they appear (both on screen and in the export)
  // unless the host explicitly opts back in via the toggle.
  const hasRoster = students.length > 0;
  const displayRows = hasRoster && !includeNonRoster ? rows.filter((r) => r.matched) : rows;

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Gradebook"
        subtitle="Pick ended sessions to see and export respondent scores across them."
      />

      <div className="dash-content">
        <div className="dash-card gradebook-roster-card">
          <span className="dashboard-card-label">Roster</span>
          <div className="gradebook-roster-panel">
            <RosterManager students={students} onChanged={refreshRoster} />
          </div>

          <span className="dashboard-card-label">Sessions</span>
          <div className="dash-search dash-page-search gradebook-search">
            <Icons.search className="dash-search-icon" />
            <input
              type="text"
              placeholder="Search sessions..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {loading ? (
            <p className="dash-item-meta">Loading sessions…</p>
          ) : endedSessions.length === 0 ? (
            <p className="dash-empty">No ended sessions yet — scores appear here once a session ends.</p>
          ) : filteredSessions.length === 0 ? (
            <p className="dash-empty">No sessions match "{query}".</p>
          ) : (
            <div className="gradebook-session-picker">
              {filteredSessions.map((s) => (
                <label className="bulk-checkbox-row" key={s.id}>
                  <input
                    type="checkbox"
                    className="dash-checkbox"
                    checked={selectedIds.includes(s.id)}
                    onChange={() => toggleSession(s.id)}
                  />
                  <span className="quiz-name">{s.name || "Untitled session"}</span>
                  <span className="dash-item-meta">{s.formTitle} · {s.submittedCount} submitted</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {selectedSessions.length > 0 && (
          <>
            <div className="dash-card bulk-export-bar">
              <span className="dash-item-meta">
                {displayRows.length} respondent{displayRows.length === 1 ? "" : "s"} across {selectedSessions.length}{" "}
                session{selectedSessions.length === 1 ? "" : "s"}
              </span>

              <div className="bulk-export-bar-actions">
                {hasRoster && (
                  <label className="gradebook-roster-toggle">
                    <input
                      type="checkbox"
                      className="dash-checkbox"
                      checked={includeNonRoster}
                      onChange={(e) => setIncludeNonRoster(e.target.checked)}
                    />
                    Include non-roster respondents
                  </label>
                )}

                <button
                  type="button"
                  className="dash-primary-btn"
                  disabled={displayRows.length === 0}
                  onClick={() => exportGradebook(selectedSessions, displayRows)}
                >
                  <Icons.download />
                  Export
                </button>
              </div>
            </div>

            <div className="dash-card gradebook-table-wrap">
              {fetching ? (
                <p className="dash-empty">Loading scores…</p>
              ) : (
                <table className="gradebook-table">
                  <thead>
                    <tr>
                      <th>Respondent</th>
                      {selectedSessions.map((s) => (
                        <th key={s.id}>{s.name || s.formTitle}</th>
                      ))}
                      <th>Average</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.length === 0 ? (
                      <tr>
                        <td colSpan={selectedSessions.length + 2} className="dash-empty">
                          {hasRoster && !includeNonRoster
                            ? "None of the submitted respondents match a student on the roster."
                            : "No submitted responses in the selected sessions yet."}
                        </td>
                      </tr>
                    ) : (
                      displayRows.map((row) => (
                        <tr key={row.matched ? `s-${row.studentId || row.name}` : row.name}>
                          <td>
                            {row.name}
                            {row.matched && <span className="gradebook-roster-badge">Roster</span>}
                          </td>
                          {selectedSessions.map((s) => (
                            <td key={s.id} className="gradebook-score-cell">
                              {row.scores[s.id] ? `${row.scores[s.id].score}/${row.scores[s.id].maxScore}` : "—"}
                            </td>
                          ))}
                          <td className="gradebook-score-cell gradebook-average-cell">
                            {row.averagePct != null ? `${row.averagePct}%` : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

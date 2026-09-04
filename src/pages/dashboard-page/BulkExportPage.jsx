import { useEffect, useRef, useState } from "react";
import { useSessions } from "../../features/sessions/hooks/useSessions";
import { sessionsApi } from "../../features/sessions/services/sessionsApi";
import { useSubjects } from "../../features/subjects/hooks/useSubjects";
import { exportSessionsToWorkbook } from "../../features/sessions/utils/export";
import { Icons } from "./icons";
import PageHeader from "./PageHeader";

const groupBySubject = (sessions, subjects) => {
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const map = new Map();
  sessions.forEach((s) => {
    const label = s.subjectId && subjectById.has(s.subjectId) ? subjectById.get(s.subjectId).name : "No subject";
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(s);
  });
  return Array.from(map.entries());
};

const SectionCheckbox = ({ checked, indeterminate, onChange }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" className="dash-checkbox" checked={checked} onChange={onChange} />;
};

export default function BulkExportPage() {
  const { sessions: allSessions, loading } = useSessions();
  const { subjects } = useSubjects();
  const endedSessions = allSessions.filter((s) => s.status === "ended");
  const [selected, setSelected] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [query, setQuery] = useState("");

  const searchedSessions = endedSessions.filter((s) =>
    `${s.name || ""} ${s.formTitle || ""}`.toLowerCase().includes(query.toLowerCase())
  );
  const sections = groupBySubject(searchedSessions, subjects);

  const toggleSession = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSection = (sectionSessions) => {
    const ids = sectionSessions.map((s) => s.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(endedSessions.map((s) => s.id)));
  const clearAll = () => setSelected(new Set());

  const selectedSessions = endedSessions.filter((s) => selected.has(s.id));

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const data = await Promise.all(selectedSessions.map((s) => sessionsApi.exportData(s.id)));
      await exportSessionsToWorkbook(data);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Bulk Export"
        subtitle="Export results from multiple ended sessions into one Excel workbook."
      />

      <div className="dash-content">
        <div className="dash-card bulk-export-bar">
          <span className="dash-item-meta">
            {selectedSessions.length === 0
              ? "No sessions selected"
              : `${selectedSessions.length} session${selectedSessions.length === 1 ? "" : "s"} selected`}
          </span>

          <div className="bulk-export-bar-actions">
            <button type="button" className="dash-ghost-btn" onClick={selectAll}>
              Select all
            </button>
            <button type="button" className="dash-ghost-btn" onClick={clearAll}>
              Clear
            </button>
            <button
              type="button"
              className="dash-primary-btn"
              disabled={selectedSessions.length === 0 || exporting}
              onClick={handleExport}
            >
              <Icons.download />
              {exporting ? "Exporting…" : "Export Selected"}
            </button>
          </div>
        </div>

        {exportError && <p className="dash-form-error">{exportError}</p>}

        <div className="dash-search dash-page-search">
          <Icons.search className="dash-search-icon" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="dash-empty">Loading sessions…</p>
        ) : endedSessions.length === 0 ? (
          <p className="dash-empty">No ended sessions yet — results appear here once a session ends.</p>
        ) : sections.length === 0 ? (
          <p className="dash-empty">No sessions match "{query}".</p>
        ) : (
          sections.map(([label, sectionSessions]) => {
            const ids = sectionSessions.map((s) => s.id);
            const selectedCount = ids.filter((id) => selected.has(id)).length;

            return (
              <div className="dash-card bulk-section" key={label}>
                <div className="bulk-section-header">
                  <label className="bulk-checkbox-row">
                    <SectionCheckbox
                      checked={selectedCount === ids.length}
                      indeterminate={selectedCount > 0 && selectedCount < ids.length}
                      onChange={() => toggleSection(sectionSessions)}
                    />
                    <span className="bulk-section-title">{label}</span>
                  </label>
                  <span className="dash-item-meta">
                    {sectionSessions.length} session{sectionSessions.length === 1 ? "" : "s"}
                  </span>
                </div>

                {sectionSessions.map((s) => (
                  <label className="bulk-checkbox-row bulk-quiz-row" key={s.id}>
                    <input
                      type="checkbox"
                      className="dash-checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggleSession(s.id)}
                    />
                    <span className="quiz-name">{s.name || "Untitled session"}</span>
                    <span className="dash-item-meta">{s.formTitle} · {s.submittedCount} submitted</span>
                  </label>
                ))}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

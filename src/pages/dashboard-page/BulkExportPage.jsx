import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import useDashboardStore from "../../../store/useDashboardStore";
import { Icons } from "./icons";
import PageHeader from "./PageHeader";
import { STATUS_LABEL, QUIZ_STATUS_LABEL, sortParticipants } from "./resultsUtils";

const groupByCode = (quizzes) => {
  const map = new Map();
  quizzes.forEach((q) => {
    const key = q.code || "Uncategorized";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(q);
  });
  return Array.from(map.entries());
};

const sanitizeSheetName = (name) => name.replace(/[:\\/?*[\]]/g, "").trim().slice(0, 31) || "Sheet";

const uniqueSheetName = (base, used) => {
  let name = sanitizeSheetName(base);
  let i = 2;
  while (used.has(name)) {
    const suffix = ` (${i++})`;
    name = sanitizeSheetName(base).slice(0, 31 - suffix.length) + suffix;
  }
  used.add(name);
  return name;
};

const exportBulkWorkbook = (selectedQuizzes) => {
  const wb = XLSX.utils.book_new();

  const summaryRows = selectedQuizzes.map((q) => ({
    Section: q.code,
    Quiz: q.name,
    Status: QUIZ_STATUS_LABEL[q.status],
    "Students Joined": `${q.students}/${q.capacity}`,
    "Time Allotted (min)": q.timeAllotted,
    Submitted: (q.participants || []).filter((p) => p.status === "submitted").length,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Summary");

  const usedNames = new Set(["Summary"]);
  selectedQuizzes.forEach((q) => {
    const rows = sortParticipants(q.participants || [], "score").map((p) => ({
      Name: p.name,
      Email: p.email,
      Status: STATUS_LABEL[p.status],
      "Joined At": p.joinedAt,
      Score: p.score ?? "",
      "Time Taken": p.timeTaken ?? "",
    }));
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Name: "No participants yet" }]);
    XLSX.utils.book_append_sheet(wb, sheet, uniqueSheetName(`${q.code} ${q.name}`, usedNames));
  });

  XLSX.writeFile(wb, `bulk-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
};

const SectionCheckbox = ({ checked, indeterminate, onChange }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return <input ref={ref} type="checkbox" className="dash-checkbox" checked={checked} onChange={onChange} />;
};

export default function BulkExportPage() {
  const quizzes = useDashboardStore((s) => s.quizzes);
  const [selected, setSelected] = useState(() => new Set());

  const sections = groupByCode(quizzes);

  const toggleQuiz = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSection = (sectionQuizzes) => {
    const ids = sectionQuizzes.map((q) => q.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(quizzes.map((q) => q.id)));
  const clearAll = () => setSelected(new Set());

  const selectedQuizzes = quizzes.filter((q) => selected.has(q.id));
  const selectedSectionCount = new Set(selectedQuizzes.map((q) => q.code || "Uncategorized")).size;

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Bulk Export"
        subtitle="Export results from multiple quiz sections into one Excel workbook."
      />

      <div className="dash-content">
        <div className="dash-card bulk-export-bar">
          <span className="dash-item-meta">
            {selectedQuizzes.length === 0
              ? "No quizzes selected"
              : `${selectedQuizzes.length} quiz${selectedQuizzes.length === 1 ? "" : "zes"} selected across ${selectedSectionCount} section${selectedSectionCount === 1 ? "" : "s"}`}
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
              disabled={selectedQuizzes.length === 0}
              onClick={() => exportBulkWorkbook(selectedQuizzes)}
            >
              <Icons.download />
              Export Selected
            </button>
          </div>
        </div>

        {sections.map(([code, sectionQuizzes]) => {
          const ids = sectionQuizzes.map((q) => q.id);
          const selectedCount = ids.filter((id) => selected.has(id)).length;

          return (
            <div className="dash-card bulk-section" key={code}>
              <div className="bulk-section-header">
                <label className="bulk-checkbox-row">
                  <SectionCheckbox
                    checked={selectedCount === ids.length}
                    indeterminate={selectedCount > 0 && selectedCount < ids.length}
                    onChange={() => toggleSection(sectionQuizzes)}
                  />
                  <span className="bulk-section-title">{code}</span>
                </label>
                <span className="dash-item-meta">
                  {sectionQuizzes.length} quiz{sectionQuizzes.length === 1 ? "" : "zes"}
                </span>
              </div>

              {sectionQuizzes.map((q) => (
                <label className="bulk-checkbox-row bulk-quiz-row" key={q.id}>
                  <input
                    type="checkbox"
                    className="dash-checkbox"
                    checked={selected.has(q.id)}
                    onChange={() => toggleQuiz(q.id)}
                  />
                  <span className="quiz-name">{q.name}</span>
                  <span className="dash-item-meta">
                    {q.students}/{q.capacity} joined
                  </span>
                </label>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

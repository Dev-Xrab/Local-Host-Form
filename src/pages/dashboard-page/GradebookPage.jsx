import { useState } from "react";
import * as XLSX from "xlsx";
import useDashboardStore, { useDashboardActions } from "../../../store/useDashboardStore";
import { Icons } from "./icons";
import PageHeader from "./PageHeader";

let fallbackId = 0;
const nextId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `col-${Date.now()}-${fallbackId++}`;

const parseRoster = (text) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", email = "", studentId = ""] = line.split(",").map((s) => s.trim());
      return { id: nextId(), name, email, studentId };
    });

const rosterToText = (students) =>
  students.map((s) => [s.name, s.email, s.studentId].join(", ")).join("\n");

const scoreFor = (student, quiz) => {
  if (!quiz) return null;
  const match = (quiz.participants || []).find(
    (p) =>
      (student.studentId && p.studentId && student.studentId === p.studentId) ||
      (student.email && p.email && student.email.toLowerCase() === p.email.toLowerCase())
  );
  return match?.score ?? 0;
};

const average = (values) => {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
};

const quizLabel = (quiz) => (quiz ? `${quiz.code} — ${quiz.name}` : "");

const exportGradebook = (students, columns, quizzes) => {
  const rows = students.map((student) => {
    const row = {
      Name: student.name,
      Email: student.email,
      "Student ID": student.studentId,
    };

    const columnScores = [];
    columns.forEach((col) => {
      const quiz = quizzes.find((q) => String(q.id) === String(col.quizId));
      const score = scoreFor(student, quiz);
      row[quiz ? quizLabel(quiz) : "Unassigned column"] = score ?? "";
      if (score != null) columnScores.push(score);
    });

    row.Average = average(columnScores) ?? "";
    return row;
  });

  const sheet = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Gradebook");
  XLSX.writeFile(wb, `gradebook-${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export default function GradebookPage() {
  const students = useDashboardStore((s) => s.students);
  const quizzes = useDashboardStore((s) => s.quizzes);
  const { setStudents, removeStudent } = useDashboardActions();

  const [columns, setColumns] = useState([{ id: nextId(), quizId: "" }]);
  const [editingRoster, setEditingRoster] = useState(students.length === 0);
  const [rosterText, setRosterText] = useState("");

  const handleImport = () => {
    setStudents(parseRoster(rosterText));
    setRosterText("");
    setEditingRoster(false);
  };

  const handleEditRoster = () => {
    setRosterText(rosterToText(students));
    setEditingRoster(true);
  };

  const addColumn = () => setColumns((cols) => [...cols, { id: nextId(), quizId: "" }]);
  const removeColumn = (id) => setColumns((cols) => cols.filter((c) => c.id !== id));
  const setColumnQuiz = (id, quizId) =>
    setColumns((cols) => cols.map((c) => (c.id === id ? { ...c, quizId } : c)));

  const hasAssignedColumn = columns.some((c) => c.quizId);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Gradebook"
        subtitle="Build a custom score table by matching a student roster against any quizzes."
      />

      <div className="dash-content">
        {editingRoster ? (
          <div className="dash-card gradebook-roster-card">
            <span className="dashboard-card-label">Paste roster</span>
            <p className="dash-item-meta">One student per line: Name, Email, Student ID</p>

            <textarea
              className="dash-form-input dash-form-textarea gradebook-roster-input"
              rows={8}
              placeholder={"Maria Santos, maria.santos@school.edu, S-1006\nJuan Dela Cruz, juan.delacruz@school.edu, S-2001"}
              value={rosterText}
              onChange={(e) => setRosterText(e.target.value)}
              autoFocus
            />

            <div className="dash-modal-footer">
              {students.length > 0 && (
                <button type="button" className="dash-ghost-btn" onClick={() => setEditingRoster(false)}>
                  Cancel
                </button>
              )}
              <button type="button" className="dash-primary-btn" onClick={handleImport} disabled={!rosterText.trim()}>
                Import Roster
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="dash-card bulk-export-bar">
              <span className="dash-item-meta">
                {students.length} student{students.length === 1 ? "" : "s"} · {columns.length} column
                {columns.length === 1 ? "" : "s"}
              </span>

              <div className="bulk-export-bar-actions">
                <button type="button" className="dash-ghost-btn" onClick={addColumn}>
                  <Icons.plus />
                  Add Column
                </button>
                <button type="button" className="dash-ghost-btn" onClick={handleEditRoster}>
                  Edit Roster
                </button>
                <button
                  type="button"
                  className="dash-primary-btn"
                  disabled={!hasAssignedColumn}
                  onClick={() => exportGradebook(students, columns, quizzes)}
                >
                  <Icons.download />
                  Export
                </button>
              </div>
            </div>

            <div className="dash-card gradebook-table-wrap">
              <table className="gradebook-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Student ID</th>
                    {columns.map((col) => (
                      <th key={col.id} className="gradebook-col-header">
                        <div className="gradebook-col-header-row">
                          <select
                            className="dash-form-input gradebook-col-select"
                            value={col.quizId}
                            onChange={(e) => setColumnQuiz(col.id, e.target.value)}
                          >
                            <option value="">Select a quiz…</option>
                            {quizzes.map((q) => (
                              <option key={q.id} value={q.id}>
                                {quizLabel(q)}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Remove column"
                            onClick={() => removeColumn(col.id)}
                          >
                            <Icons.close />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th>Average</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length + 5} className="dash-empty">
                        No students in the roster.
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => {
                      const rowScores = columns
                        .map((col) => scoreFor(student, quizzes.find((q) => String(q.id) === String(col.quizId))))
                        .filter((v) => v != null);

                      return (
                        <tr key={student.id}>
                          <td>{student.name}</td>
                          <td className="dash-item-meta">{student.email}</td>
                          <td className="dash-item-meta">{student.studentId}</td>
                          {columns.map((col) => {
                            const quiz = quizzes.find((q) => String(q.id) === String(col.quizId));
                            const score = scoreFor(student, quiz);
                            return (
                              <td key={col.id} className="gradebook-score-cell">
                                {score ?? "—"}
                              </td>
                            );
                          })}
                          <td className="gradebook-score-cell gradebook-average-cell">
                            {average(rowScores) ?? "—"}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="icon-btn"
                              title="Remove student"
                              onClick={() => removeStudent(student.id)}
                            >
                              <Icons.trash />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}

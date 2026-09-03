import { useState } from "react";
import { Link } from "react-router-dom";
import useDashboardStore, { useDashboardActions } from "../../../store/useDashboardStore";
import { Icons } from "./icons";
import { Monogram, initial } from "./Monogram";
import PageHeader from "./PageHeader";
import Modal from "./Modal";

const emptyForm = { name: "", code: "", formId: "", capacity: "", timeAllotted: "" };

export default function QuizzesPage() {
  const quizzes = useDashboardStore((s) => s.quizzes);
  const forms = useDashboardStore((s) => s.forms);
  const { addQuiz } = useDashboardActions();

  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const filtered = quizzes.filter((q) => q.name.toLowerCase().includes(query.toLowerCase()));

  const handleField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const timeAllotted = Math.max(0, Number(form.timeAllotted) || 0);
    const capacity = Math.max(0, Number(form.capacity) || 0);
    addQuiz({
      name: form.name.trim(),
      code: form.code.trim(),
      formId: form.formId || null,
      capacity,
      timeAllotted,
      timeRemaining: `${String(timeAllotted).padStart(2, "0")}:00`,
    });

    setForm(emptyForm);
    setShowModal(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Quizzes"
        subtitle="View and manage every quiz on this server."
        action={
          <button type="button" className="dash-primary-btn" onClick={() => setShowModal(true)}>
            <Icons.plus />
            Add Quiz
          </button>
        }
      />

      <div className="dash-content">
        <div className="dash-search dash-page-search">
          <Icons.search className="dash-search-icon" />
          <input
            type="text"
            placeholder="Search quizzes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="dash-card quiz-table-card">
          <div className="quiz-table-header">
            <span>Quiz</span>
            <span>Students</span>
            <span className="quiz-col-allotted">Time Allotted</span>
            <span>Time Remaining</span>
            <span />
          </div>

          <div className="quiz-table-body quiz-table-body-full">
            {filtered.length === 0 ? (
              <p className="dash-empty">No quizzes found.</p>
            ) : (
              filtered.map((quiz) => (
                <div className="quiz-row" key={quiz.id}>
                  <div className="quiz-name-cell">
                    <Monogram label={initial(quiz.name)} size={32} />
                    <div className="quiz-name-text">
                      <span className="quiz-name">{quiz.name}</span>
                      <span className="quiz-code">{quiz.code}</span>
                    </div>
                  </div>

                  <span className="quiz-students">
                    {quiz.students} / {quiz.capacity}
                  </span>

                  <span className="quiz-time-allotted">{quiz.timeAllotted} min</span>

                  <div className="quiz-time-remaining">
                    <span className="quiz-time-pill">{quiz.timeRemaining}</span>
                    <div className="quiz-progress-track">
                      <div className="quiz-progress-fill" style={{ width: `${quiz.progress}%` }} />
                    </div>
                  </div>

                  <Link to={`/dashboard/quizzes/${quiz.id}`} className="quiz-open-btn">
                    Open
                    <Icons.arrowRight className="quiz-open-icon" />
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <Modal title="Add Quiz" onClose={() => setShowModal(false)}>
          <form className="dash-form" onSubmit={handleSubmit}>
            <label className="dash-form-field">
              <span className="dash-form-label">Quiz name</span>
              <input
                type="text"
                className="dash-form-input"
                placeholder="e.g. Programming Fundamentals"
                value={form.name}
                onChange={handleField("name")}
                autoFocus
              />
            </label>

            <label className="dash-form-field">
              <span className="dash-form-label">Subject code</span>
              <input
                type="text"
                className="dash-form-input"
                placeholder="e.g. IT 101"
                value={form.code}
                onChange={handleField("code")}
              />
            </label>

            <label className="dash-form-field">
              <span className="dash-form-label">Attach form</span>
              <select
                className="dash-form-input"
                value={form.formId}
                onChange={handleField("formId")}
              >
                <option value="">No form attached</option>
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="dash-form-row">
              <label className="dash-form-field">
                <span className="dash-form-label">Student capacity</span>
                <input
                  type="number"
                  min="0"
                  className="dash-form-input"
                  placeholder="50"
                  value={form.capacity}
                  onChange={handleField("capacity")}
                />
              </label>

              <label className="dash-form-field">
                <span className="dash-form-label">Time allotted (min)</span>
                <input
                  type="number"
                  min="0"
                  className="dash-form-input"
                  placeholder="60"
                  value={form.timeAllotted}
                  onChange={handleField("timeAllotted")}
                />
              </label>
            </div>

            <div className="dash-modal-footer">
              <button type="button" className="dash-ghost-btn" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" className="dash-primary-btn">
                Create Quiz
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

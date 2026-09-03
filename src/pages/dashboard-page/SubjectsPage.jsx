import { useState } from "react";
import useDashboardStore, { useDashboardActions } from "../../../store/useDashboardStore";
import { Icons } from "./icons";
import { Monogram, initial } from "./Monogram";
import PageHeader from "./PageHeader";
import Modal from "./Modal";

const emptyForm = { name: "", code: "" };

export default function SubjectsPage() {
  const subjects = useDashboardStore((s) => s.subjects);
  const { addSubject } = useDashboardActions();

  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const filtered = subjects.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  const handleField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    addSubject({ name: form.name.trim(), code: form.code.trim() });
    setForm(emptyForm);
    setShowModal(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Subjects"
        subtitle="Organize quizzes and forms by subject."
        action={
          <button type="button" className="dash-primary-btn" onClick={() => setShowModal(true)}>
            <Icons.plus />
            Add Subject
          </button>
        }
      />

      <div className="dash-content">
        <div className="dash-search dash-page-search">
          <Icons.search className="dash-search-icon" />
          <input
            type="text"
            placeholder="Search subjects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="dash-empty">No subjects found.</p>
        ) : (
          <div className="dash-card-grid">
            {filtered.map((subject) => (
              <div className="dash-item-card" key={subject.id}>
                <Monogram label={initial(subject.name)} />
                <span className="dash-item-title">{subject.name}</span>
                {subject.code && <span className="dash-item-subtitle">{subject.code}</span>}
                <span className="dash-item-divider" />
                <span className="dash-item-meta">Form Count: {subject.formCount}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="Add Subject" onClose={() => setShowModal(false)}>
          <form className="dash-form" onSubmit={handleSubmit}>
            <label className="dash-form-field">
              <span className="dash-form-label">Subject name</span>
              <input
                type="text"
                className="dash-form-input"
                placeholder="e.g. Data Structures"
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
                placeholder="e.g. CC104"
                value={form.code}
                onChange={handleField("code")}
              />
            </label>

            <div className="dash-modal-footer">
              <button type="button" className="dash-ghost-btn" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" className="dash-primary-btn">
                Create Subject
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

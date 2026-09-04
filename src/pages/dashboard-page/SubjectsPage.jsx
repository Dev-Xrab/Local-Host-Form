import { useState } from "react";
import { Link } from "react-router-dom";
import { useSubjects } from "../../features/subjects/hooks/useSubjects";
import { subjectsApi } from "../../features/subjects/services/subjectsApi";
import { Icons } from "./icons";
import { Monogram, initial } from "./Monogram";
import PageHeader from "./PageHeader";
import Modal from "./Modal";
import DeleteSubjectModal from "./DeleteSubjectModal";

const emptyForm = { name: "", code: "" };

export default function SubjectsPage() {
  const { subjects, loading, error, refresh } = useSubjects();

  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const filtered = subjects.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  const handleField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || creating) return;

    setCreating(true);
    setCreateError(null);
    try {
      await subjectsApi.create({ name: form.name.trim(), code: form.code.trim() });
      setForm(emptyForm);
      setShowModal(false);
      refresh();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleDeleteClick = (e, subject) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget(subject);
  };

  const handleDeleteConfirm = async (formsAction) => {
    await subjectsApi.remove(deleteTarget.id, formsAction);
    setDeleteTarget(null);
    refresh();
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Subjects"
        subtitle="Organize forms by subject."
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

        {loading ? (
          <p className="dash-empty">Loading subjects…</p>
        ) : error ? (
          <p className="dash-empty">Couldn't load subjects — {error}</p>
        ) : filtered.length === 0 ? (
          <p className="dash-empty">No subjects found.</p>
        ) : (
          <div className="dash-card-grid">
            {filtered.map((subject) => (
              <Link
                className="dash-item-card dash-item-card-link dash-item-card-removable"
                key={subject.id}
                to={`/dashboard/subjects/${subject.id}`}
              >
                {!subject.isDefault && (
                  <button
                    type="button"
                    className="dash-item-card-remove"
                    title="Delete subject"
                    onClick={(e) => handleDeleteClick(e, subject)}
                  >
                    <Icons.close />
                  </button>
                )}
                <Monogram label={initial(subject.name)} />
                <span className="dash-item-title">
                  {subject.name}
                  {subject.isDefault && <span className="dash-item-badge">Default</span>}
                </span>
                {subject.code && <span className="dash-item-subtitle">{subject.code}</span>}
                <span className="dash-item-divider" />
                <span className="dash-item-meta">Form Count: {subject.formCount}</span>
              </Link>
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

            {createError && <p className="dash-form-error">{createError}</p>}

            <div className="dash-modal-footer">
              <button type="button" className="dash-ghost-btn" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" className="dash-primary-btn" disabled={creating}>
                {creating ? "Creating…" : "Create Subject"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <DeleteSubjectModal
          subject={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </>
  );
}

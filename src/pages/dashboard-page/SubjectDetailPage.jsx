import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForms } from "../../features/forms/hooks/useForms";
import { formsApi } from "../../features/forms/services/formsApi";
import { useSubjects } from "../../features/subjects/hooks/useSubjects";
import { subjectsApi } from "../../features/subjects/services/subjectsApi";
import { Icons } from "./icons";
import { Monogram } from "./Monogram";
import Modal from "./Modal";
import DeleteSubjectModal from "./DeleteSubjectModal";
import ConfirmModal from "./ConfirmModal";

const emptyForm = { name: "", description: "" };

export default function SubjectDetailPage() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { subjects, refresh: refreshSubjects } = useSubjects();
  const { forms, loading, error, refresh: refreshForms } = useForms();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", code: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [showDeleteSubject, setShowDeleteSubject] = useState(false);
  const [deleteFormTarget, setDeleteFormTarget] = useState(null);

  const subject = subjects.find((s) => s.id === subjectId);
  const subjectForms = forms.filter((f) => f.subjectId === subjectId);

  useEffect(() => {
    if (subject) setEditForm({ name: subject.name || "", code: subject.code || "" });
  }, [subject]);

  const handleField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const handleEditField = (field) => (e) => setEditForm((f) => ({ ...f, [field]: e.target.value }));

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim() || saving) return;

    setSaving(true);
    setSaveError(null);
    try {
      await subjectsApi.update(subjectId, { name: editForm.name.trim(), code: editForm.code.trim() });
      setShowEditModal(false);
      refreshSubjects();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubjectConfirm = async (formsAction) => {
    await subjectsApi.remove(subjectId, formsAction);
    navigate("/dashboard/subjects");
  };

  const handleDeleteFormConfirm = async () => {
    await formsApi.remove(deleteFormTarget.id);
    setDeleteFormTarget(null);
    refreshForms();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || creating) return;

    setCreating(true);
    setCreateError(null);
    try {
      const created = await formsApi.create({
        title: form.name.trim(),
        description: form.description.trim(),
        subjectId,
      });
      setForm(emptyForm);
      setShowModal(false);
      navigate(`/forms/${created.id}`);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (!loading && !subject) {
    return (
      <>
        <header className="dash-header">
          <Link to="/dashboard/subjects" className="dash-back-link">
            <Icons.arrowLeft />
            Back to Subjects
          </Link>
        </header>
        <div className="dash-content">
          <p className="dash-empty">This subject couldn't be found.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="dash-header">
        <Link to="/dashboard/subjects" className="dash-back-link">
          <Icons.arrowLeft />
          Back to Subjects
        </Link>

        <div className="dash-header-row">
          <div>
            <span className="dash-eyebrow">{subject?.code || "Subject"}</span>
            <h1 className="dash-title">{subject?.name}</h1>
            <p className="dash-subtitle">
              {subjectForms.length} form{subjectForms.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="dash-header-actions">
            <button type="button" className="dash-ghost-btn" onClick={() => setShowEditModal(true)}>
              <Icons.pencil />
              Edit Subject
            </button>
            {!subject?.isDefault && (
              <button
                type="button"
                className="dash-ghost-btn dash-danger-btn"
                onClick={() => setShowDeleteSubject(true)}
              >
                <Icons.trash />
                Delete Subject
              </button>
            )}
            <button type="button" className="dash-primary-btn" onClick={() => setShowModal(true)}>
              <Icons.plus />
              Add Form
            </button>
          </div>
        </div>
      </header>

      <div className="dash-content">
        {loading ? (
          <p className="dash-empty">Loading forms…</p>
        ) : error ? (
          <p className="dash-empty">Couldn't load forms — {error}</p>
        ) : subjectForms.length === 0 ? (
          <p className="dash-empty">No forms under this subject yet.</p>
        ) : (
          <div className="dash-card-grid">
            {subjectForms.map((f) => (
              <Link
                className="dash-item-card dash-item-card-link dash-item-card-removable"
                key={f.id}
                to={`/forms/${f.id}`}
              >
                <button
                  type="button"
                  className="dash-item-card-remove"
                  title="Delete form"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteFormTarget(f);
                  }}
                >
                  <Icons.close />
                </button>
                <Monogram label={<Icons.fileText />} />
                <span className="dash-item-title">{f.title || "Untitled form"}</span>
                <span className="dash-item-divider" />
                <span className="dash-item-meta">
                  {f.questionCount} question{f.questionCount === 1 ? "" : "s"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="Add Form" onClose={() => setShowModal(false)}>
          <form className="dash-form" onSubmit={handleSubmit}>
            <label className="dash-form-field">
              <span className="dash-form-label">Form name</span>
              <input
                type="text"
                className="dash-form-input"
                placeholder="e.g. Midterm Feedback"
                value={form.name}
                onChange={handleField("name")}
                autoFocus
              />
            </label>

            <label className="dash-form-field">
              <span className="dash-form-label">Description</span>
              <textarea
                className="dash-form-input dash-form-textarea"
                placeholder="What is this form for?"
                rows={3}
                value={form.description}
                onChange={handleField("description")}
              />
            </label>

            {createError && <p className="dash-form-error">{createError}</p>}

            <div className="dash-modal-footer">
              <button type="button" className="dash-ghost-btn" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" className="dash-primary-btn" disabled={creating}>
                {creating ? "Creating…" : "Create Form"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showEditModal && (
        <Modal title="Edit Subject" onClose={() => setShowEditModal(false)}>
          <form className="dash-form" onSubmit={handleEditSubmit}>
            <label className="dash-form-field">
              <span className="dash-form-label">Subject name</span>
              <input
                type="text"
                className="dash-form-input"
                placeholder="e.g. Data Structures"
                value={editForm.name}
                onChange={handleEditField("name")}
                autoFocus
              />
            </label>

            <label className="dash-form-field">
              <span className="dash-form-label">Subject code</span>
              <input
                type="text"
                className="dash-form-input"
                placeholder="e.g. CC104"
                value={editForm.code}
                onChange={handleEditField("code")}
              />
            </label>

            {saveError && <p className="dash-form-error">{saveError}</p>}

            <div className="dash-modal-footer">
              <button type="button" className="dash-ghost-btn" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button type="submit" className="dash-primary-btn" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showDeleteSubject && subject && (
        <DeleteSubjectModal
          subject={{ ...subject, formCount: subjectForms.length }}
          onCancel={() => setShowDeleteSubject(false)}
          onConfirm={handleDeleteSubjectConfirm}
        />
      )}

      {deleteFormTarget && (
        <ConfirmModal
          title="Delete Form"
          message={`Delete "${deleteFormTarget.title || "Untitled form"}"? This permanently deletes it along with every session and response under it.`}
          confirmLabel="Delete Form"
          onCancel={() => setDeleteFormTarget(null)}
          onConfirm={handleDeleteFormConfirm}
        />
      )}
    </>
  );
}

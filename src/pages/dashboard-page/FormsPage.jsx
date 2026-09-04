import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForms } from "../../features/forms/hooks/useForms";
import { formsApi } from "../../features/forms/services/formsApi";
import { downloadFormAsJson } from "../../features/forms/utils/exportForm";
import { useSubjects } from "../../features/subjects/hooks/useSubjects";
import { Icons } from "./icons";
import { Monogram } from "./Monogram";
import PageHeader from "./PageHeader";
import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";

const emptyForm = { name: "", description: "", subjectId: "" };

function groupBySubject(forms, subjects) {
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const groups = new Map();

  forms.forEach((f) => {
    const key = f.subjectId && subjectById.has(f.subjectId) ? f.subjectId : "unsorted";
    if (!groups.has(key)) {
      groups.set(key, { subject: key === "unsorted" ? null : subjectById.get(key), forms: [] });
    }
    groups.get(key).forms.push(f);
  });

  return Array.from(groups.values()).sort((a, b) => {
    if (!a.subject) return 1;
    if (!b.subject) return -1;
    return a.subject.name.localeCompare(b.subject.name);
  });
}

export default function FormsPage() {
  const navigate = useNavigate();
  const { forms, loading, error, refresh: refreshForms } = useForms();
  const { subjects } = useSubjects();

  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [deleteFormTarget, setDeleteFormTarget] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [exportingId, setExportingId] = useState(null);
  const fileInputRef = useRef(null);

  const filtered = forms.filter((f) => f.title.toLowerCase().includes(query.toLowerCase()));
  const groups = groupBySubject(filtered, subjects);

  const handleField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleDeleteFormConfirm = async () => {
    await formsApi.remove(deleteFormTarget.id);
    setDeleteFormTarget(null);
    refreshForms();
  };

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportError(null);
    try {
      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("That file isn't valid JSON.");
      }
      const created = await formsApi.import(data);
      navigate(`/forms/${created.id}`);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async (e, target) => {
    e.preventDefault();
    e.stopPropagation();
    setExportingId(target.id);
    try {
      const full = await formsApi.get(target.id);
      downloadFormAsJson(full);
    } catch {
      // best-effort — the card stays interactive either way
    } finally {
      setExportingId(null);
    }
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
        subjectId: form.subjectId || null,
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

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Forms"
        subtitle="Every form built on this server, grouped by subject."
        action={
          <div className="dash-header-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="dash-visually-hidden"
              onChange={handleImportFile}
            />
            <button type="button" className="dash-ghost-btn" disabled={importing} onClick={handleImportClick}>
              <Icons.upload />
              {importing ? "Importing…" : "Import Form"}
            </button>
            <button type="button" className="dash-primary-btn" onClick={() => setShowModal(true)}>
              <Icons.plus />
              Add Form
            </button>
          </div>
        }
      />

      <div className="dash-content">
        {importError && <p className="dash-form-error">{importError}</p>}

        <div className="dash-search dash-page-search">
          <Icons.search className="dash-search-icon" />
          <input
            type="text"
            placeholder="Search forms..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="dash-empty">Loading forms…</p>
        ) : error ? (
          <p className="dash-empty">Couldn't load forms — {error}</p>
        ) : filtered.length === 0 ? (
          <p className="dash-empty">No forms found.</p>
        ) : (
          groups.map((group) => (
            <section className="dash-section" key={group.subject?.id || "unsorted"}>
              <div className="dash-section-header">
                <h2>{group.subject ? group.subject.name : "No subject"}</h2>
                <span className="dash-item-meta">
                  {group.forms.length} form{group.forms.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="dash-card-grid">
                {group.forms.map((f) => (
                  <Link
                    className="dash-item-card dash-item-card-link dash-item-card-removable"
                    key={f.id}
                    to={`/forms/${f.id}`}
                  >
                    <button
                      type="button"
                      className="dash-item-card-export"
                      title="Export form"
                      disabled={exportingId === f.id}
                      onClick={(e) => handleExport(e, f)}
                    >
                      <Icons.download />
                    </button>
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
            </section>
          ))
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

            <label className="dash-form-field">
              <span className="dash-form-label">Subject</span>
              <select
                className="dash-form-input"
                value={form.subjectId}
                onChange={handleField("subjectId")}
              >
                <option value="">No subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
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

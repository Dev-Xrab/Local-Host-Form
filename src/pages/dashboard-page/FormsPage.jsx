import { useState } from "react";
import useDashboardStore, { useDashboardActions } from "../../../store/useDashboardStore";
import { Icons } from "./icons";
import { Monogram } from "./Monogram";
import PageHeader from "./PageHeader";
import Modal from "./Modal";

const emptyForm = { name: "", description: "" };

export default function FormsPage() {
  const forms = useDashboardStore((s) => s.forms);
  const { addForm } = useDashboardActions();

  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const filtered = forms.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));

  const handleField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    addForm({
      name: form.name.trim(),
      description: form.description.trim() || "No description provided.",
    });
    setForm(emptyForm);
    setShowModal(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Forms"
        subtitle="Every form built on this server, in one place."
        action={
          <button type="button" className="dash-primary-btn" onClick={() => setShowModal(true)}>
            <Icons.plus />
            Add Form
          </button>
        }
      />

      <div className="dash-content">
        <div className="dash-search dash-page-search">
          <Icons.search className="dash-search-icon" />
          <input
            type="text"
            placeholder="Search forms..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="dash-empty">No forms found.</p>
        ) : (
          <div className="dash-card-grid">
            {filtered.map((f) => (
              <div className="dash-item-card" key={f.id}>
                <Monogram label={<Icons.fileText />} />
                <span className="dash-item-title">{f.name}</span>
                <span className="dash-item-divider" />
                <span className="dash-item-meta">{f.description}</span>
              </div>
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

            <div className="dash-modal-footer">
              <button type="button" className="dash-ghost-btn" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" className="dash-primary-btn">
                Create Form
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

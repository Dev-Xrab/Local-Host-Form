import { useEffect, useState } from "react";
import Modal from "./Modal";

const COUNTDOWN_SECONDS = 5;

// Deleting a subject is destructive to more than the subject itself once "delete" is
// chosen — it takes every form under it, and every session/response under those forms,
// with it. The countdown exists purely to stop a reflex click before that choice is
// even read, not to add friction to "move" (also gated, since both are one Delete
// button and the choice can be changed up to the last second).
export default function DeleteSubjectModal({ subject, onCancel, onConfirm }) {
  const [formsAction, setFormsAction] = useState("move");
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const handleConfirm = async () => {
    if (secondsLeft > 0 || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await onConfirm(formsAction);
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  };

  return (
    <Modal title="Delete Subject" onClose={onCancel}>
      <div className="dash-form delete-subject-form">
        <p className="dash-form-label">
          Delete "{subject.name}"{subject.formCount > 0 && ` and its ${subject.formCount} form${subject.formCount === 1 ? "" : "s"}`}?
        </p>

        {subject.formCount > 0 && (
          <div className="delete-subject-choices">
            <label className="delete-subject-choice">
              <input
                type="radio"
                name="forms-action"
                checked={formsAction === "move"}
                onChange={() => setFormsAction("move")}
              />
              <span>
                <strong>Move forms to General</strong>
                <span className="dash-item-meta">The forms stay, just unassigned from this subject.</span>
              </span>
            </label>

            <label className="delete-subject-choice">
              <input
                type="radio"
                name="forms-action"
                checked={formsAction === "delete"}
                onChange={() => setFormsAction("delete")}
              />
              <span>
                <strong>Delete all forms under this subject</strong>
                <span className="dash-item-meta">
                  Permanently deletes {subject.formCount} form{subject.formCount === 1 ? "" : "s"} and every
                  session/response under them. This can't be undone.
                </span>
              </span>
            </label>
          </div>
        )}

        {error && <p className="dash-form-error">{error}</p>}

        <div className="dash-modal-footer">
          <button type="button" className="dash-ghost-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="dash-ghost-btn dash-danger-btn"
            onClick={handleConfirm}
            disabled={secondsLeft > 0 || deleting}
          >
            {deleting ? "Deleting…" : secondsLeft > 0 ? `Delete Subject (${secondsLeft})` : "Delete Subject"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

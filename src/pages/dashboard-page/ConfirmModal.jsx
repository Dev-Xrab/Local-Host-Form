import { useState } from "react";
import Modal from "./Modal";

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Delete",
  busyLabel = "Deleting…",
  onCancel,
  onConfirm,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onCancel}>
      <div className="dash-form">
        <p className="dash-form-label">{message}</p>
        {error && <p className="dash-form-error">{error}</p>}
        <div className="dash-modal-footer">
          <button type="button" className="dash-ghost-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="dash-ghost-btn dash-danger-btn" onClick={handleConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

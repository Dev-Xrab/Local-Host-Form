import { useState } from "react";
import Modal from "./Modal";
import QrCode from "./QrCode";

// Always-visible QR thumbnail; clicking it opens a larger, scannable version in a modal.
export default function QrCodeThumb({ value, size = 44, modalTitle = "Scan to open" }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button
        type="button"
        className="qr-code-thumb"
        onClick={() => setExpanded(true)}
        title="Click to enlarge"
      >
        <QrCode value={value} size={size} />
      </button>

      {expanded && (
        <Modal title={modalTitle} onClose={() => setExpanded(false)}>
          <div className="qr-code-modal-body">
            <QrCode value={value} size={260} />
            <code className="qr-code-modal-value">{value}</code>
          </div>
        </Modal>
      )}
    </>
  );
}

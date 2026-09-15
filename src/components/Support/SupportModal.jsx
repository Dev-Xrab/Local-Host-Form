import { useEffect, useRef } from "react";
import { Icons } from "../icons";
import "./support-modal.css";

export default function SupportModal({ open, onClose }) {
  const dialogRef = useRef(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="support-modal-overlay" onMouseDown={onClose}>
      <div
        className="support-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-modal-title"
        ref={dialogRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="support-modal-close"
          aria-label="Close"
          ref={closeBtnRef}
          onClick={onClose}
        >
          <Icons.close />
        </button>

        <h2 id="support-modal-title">Support Self-Host Form</h2>
        <p className="support-modal-intro">
          Self-Host Form is free and independently developed. If you find it useful, your
          support helps fund continued development, infrastructure, and maintenance.
        </p>

        <div className="support-modal-divider" />

        <h3>Support via GCash</h3>
        <p className="support-modal-note">
          For supporters in the Philippines, scan the QR code using GCash or a participating
          bank/e-wallet.
        </p>

        <div className="support-modal-qr">
          <img src="/support/gcash-qr.png" alt="GCash QR code for supporting Self-Host Form" />
        </div>

        <p className="support-modal-note support-modal-note-muted">
          For supporters outside the Philippines, GCash availability depends on your bank or
          payment/remittance provider. If your provider supports transfers to GCash in the
          Philippines, you may be able to use this option.
        </p>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Icons } from "../icons";
import { useMountTransition } from "../../hooks/useMountTransition";
import "./support-modal.css";

export default function SupportModal({ open, onClose }) {
  const dialogRef = useRef(null);
  const closeBtnRef = useRef(null);
  const [zoomed, setZoomed] = useState(false);
  const [renderModal, modalVisible] = useMountTransition(open, 220);
  const [renderZoom, zoomVisible] = useMountTransition(zoomed, 200);

  useEffect(() => {
    if (!renderModal) return;

    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (zoomed) setZoomed(false);
      else onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    if (open) closeBtnRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [renderModal, open, zoomed, onClose]);

  useEffect(() => {
    if (!open) setZoomed(false);
  }, [open]);

  if (!renderModal) return null;

  return (
    <div className={`support-modal-overlay ${modalVisible ? "is-visible" : ""}`} onMouseDown={onClose}>
      <div
        className={`support-modal ${modalVisible ? "is-visible" : ""}`}
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
          <button type="button" className="support-modal-qr-btn" onClick={() => setZoomed(true)}>
            <img src="/support/gcash-qr.png" alt="GCash QR code for supporting Self-Host Form" />
            <span className="support-modal-qr-hint">
              <Icons.qrCode className="support-modal-qr-hint-icon" />
              Tap to enlarge
            </span>
          </button>
        </div>

        <p className="support-modal-note support-modal-note-muted">
          For supporters outside the Philippines, GCash availability depends on your bank or
          payment/remittance provider. If your provider supports transfers to GCash in the
          Philippines, you may be able to use this option.
        </p>
      </div>

      {renderZoom && (
        <div
          className={`support-modal-zoom ${zoomVisible ? "is-visible" : ""}`}
          onMouseDown={(e) => {
            e.stopPropagation();
            setZoomed(false);
          }}
        >
          <button
            type="button"
            className="support-modal-zoom-close"
            aria-label="Close enlarged QR code"
            onClick={() => setZoomed(false)}
          >
            <Icons.close />
          </button>
          <img
            src="/support/gcash-qr.png"
            alt="GCash QR code for supporting Self-Host Form, enlarged"
            className="support-modal-zoom-img"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

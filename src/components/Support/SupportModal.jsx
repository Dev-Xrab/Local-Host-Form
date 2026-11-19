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
        <header className="sm-head">
          <h2 id="support-modal-title">Support Self-Host Form</h2>
        <button
          type="button"
          className="support-modal-close"
          aria-label="Close"
          ref={closeBtnRef}
          onClick={onClose}
        >
          <Icons.close />
        </button>
        </header>

        <div className="sm-body">
          <div className="sm-col sm-plan">
            <p className="support-modal-intro">
              Self-Host Form is free and independently developed. Funding pays for the work below, in this order.
            </p>

            <h3 className="sm-h">If this project gets funded</h3>

            <div className="sm-phase">
              <p className="sm-phase-tag">First · Trust</p>
              <ol className="sm-roadmap">
                <li>
                  <strong>Signed installers.</strong> The Windows and macOS builds are unsigned, so SmartScreen and Gatekeeper warn on first launch. Code-signing and Apple notarization are a yearly cost.
                </li>
                <li>
                  <strong>No lost answers.</strong> A respondent should only see &ldquo;submitted&rdquo; once the host has confirmed it, even on weak Wi-Fi or when the timer runs out.
                </li>
                <li>
                  <strong>Encrypted local network option.</strong> HTTPS between the host and respondents on the same network, with clear guidance for hosts.
                </li>
              </ol>
            </div>

            <div className="sm-phase">
              <p className="sm-phase-tag">Next · Reliability</p>
              <ol className="sm-roadmap">
                <li>
                  <strong>Testing on real devices.</strong> Phones, tablets and laptops on real networks, plus keyboard and screen-reader checks, and a tested upgrade path for existing data, before each release. macOS, Linux and Android have had the least testing.
                </li>
                <li>
                  <strong>Backup and restore in the app.</strong> Today a host backs up the data folder by hand.
                </li>
                <li>
                  <strong>Independent security review</strong> of the host, the local server and the public link.
                </li>
              </ol>
            </div>

            <div className="sm-phase">
              <p className="sm-phase-tag">Later · Reach</p>
              <ol className="sm-roadmap">
                <li>
                  <strong>Accounts and roles.</strong> Every installation shares one host password today. Separate people and permissions are planned, not built.
                </li>
                <li>
                  <strong>Google sync out of beta.</strong> Publishing the Google app so sign-in lasts and anyone can use it, not only test users.
                </li>
                <li>
                  <strong>A tested Android host,</strong> then iOS. Phone hosting is experimental today.
                </li>
              </ol>
            </div>

            <h3 className="sm-h">Where the money goes</h3>
            <ul className="support-modal-roadmap">
              <li>Code-signing and notarization certificates</li>
              <li>Test devices and test networks</li>
              <li>Security and accessibility reviews</li>
              <li>Developer time to build and maintain all of the above</li>
            </ul>

            <p className="support-modal-note support-modal-note-muted sm-fine">
              These are plans, not promises, and the order may change based on what hosts report. Self-Host Form stays free for personal and educational use.
            </p>
          </div>

          <div className="sm-col sm-pay">
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
        </div>
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

import { useState } from "react";
import { Icons } from "./icons";
import { NAV_LINKS } from "../content";
import { APP_REPO_URL, WINDOWS_DOWNLOAD_URL } from "../constants";
import SupportModal from "./Support/SupportModal";

export default function Footer() {
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <a href="#top" className="brand">
            <span className="brand-logo">
              <img src="/logo.png" alt="" width="18" height="18" />
            </span>
            Self Host Form
          </a>
          <p>Build quizzes and forms. Host them on your own computer.</p>
          <button type="button" className="btn btn-secondary" onClick={() => setSupportOpen(true)}>
            <Icons.qrCode className="btn-icon" /> Support the project
          </button>
        </div>

        <div className="footer-cols">
          <div>
            <p className="footer-h">Explore</p>
            <ul>
              {NAV_LINKS.map((l) => (
                <li key={l.id}>
                  <a href={`#${l.id}`}>{l.label}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="footer-h">Resources</p>
            <ul>
              <li>
                <a href={WINDOWS_DOWNLOAD_URL} download>
                  Download for Windows
                </a>
              </li>
              <li>
                <a href={`${APP_REPO_URL}#readme`} target="_blank" rel="noreferrer">
                  Documentation
                </a>
              </li>
              <li>
                <a href={APP_REPO_URL} target="_blank" rel="noreferrer">
                  GitHub
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="footer-h">Contact</p>
            <ul>
              <li>
                <a href="mailto:b.d.senin@gmail.com">b.d.senin@gmail.com</a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="container footer-bottom">
        <p>© {new Date().getFullYear()} Self Host Form. Source-available and free for personal and school use. Feedback welcome.</p>
      </div>

      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </footer>
  );
}

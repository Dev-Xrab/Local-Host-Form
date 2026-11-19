import { useState } from "react";
import { NAV_LINKS } from "../content";
import { ANDROID_DOWNLOAD_URL, LINUX_DOWNLOAD_URL, MAC_DOWNLOAD_URL, WINDOWS_DOWNLOAD_URL } from "../constants";
import SupportModal from "./Support/SupportModal";

// Plain link columns, like a docs-site footer: no brand block, no decoration.
export default function Footer({ base = "" }) {
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-cols">
          <div>
            <p className="footer-h">Product</p>
            <ul>
              {NAV_LINKS.map((l) => (
                <li key={l.id}>
                  <a href={`${base}#${l.id}`}>{l.label}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="footer-h">Download</p>
            <ul>
              <li>
                <a href={WINDOWS_DOWNLOAD_URL} download>
                  Windows
                </a>
              </li>
              <li>
                <a href={MAC_DOWNLOAD_URL} download>
                  macOS
                </a>
              </li>
              <li>
                <a href={LINUX_DOWNLOAD_URL} download>
                  Linux
                </a>
              </li>
              <li>
                <a href={ANDROID_DOWNLOAD_URL} download>
                  Android
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="footer-h">Legal</p>
            <ul>
              <li>
                <a href="/privacy">Privacy Policy</a>
              </li>
              <li>
                <a href="/terms">Terms of Service</a>
              </li>
            </ul>
          </div>
          <div>
            <p className="footer-h">Project</p>
            <ul>
              <li>
                <button type="button" className="footer-link" onClick={() => setSupportOpen(true)}>
                  Support the project
                </button>
              </li>
              <li>
                <a href="mailto:b.d.senin@gmail.com">Contact</a>
              </li>
            </ul>
          </div>
        </div>
        <p className="footer-fine">© {new Date().getFullYear()} Self Host Form. Source-available, free for personal and educational use.</p>
      </div>
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </footer>
  );
}

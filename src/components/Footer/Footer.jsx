import { useState } from "react";
import { Icons } from "../icons";
import { APP_REPO_URL, WINDOWS_DOWNLOAD_URL } from "../../constants";
import SupportModal from "../Support/SupportModal";
import "./footer.css";

const LINK_COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Product", href: "#product" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
      { label: "Self-Hosting", href: "#self-hosting" },
      { label: "Who it's for", href: "#who-its-for" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Download for Windows", href: WINDOWS_DOWNLOAD_URL, download: true, icon: "download" },
      { label: "Documentation", href: `${APP_REPO_URL}#readme`, external: true },
      { label: "GitHub", href: APP_REPO_URL, external: true, icon: "github" },
    ],
  },
  {
    heading: "Contact",
    links: [{ label: "b.d.senin@gmail.com", href: "mailto:b.d.senin@gmail.com" }],
  },
];

export default function Footer() {
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <a href="#top" className="navbar-brand">
            <span className="navbar-logo">
              <img src="/logo.png" alt="" width="18" height="18" />
            </span>
            Self Host Form
          </a>
          <p>Build quizzes and forms. Host them on your own computer.</p>
          <button type="button" className="footer-support-btn" onClick={() => setSupportOpen(true)}>
            <Icons.qrCode className="footer-link-icon" />
            Support the project
          </button>
        </div>

        <div className="footer-columns">
          {LINK_COLUMNS.map((col) => (
            <div className="footer-column" key={col.heading}>
              <p className="footer-column-heading">{col.heading}</p>
              <ul>
                {col.links.map((link) => {
                  const Icon = link.icon ? Icons[link.icon] : null;
                  return (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                        {...(link.download ? { download: true } : {})}
                      >
                        {Icon && <Icon className="footer-link-icon" />}
                        {link.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="container footer-bottom">
        <p>© {new Date().getFullYear()} Self Host Form. Source-available and free for personal and school use. Feedback welcome.</p>
      </div>

      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </footer>
  );
}

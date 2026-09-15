import { useEffect, useState } from "react";
import { Icons } from "../icons";
import { WINDOWS_DOWNLOAD_URL } from "../../constants";
import SupportModal from "../Support/SupportModal";
import "./navbar.css";

const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#features", label: "Features" },
  { href: "#self-hosting", label: "Self-Hosting" },
  { href: "#who-its-for", label: "Who it's for" },
  { href: "#faq", label: "FAQ" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const closeMenu = () => setOpen(false);

  const openSupport = () => {
    closeMenu();
    setSupportOpen(true);
  };

  return (
    <header className={`navbar ${scrolled ? "is-scrolled" : ""}`}>
      <div className="container navbar-inner">
        <a href="#top" className="navbar-brand" onClick={closeMenu}>
          <span className="navbar-logo">
            <img src="/logo.png" alt="" width="18" height="18" />
          </span>
          Self Host Form
        </a>

        <nav className="navbar-links" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
          <button type="button" onClick={openSupport}>
            Support the Project
          </button>
        </nav>

        <div className="navbar-actions">
          <a href={WINDOWS_DOWNLOAD_URL} className="btn btn-primary" download>
            Download for Windows
          </a>
        </div>

        <button
          type="button"
          className="navbar-menu-btn"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <Icons.close /> : <Icons.menu />}
        </button>
      </div>

      <div id="mobile-menu" className={`navbar-mobile ${open ? "is-open" : ""}`}>
        <nav className="navbar-mobile-links" aria-label="Mobile">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={closeMenu}>
              {link.label}
            </a>
          ))}
          <button type="button" onClick={openSupport}>
            Support the Project
          </button>
        </nav>
        <div className="navbar-mobile-actions">
          <a href={WINDOWS_DOWNLOAD_URL} className="btn btn-primary btn-lg" download onClick={closeMenu}>
            Download for Windows
          </a>
        </div>
      </div>

      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </header>
  );
}

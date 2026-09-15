import { useEffect, useState } from "react";
import { Icons } from "../icons";
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

  return (
    <header className={`navbar ${scrolled ? "is-scrolled" : ""}`}>
      <div className="container navbar-inner">
        <a href="#top" className="navbar-brand" onClick={closeMenu}>
          <span className="navbar-logo" aria-hidden="true">
            <Icons.network />
          </span>
          Self Host Form
        </a>

        <nav className="navbar-links" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="navbar-actions">
          <a
            href="https://github.com/Dev-Xrab/Local-Host-Form"
            className="btn btn-primary"
            target="_blank"
            rel="noreferrer"
          >
            Get the code
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
        </nav>
        <div className="navbar-mobile-actions">
          <a
            href="https://github.com/Dev-Xrab/Local-Host-Form"
            className="btn btn-primary btn-lg"
            target="_blank"
            rel="noreferrer"
            onClick={closeMenu}
          >
            Get the code
          </a>
        </div>
      </div>
    </header>
  );
}

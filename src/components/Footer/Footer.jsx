import { Icons } from "../icons";
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
      { label: "Documentation", href: "https://github.com/Dev-Xrab/self-host-form-bulsu-bsit#readme", external: true },
      {
        label: "GitHub",
        href: "https://github.com/Dev-Xrab/self-host-form-bulsu-bsit",
        external: true,
        icon: "github",
      },
    ],
  },
  {
    heading: "Contact",
    links: [{ label: "b.d.senin@gmail.com", href: "mailto:b.d.senin@gmail.com" }],
  },
];

export default function Footer() {
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
          <p>Create forms, collect responses, host it yourself.</p>
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
        <p>© {new Date().getFullYear()} Self Host Form. An early-stage project — feedback welcome.</p>
      </div>
    </footer>
  );
}

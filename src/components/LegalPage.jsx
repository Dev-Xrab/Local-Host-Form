import { MotionConfig } from "motion/react";
import Nav from "./Nav";
import Footer from "./Footer";
import { PrivacyContent, TermsContent } from "./legalContent";

const CONTACT = "b.d.senin@gmail.com";

export default function LegalPage({ page }) {
  const isPrivacy = page === "privacy";
  return (
    <MotionConfig reducedMotion="user">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Nav base="/" />
      <main id="main-content" className="legal">
        <div className="container legal-inner">
          <p className="eyebrow">Legal</p>
          <h1>{isPrivacy ? "Privacy Policy" : "Terms of Service"}</h1>
          <p className="legal-meta">Effective October 15, 2026 · Contact: <a className="link" href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
          <nav className="legal-switch" aria-label="Legal pages">
            <a href="/privacy" aria-current={isPrivacy ? "page" : undefined}>Privacy Policy</a>
            <a href="/terms" aria-current={!isPrivacy ? "page" : undefined}>Terms of Service</a>
          </nav>
          <article className="legal-body">{isPrivacy ? <PrivacyContent contact={CONTACT} /> : <TermsContent contact={CONTACT} />}</article>
        </div>
      </main>
      <Footer base="/" />
    </MotionConfig>
  );
}

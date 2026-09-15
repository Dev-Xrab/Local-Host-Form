import "./final-cta.css";

export default function FinalCTA() {
  return (
    <section id="get-started" className="final-cta">
      <div className="container final-cta-inner">
        <h2>Your forms. Your environment. Your data.</h2>
        <p>
          Self Host Form is free and open source. Clone it, run it on your own machine or
          server, and start building — no signup, no hosted account to create.
        </p>
        <div className="final-cta-actions">
          <a
            href="https://github.com/Dev-Xrab/Local-Host-Form"
            className="btn btn-on-dark btn-lg"
            target="_blank"
            rel="noreferrer"
          >
            Get the code on GitHub
          </a>
          <a
            href="https://github.com/Dev-Xrab/Local-Host-Form#readme"
            className="btn btn-outline-on-dark btn-lg"
            target="_blank"
            rel="noreferrer"
          >
            Read the setup guide
          </a>
        </div>
      </div>
    </section>
  );
}

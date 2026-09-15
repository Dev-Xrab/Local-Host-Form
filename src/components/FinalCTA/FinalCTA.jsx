import { APP_REPO_URL, WINDOWS_DOWNLOAD_URL } from "../../constants";
import Reveal from "../Reveal/Reveal";
import "./final-cta.css";

export default function FinalCTA() {
  return (
    <section id="get-started" className="final-cta">
      <Reveal as="div" className="container final-cta-inner">
        <h2>Your forms. Your environment. Your data.</h2>
        <p>
          Download the Windows installer, or clone the source and run it yourself — no
          signup, no hosted account to create.
        </p>
        <div className="final-cta-actions">
          <a href={WINDOWS_DOWNLOAD_URL} className="btn btn-on-dark btn-lg" download>
            Download for Windows
          </a>
          <a href={APP_REPO_URL} className="btn btn-outline-on-dark btn-lg" target="_blank" rel="noreferrer">
            View source on GitHub
          </a>
        </div>
        <p className="final-cta-note">.exe installer, Windows only</p>
      </Reveal>
    </section>
  );
}

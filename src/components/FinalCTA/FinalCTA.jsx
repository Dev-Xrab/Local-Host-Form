import { WINDOWS_DOWNLOAD_URL } from "../../constants";
import Reveal from "../Reveal/Reveal";
import "./final-cta.css";

export default function FinalCTA() {
  return (
    <section id="get-started" className="final-cta">
      <Reveal as="div" className="container final-cta-inner">
        <h2>Run your next quiz on your own machine.</h2>
        <p>
          Download the Windows installer and start a session in minutes. No signup, no hosted
          account, and free for personal and school use.
        </p>
        <div className="final-cta-actions">
          <a href={WINDOWS_DOWNLOAD_URL} className="btn btn-on-dark btn-lg" download>
            Download for Windows
          </a>
        </div>
        <p className="final-cta-note">Windows installer</p>
      </Reveal>
    </section>
  );
}

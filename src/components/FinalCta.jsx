import { Icons } from "./icons";
import { WINDOWS_DOWNLOAD_URL } from "../constants";
import { Rise } from "./ui/Section";

export default function FinalCta() {
  return (
    <section id="get-started" className="cta">
      <div className="cta-glow" aria-hidden="true" />
      <Rise className="container cta-inner">
        <h2>Run your next quiz on your own machine.</h2>
        <p>
          Download the Windows installer and start a session in minutes. No signup, no hosted
          account, and free for personal and school use.
        </p>
        <div className="cta-actions">
          <a href={WINDOWS_DOWNLOAD_URL} className="btn btn-light btn-lg" download>
            <Icons.download className="btn-icon" /> Download for Windows
          </a>
          <a href="#how-it-works" className="btn btn-outline-light btn-lg">
            Review the steps
          </a>
        </div>
        <p className="cta-note">Windows installer</p>
      </Rise>
    </section>
  );
}

import { Icons } from "../icons";
import ProductFrame from "../ProductFrame/ProductFrame";
import { WINDOWS_DOWNLOAD_URL } from "../../constants";
import "./hero.css";

export default function Hero() {
  return (
    <section id="top" className="hero">
      <div className="container hero-inner">
        <div className="hero-copy">
          <p className="hero-kicker">
            <Icons.database className="hero-kicker-icon" />
            Self-hosted form platform
          </p>
          <h1>Create forms. Run them yourself.</h1>
          <p className="hero-sub">
            Self Host Form is a form and quiz builder that runs on your own machine or
            network — no account, no cloud dependency, and no internet connection required
            once it's running. Build a form, share it, and the responses stay on
            infrastructure you control.
          </p>
          <div className="hero-ctas">
            <a href={WINDOWS_DOWNLOAD_URL} className="btn btn-primary btn-lg" download>
              Download for Windows
            </a>
            <a href="#how-it-works" className="btn btn-secondary btn-lg">
              See how it works
            </a>
          </div>
          <p className="hero-cta-note">
            .exe installer, Windows only
          </p>
          <p className="hero-flow" aria-label="Create, then share, then collect">
            <span>Create</span>
            <Icons.arrowRight className="hero-flow-arrow" />
            <span>Share</span>
            <Icons.arrowRight className="hero-flow-arrow" />
            <span>Collect</span>
          </p>
        </div>

        <div className="hero-visual">
          <ProductFrame
            src="/screenshots/dashboard-home.jpg"
            alt="Self Host Form dashboard showing a live session, the local server address with a join QR code, and a list of forms and subjects"
            label="Self Host Form / Dashboard"
          />
        </div>
      </div>
    </section>
  );
}

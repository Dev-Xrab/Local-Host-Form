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
            Forms and quizzes you host yourself
          </p>
          <h1>Run quizzes and forms from your own computer.</h1>
          <p className="hero-sub">
            Build a form or exam, hand students a join code, and watch graded results come
            in live — over your classroom Wi-Fi, with no student accounts and no cloud
            required. Responses are stored on your machine, not a vendor's servers.
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
            Windows installer · Free for personal and school use
          </p>
          <p className="hero-flow" aria-label="Build, then share, then grade">
            <span>Build</span>
            <Icons.arrowRight className="hero-flow-arrow" />
            <span>Share</span>
            <Icons.arrowRight className="hero-flow-arrow" />
            <span>Grade</span>
          </p>
        </div>

        <div className="hero-visual">
          <ProductFrame
            src="/screenshots/dashboard-home.jpg"
            alt="Self Host Form dashboard showing live sessions, the local server address with a join QR code, and form and folder counts"
            label="Self Host Form / Dashboard"
          />
        </div>
      </div>
    </section>
  );
}

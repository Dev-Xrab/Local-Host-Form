import { Icons } from "../icons";
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
          <h1>Create Forms. Collect Responses. Host It Yourself.</h1>
          <p className="hero-sub">
            Build forms, share them with anyone, and manage responses from your own
            self-hosted environment. Simple like an online form builder, with more control
            over your data and deployment.
          </p>
          <div className="hero-ctas">
            <a href="#get-started" className="btn btn-primary btn-lg">
              Try SelfHost Form
            </a>
            <a href="#how-it-works" className="btn btn-secondary btn-lg">
              See How It Works
            </a>
          </div>
          <p className="hero-flow" aria-label="Create, then share, then collect">
            <span>Create</span>
            <Icons.arrowRight className="hero-flow-arrow" />
            <span>Share</span>
            <Icons.arrowRight className="hero-flow-arrow" />
            <span>Collect</span>
          </p>
        </div>

        <div className="hero-visual" role="img" aria-label="Preview of a form titled Event Registration next to a panel showing 128 collected responses">
          <div className="hero-card hero-card-form">
            <div className="hero-card-topbar">
              <span className="hero-dot" />
              <span className="hero-dot" />
              <span className="hero-dot" />
              <span className="hero-frame-label">Event Registration</span>
            </div>
            <div className="hero-card-body">
              <p className="hero-form-title">Event Registration</p>
              <p className="hero-form-desc">Let us know if you'll be joining.</p>

              <label className="hero-field">
                <span>Name</span>
                <span className="hero-field-input" />
              </label>
              <label className="hero-field">
                <span>Email</span>
                <span className="hero-field-input" />
              </label>
              <label className="hero-field">
                <span>Organisation</span>
                <span className="hero-field-input" />
              </label>

              <span className="hero-submit-btn">Submit</span>
            </div>
          </div>

          <div className="hero-card hero-card-responses">
            <p className="hero-responses-label">Responses</p>
            <p className="hero-responses-count">128</p>
            <ul className="hero-responses-list">
              <li>
                <span className="hero-avatar">AC</span>
                Ava Chen <span className="hero-tag hero-tag-done">Submitted</span>
              </li>
              <li>
                <span className="hero-avatar">MD</span>
                Marco Diaz <span className="hero-tag hero-tag-done">Submitted</span>
              </li>
              <li>
                <span className="hero-avatar">PN</span>
                Priya N. <span className="hero-tag hero-tag-done">Submitted</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

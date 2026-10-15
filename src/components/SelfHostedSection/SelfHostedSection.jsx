import { Icons } from "../icons";
import { useInView } from "../../hooks/useInView";
import "./self-hosted-section.css";

export default function SelfHostedSection() {
  const [diagramRef, diagramInView] = useInView();

  return (
    <section id="self-hosting" className="section self-hosted-section">
      <div className="container self-hosted-inner">
        <div className="self-hosted-copy">
          <p className="eyebrow">Self-hosting</p>
          <h2>Your forms. Your computer. Your control.</h2>
          <p className="self-hosted-lead">
            A hosted form service stores every response on the provider's servers. Self Host
            Form runs on a computer you own, so your students' answers sit in a local
            database next to the app that collected them.
          </p>
          <ul className="self-hosted-points">
            <li>
              <Icons.checkCircle className="self-hosted-point-icon" />
              Forms, responses and uploaded files are stored on the host machine. No account
              is needed to use the app.
            </li>
            <li>
              <Icons.checkCircle className="self-hosted-point-icon" />
              You choose the network: classroom Wi-Fi, a school LAN, or a temporary public
              link when students are remote.
            </li>
            <li>
              <Icons.checkCircle className="self-hosted-point-icon" />
              You start, end and reopen every session yourself, and nothing external can
              change that.
            </li>
          </ul>
          <p className="self-hosted-note">
            <strong>To be precise:</strong> self-hosted describes where the software runs, not
            whether a network is required. Students still need to reach your computer, whether
            that's over local Wi-Fi with no internet at all, or through the optional public
            link.
          </p>
          <p className="self-hosted-dev-note">
            <span>For developers and IT teams:</span> it's a Node and Express server with
            SQLite that serves the web UI, so besides the desktop app you can run it
            standalone on a machine you manage.
          </p>

          <div className="self-hosted-security-note" role="note">
            <Icons.checkCircle className="self-hosted-security-icon" />
            <p>
              <strong>There's no default password.</strong> On first launch the app asks you to
              create the host password, and that setup step only works from the host computer
              itself, so no one else on the network can claim it first. You can also add a
              recovery question for forgotten passwords.
            </p>
          </div>
        </div>

        <div
          className={`self-hosted-diagram ${diagramInView ? "is-in-view" : ""}`}
          ref={diagramRef}
          role="img"
          aria-label="Diagram: a student connects to Self Host Form, which runs on your computer or network, backed by a local database"
        >
          <div className="diagram-node diagram-node-user">
            <Icons.users className="diagram-icon" />
            <span>Student</span>
            <span className="diagram-node-sub">Joins with a code</span>
          </div>
          <div className="diagram-line" aria-hidden="true" />
          <div className="diagram-node diagram-node-app">
            <Icons.layers className="diagram-icon" />
            <span>Self Host Form</span>
            <span className="diagram-node-sub">The platform</span>
          </div>
          <div className="diagram-line" aria-hidden="true" />
          <div className="diagram-node diagram-node-infra">
            <Icons.monitor className="diagram-icon" />
            <span>Your computer or network</span>
            <span className="diagram-node-sub">Where it runs</span>
          </div>
          <div className="diagram-line" aria-hidden="true" />
          <div className="diagram-node diagram-node-db">
            <Icons.database className="diagram-icon" />
            <span>Local database</span>
            <span className="diagram-node-sub">Forms & responses</span>
          </div>
        </div>
      </div>
    </section>
  );
}

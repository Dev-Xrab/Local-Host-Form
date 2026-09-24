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
          <h2>Your Forms. Your Infrastructure. Your Control.</h2>
          <p className="self-hosted-lead">
            A hosted form service runs on the provider's servers, and your data lives there
            too. Self Host Form lets you run the same kind of platform on infrastructure you
            choose — a personal computer, a home server, or hardware your organisation
            already manages.
          </p>
          <ul className="self-hosted-points">
            <li>
              <Icons.checkCircle className="self-hosted-point-icon" />
              Forms and responses are stored in a database you run, not handed to a
              third-party service to operate the platform.
            </li>
            <li>
              <Icons.checkCircle className="self-hosted-point-icon" />
              You decide where the software runs and how it fits into your existing
              infrastructure.
            </li>
            <li>
              <Icons.checkCircle className="self-hosted-point-icon" />
              You control when a form starts accepting responses, stops, or reopens — that
              decision isn't made by an external service.
            </li>
          </ul>
          <p className="self-hosted-note">
            <strong>To be precise:</strong> self-hosted describes where the software runs, not
            whether a network is required to reach it. Respondents still need network access
            to your deployment — that can be the public internet, an internal company
            network, or a local Wi-Fi network with no outside connection, depending on how
            you set it up.
          </p>
          <p className="self-hosted-dev-note">
            <span>For developers and IT teams —</span> deploy the platform within
            infrastructure that fits your environment and workflow.
          </p>

          <div className="self-hosted-security-note" role="note">
            <Icons.checkCircle className="self-hosted-security-icon" />
            <p>
              <strong>There's no default password to forget about.</strong> The first time you
              open a fresh install, it asks you to create the host account on the spot — you
              choose the password before anyone can sign in, not after.
            </p>
          </div>
        </div>

        <div
          className={`self-hosted-diagram ${diagramInView ? "is-in-view" : ""}`}
          ref={diagramRef}
          role="img"
          aria-label="Diagram: a user connects to Self Host Form, which runs on your server, PC, or network, backed by your own database"
        >
          <div className="diagram-node diagram-node-user">
            <Icons.users className="diagram-icon" />
            <span>User</span>
            <span className="diagram-node-sub">Opens a form</span>
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
            <span>Your Server / PC / Network</span>
            <span className="diagram-node-sub">Where it runs</span>
          </div>
          <div className="diagram-line" aria-hidden="true" />
          <div className="diagram-node diagram-node-db">
            <Icons.database className="diagram-icon" />
            <span>Your Database</span>
            <span className="diagram-node-sub">Forms & responses</span>
          </div>
        </div>
      </div>
    </section>
  );
}

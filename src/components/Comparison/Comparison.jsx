import { Icons } from "../icons";
import "./comparison.css";

const ROWS = [
  {
    label: "Hosting",
    cloud: "Runs on the provider's servers",
    self: "Runs on infrastructure you choose",
  },
  {
    label: "Data location",
    cloud: "Stored in the provider's database",
    self: "Stored in your own database",
  },
  {
    label: "Deployment control",
    cloud: "Managed entirely by the provider",
    self: "You control how and where it's deployed",
  },
  {
    label: "Customisation",
    cloud: "Limited to what the provider exposes",
    self: "Configurable to fit your own workflow",
  },
  {
    label: "Infrastructure control",
    cloud: "None — infrastructure is the provider's",
    self: "Runs on hardware you manage",
  },
  {
    label: "Network environment",
    cloud: "Always reached over the public internet",
    self: "Reachable over whichever network you connect it to",
  },
];

export default function Comparison() {
  return (
    <section className="section comparison-section">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow">Comparison</p>
          <h2>Two approaches to running a form platform</h2>
          <p>A general comparison of approach — not a claim about any specific competitor.</p>
        </div>

        <div className="comparison-table-wrap">
          <table className="comparison-table">
            <thead>
              <tr>
                <th scope="col" className="comparison-row-label-head">
                  <span className="visually-hidden">Dimension</span>
                </th>
                <th scope="col">Traditional Hosted Form Platform</th>
                <th scope="col" className="comparison-col-highlight">
                  SelfHost Form
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.cloud}</td>
                  <td className="comparison-col-highlight">
                    <Icons.checkCircle className="comparison-check" />
                    {row.self}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

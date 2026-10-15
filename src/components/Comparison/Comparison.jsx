import { Icons } from "../icons";
import "./comparison.css";

const ROWS = [
  {
    label: "Where it runs",
    cloud: "On the provider's servers",
    self: "On a computer you own",
  },
  {
    label: "Where responses live",
    cloud: "In the provider's database",
    self: "In a local database on your machine",
  },
  {
    label: "Student sign-in",
    cloud: "Depends on the provider and plan",
    self: "None. Students join with a code and a name",
  },
  {
    label: "Internet required",
    cloud: "Yes, for everyone",
    self: "No. Local Wi-Fi is enough",
  },
  {
    label: "Remote students",
    cloud: "Always reachable online",
    self: "Optional temporary public link",
  },
  {
    label: "Exam controls",
    cloud: "Depends on the provider",
    self: "Fullscreen gate, tab-switch lock, copy restrictions",
  },
];

export default function Comparison() {
  return (
    <section className="section comparison-section">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow">Comparison</p>
          <h2>Hosted form tools vs. Self Host Form</h2>
          <p>A general comparison of approach, not a claim about any specific product.</p>
        </div>

        <div className="comparison-table-wrap">
          <table className="comparison-table">
            <thead>
              <tr>
                <th scope="col" className="comparison-row-label-head">
                  <span className="visually-hidden">Dimension</span>
                </th>
                <th scope="col">Typical hosted form tool</th>
                <th scope="col" className="comparison-col-highlight">
                  Self Host Form
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

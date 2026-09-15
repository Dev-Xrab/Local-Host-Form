import "./who-its-for.css";

const GROUPS = [
  {
    title: "Teachers",
    text: "Run a quiz or a check-in over your classroom's own Wi-Fi, grade the multiple-choice questions automatically, and see who's finished — without asking students to create an account or relying on the school's internet.",
    examples: ["Classroom quizzes", "Exit tickets", "Assessments"],
  },
  {
    title: "Schools & institutions",
    text: "Keep student and staff data on hardware the institution already owns, instead of a vendor's servers. Useful anywhere network access is limited, shared, or a compliance concern.",
    examples: ["Registration", "Internal surveys", "Placement tests"],
  },
  {
    title: "Organisations & teams",
    text: "Internal surveys, applications, and feedback forms that run on infrastructure your own team manages — not a third party's account system.",
    examples: ["Employee feedback", "Event registration", "Intake forms"],
  },
  {
    title: "Developers",
    text: "Self-host it, read the source, and change what doesn't fit. A Node/Express server with SQLite by default, packaged as a desktop app or run standalone — plus an optional cloud sync and Google Forms import if you need it.",
    examples: ["Custom deployments", "Self-hosted infra", "Open source"],
  },
];

export default function WhoItsFor() {
  return (
    <section id="who-its-for" className="section who-its-for">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow">Who it's for</p>
          <h2>Built for a few kinds of work</h2>
          <p>Not everyone needs a self-hosted form platform. These are the people who do.</p>
        </div>

        <div className="who-list">
          {GROUPS.map((group) => (
            <div className="who-row" key={group.title}>
              <h3>{group.title}</h3>
              <div className="who-row-body">
                <p>{group.text}</p>
                <ul className="who-examples">
                  {group.examples.map((ex) => (
                    <li key={ex}>{ex}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

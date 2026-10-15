import "./who-its-for.css";

const GROUPS = [
  {
    title: "Teachers",
    text: "Run a quiz or check-in over your classroom's own Wi-Fi. Multiple choice, checkbox, dropdown and short-answer questions grade themselves, you see who has finished as it happens, and students never need an account. Turn on fullscreen and tab-switch locks when you want exam conditions.",
    examples: ["Classroom quizzes", "Exit tickets", "Exams"],
  },
  {
    title: "Schools & training centres",
    text: "Keep student responses on a computer your institution already owns instead of a vendor's servers. Rosters match differently typed names to the same student, and bulk export collects a whole term's sessions into one workbook.",
    examples: ["Placement tests", "Registration", "Course feedback"],
  },
  {
    title: "Teams & organisations",
    text: "Use the built-in templates for event registration, job applications, time-off requests and feedback, and keep the responses on a machine your own team manages.",
    examples: ["Event registration", "Intake forms", "Internal surveys"],
  },
  {
    title: "Developers",
    text: "A Node and Express server with SQLite, packaged as a desktop app or run standalone. The source is available to read and contribute to, and free to run for personal or school use. Redistribution and resale need permission.",
    examples: ["Source-available", "Node + SQLite", "Self-hosted"],
  },
];

export default function WhoItsFor() {
  return (
    <section id="who-its-for" className="section who-its-for">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow">Who it's for</p>
          <h2>Built for people who run their own assessments</h2>
          <p>If you collect answers from a room full of people, this is for you.</p>
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

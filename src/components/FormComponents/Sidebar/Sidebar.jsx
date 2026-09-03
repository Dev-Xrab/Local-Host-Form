import { NavLink } from "react-router-dom";
import useFormStore, { useFormActions } from "../../../../store/useFormStore";
import { QUESTION_TYPES } from "../questionTypes";
import { Icons } from "../icons";
import "./sidebar.css";

const NAV_ITEMS = [
  { to: "/form", label: "Questions" },
  { to: "/sessions", label: "Sessions" },
  { to: "/settings", label: "Settings" },
];

const scrollToQuestion = (id) => {
  document.getElementById(`question-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
};

export default function Sidebar() {
  const questions = useFormStore((s) => s.questions);
  const mode = useFormStore((s) => s.mode);
  const { addQuestion, addSection, setMode } = useFormActions();

  const handleAdd = (type) => {
    addQuestion(type);
  };

  const handleSave = () => {
    console.log("Saved");
  };

  return (
    <aside className="form-sidebar">
      <div className="form-sidebar-scroll">
        <div className="form-sidebar-brand">
          StoneArch
        </div>

        <div className="form-sidebar-mode-toggle">
          <button
            type="button"
            className={`mode-btn ${mode === "edit" ? "mode-btn-active" : ""}`}
            onClick={() => setMode("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === "view" ? "mode-btn-active" : ""}`}
            onClick={() => setMode("view")}
          >
            View
          </button>
        </div>

        <nav className="form-sidebar-nav">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `form-sidebar-nav-item ${isActive ? "form-sidebar-nav-item-active" : ""}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {mode === "edit" && (
          <div className="form-sidebar-section">
            <span className="form-sidebar-heading">Add question</span>

            <div className="form-sidebar-types">
              {QUESTION_TYPES.map((t) => {
                const Icon = Icons[t.icon];
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="form-sidebar-type-btn"
                    onClick={() => handleAdd(t.id)}
                  >
                    <Icon className="form-sidebar-type-icon" />
                    {t.label}
                  </button>
                );
              })}

              <span className="form-sidebar-type-divider" />

              <button
                type="button"
                className="form-sidebar-type-btn"
                onClick={addSection}
              >
                <Icons.section className="form-sidebar-type-icon" />
                Add section
              </button>
            </div>
          </div>
        )}

        <div className="form-sidebar-section form-sidebar-outline">
          <span className="form-sidebar-heading">
            Questions ({questions.filter((q) => q.type !== "section").length})
          </span>

          {questions.length === 0 ? (
            <p className="form-sidebar-empty">No questions yet</p>
          ) : (
            <div className="form-sidebar-outline-list">
              {(() => {
                let questionNumber = 0;
                return questions.map((q) => {
                  const isSection = q.type === "section";
                  if (!isSection) questionNumber += 1;

                  return (
                    <button
                      key={q.id}
                      type="button"
                      className={`form-sidebar-outline-item ${isSection ? "form-sidebar-outline-item-section" : ""}`}
                      onClick={() => scrollToQuestion(q.id)}
                    >
                      {isSection ? (
                        <Icons.section className="form-sidebar-outline-section-icon" />
                      ) : (
                        <span className="form-sidebar-outline-index">{questionNumber}</span>
                      )}
                      <span className="form-sidebar-outline-title">
                        {q.title || (isSection ? "Untitled section" : "Untitled question")}
                      </span>
                    </button>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>

      <div className="form-sidebar-footer">
        <button type="button" className="form-sidebar-save" onClick={handleSave}>
          Save
        </button>
      </div>
    </aside>
  );
}

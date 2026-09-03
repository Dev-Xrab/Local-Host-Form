import useFormStore, { useFormActions } from "../../../../store/useFormStore";
import { Icons } from "../icons";
import "./section.css";

export default function Section({ section, isFirst, isLast }) {
  const mode = useFormStore((s) => s.mode);
  const { updateQuestion, deleteQuestion, duplicateQuestion, moveQuestion } = useFormActions();
  const isEdit = mode === "edit";

  return (
    <div className="section-block" id={`question-${section.id}`}>
      <span className="section-label">Section</span>

      <input
        className="section-title-input"
        type="text"
        placeholder="Section title"
        value={section.title}
        onChange={(e) => updateQuestion(section.id, { title: e.target.value })}
        readOnly={!isEdit}
        disabled={!isEdit}
      />

      {(isEdit || section.description) && (
        <input
          className="section-description-input"
          type="text"
          placeholder="Description (optional)"
          value={section.description}
          onChange={(e) => updateQuestion(section.id, { description: e.target.value })}
          readOnly={!isEdit}
          disabled={!isEdit}
        />
      )}

      {isEdit && (
        <div className="section-footer">
          <div className="section-actions">
            <button
              type="button"
              className="icon-btn"
              title="Move up"
              disabled={isFirst}
              onClick={() => moveQuestion(section.id, -1)}
            >
              <Icons.chevronUp />
            </button>
            <button
              type="button"
              className="icon-btn"
              title="Move down"
              disabled={isLast}
              onClick={() => moveQuestion(section.id, 1)}
            >
              <Icons.chevronDown />
            </button>

            <span className="section-divider" />

            <button
              type="button"
              className="icon-btn"
              title="Duplicate"
              onClick={() => duplicateQuestion(section.id)}
            >
              <Icons.copy />
            </button>
            <button
              type="button"
              className="icon-btn"
              title="Delete"
              onClick={() => deleteQuestion(section.id)}
            >
              <Icons.trash />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import useFormStore, { useFormActions } from "../../../../store/useFormStore";
import { Icons } from "../icons";

const Marker = ({ variant, index, correct, interactive, onToggle }) => {
  const classes = ["option-marker", `option-marker-${variant}`];
  if (correct) classes.push("option-marker-correct");
  const className = classes.join(" ");
  const numberLabel = variant === "numbered" ? `${index + 1}.` : null;

  if (interactive) {
    return (
      <button
        type="button"
        className={className}
        onClick={onToggle}
        title={correct ? "Correct answer" : "Mark as correct answer"}
      >
        {variant !== "numbered" && correct && <Icons.check className="option-marker-check" />}
        {numberLabel}
      </button>
    );
  }

  return <span className={className}>{numberLabel}</span>;
};

export default function OptionList({ question, variant }) {
  const mode = useFormStore((s) => s.mode);
  const { updateOption, removeOption, addOption, toggleCorrectAnswer } = useFormActions();
  const isEdit = mode === "edit";
  const correctIndices = Array.isArray(question.correctAnswerIndex) ? question.correctAnswerIndex : [];

  return (
    <div className="field-options">
      {isEdit && (
        <p className="option-hint">Click a marker to set the correct answer</p>
      )}

      {question.options.map((opt, i) => (
        <div className="field-option-row" key={i}>
          <Marker
            variant={variant}
            index={i}
            correct={isEdit && correctIndices.includes(i)}
            interactive={isEdit}
            onToggle={() => toggleCorrectAnswer(question.id, i)}
          />

          <input
            className="option-input"
            type="text"
            value={opt}
            placeholder={`Option ${i + 1}`}
            onChange={(e) => updateOption(question.id, i, e.target.value)}
            disabled={mode === "view"}
            readOnly={mode === "view"}
          />

          {isEdit && question.options.length > 1 && (
            <button
              type="button"
              className="icon-btn option-remove"
              onClick={() => removeOption(question.id, i)}
            >
              <Icons.close />
            </button>
          )}
        </div>
      ))}

      {isEdit && (
        <button type="button" className="add-option-btn" onClick={() => addOption(question.id)}>
          <Marker variant={variant} index={question.options.length} />
          Add option
        </button>
      )}
    </div>
  );
}

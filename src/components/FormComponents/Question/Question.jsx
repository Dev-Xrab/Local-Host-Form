import { useState } from "react";
import useFormStore, { useFormActions } from "../../../../store/useFormStore";
import { QUESTION_TYPES } from "../questionTypes";
import { Icons } from "../icons";
import ShortAnswer from "../QuestionTypes/ShortAnswer";
import Paragraph from "../QuestionTypes/Paragraph";
import MultipleChoice from "../QuestionTypes/MultipleChoice";
import Checkboxes from "../QuestionTypes/Checkboxes";
import Dropdown from "../QuestionTypes/Dropdown";
import LinearScale from "../QuestionTypes/LinearScale";
import DateField from "../QuestionTypes/DateField";
import TimeField from "../QuestionTypes/TimeField";
import FileUpload from "../QuestionTypes/FileUpload";
import ImageBlock from "../QuestionTypes/ImageBlock";
import "../QuestionTypes/question-types.css";
import "./question.css";

const FIELD_COMPONENTS = {
  short_answer: ShortAnswer,
  paragraph: Paragraph,
  multiple_choice: MultipleChoice,
  checkboxes: Checkboxes,
  dropdown: Dropdown,
  linear_scale: LinearScale,
  date: DateField,
  time: TimeField,
  file_upload: FileUpload,
};

const TYPE_ICON = Object.fromEntries(QUESTION_TYPES.map((t) => [t.id, t.icon]));
const TYPE_LABEL = Object.fromEntries(QUESTION_TYPES.map((t) => [t.id, t.label]));
const GRADABLE_TYPES = new Set(["short_answer", "paragraph", "multiple_choice", "checkboxes", "dropdown"]);

export default function Question({ question, index, isFirst, isLast }) {
  const mode = useFormStore((s) => s.mode);
  const [newAnswerVariation, setNewAnswerVariation] = useState("");
  const {
    updateQuestion,
    changeQuestionType,
    deleteQuestion,
    duplicateQuestion,
    moveQuestion,
    addCorrectAnswerVariation,
    removeCorrectAnswerVariation,
  } = useFormActions();

  const Field = FIELD_COMPONENTS[question.type];
  const TypeIcon = Icons[TYPE_ICON[question.type]];
  const isEdit = mode === "edit";

  const commitAnswerVariation = () => {
    const value = newAnswerVariation.trim();
    if (!value) return;
    addCorrectAnswerVariation(question.id, value);
    setNewAnswerVariation("");
  };

  return (
    <div className="question-card" id={`question-${question.id}`}>
      <div className="question-card-header">
        <span className="question-index">{index + 1}</span>

        <input
          className="question-title-input"
          type="text"
          placeholder="Question"
          value={question.title}
          onChange={(e) => updateQuestion(question.id, { title: e.target.value })}
          readOnly={mode === "view"}
          disabled={mode === "view"}
        />

        {mode === "view" && question.required && <span className="question-required-mark">*</span>}

        {isEdit ? (
          <select
            className="question-type-select"
            value={question.type}
            onChange={(e) => changeQuestionType(question.id, e.target.value)}
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        ) : (
          TypeIcon && (
            <span className="question-type-badge" title={TYPE_LABEL[question.type]}>
              <TypeIcon />
            </span>
          )
        )}
      </div>

      {question.showDescription && (
        <input
          className="question-description-input"
          type="text"
          placeholder="Description"
          value={question.description}
          onChange={(e) => updateQuestion(question.id, { description: e.target.value })}
          readOnly={mode === "view"}
          disabled={mode === "view"}
        />
      )}

      {question.showImage && (
        <div className="question-image-wrap">
          <ImageBlock question={question} />
        </div>
      )}

      <div className="question-body">{Field && <Field question={question} />}</div>

      {isEdit && ["short_answer", "paragraph"].includes(question.type) && (
        <div className="answer-key-section">
          <span className="answer-key-label">Acceptable answers</span>
          <div className="answer-key-tags">
            {Array.isArray(question.correctAnswers) &&
              question.correctAnswers.map((ans, i) => (
                <span key={i} className="answer-tag">
                  {ans}
                  <button
                    type="button"
                    className="answer-tag-remove"
                    onClick={() => removeCorrectAnswerVariation(question.id, i)}
                  >
                    <Icons.close />
                  </button>
                </span>
              ))}
            <input
              type="text"
              className="answer-tag-input"
              placeholder={
                question.correctAnswers?.length ? "Add another..." : "e.g. Paris, paris, PARIS — press Enter"
              }
              value={newAnswerVariation}
              onChange={(e) => setNewAnswerVariation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitAnswerVariation();
                }
              }}
              onBlur={commitAnswerVariation}
            />
          </div>
        </div>
      )}

      <div className="question-footer">
        {mode === "edit" && (
          <>
            <button
              type="button"
              className="question-link-btn"
              onClick={() => updateQuestion(question.id, { showDescription: !question.showDescription })}
            >
              {question.showDescription ? "Remove description" : "Add description"}
            </button>
          </>
        )}

        {mode === "edit" && (
        <div className="question-actions">
          <button
            type="button"
            className="icon-btn"
            title="Move up"
            disabled={isFirst}
            onClick={() => moveQuestion(question.id, -1)}
          >
            <Icons.chevronUp />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Move down"
            disabled={isLast}
            onClick={() => moveQuestion(question.id, 1)}
          >
            <Icons.chevronDown />
          </button>

          <span className="question-divider" />

          <button
            type="button"
            className={`icon-btn ${question.showImage ? "icon-btn-active" : ""}`}
            title={question.showImage ? "Remove image" : "Add image"}
            onClick={() => updateQuestion(question.id, { showImage: !question.showImage })}
          >
            <Icons.image />
          </button>

          <span className="question-divider" />

          <button
            type="button"
            className="icon-btn"
            title="Duplicate"
            onClick={() => duplicateQuestion(question.id)}
          >
            <Icons.copy />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Delete"
            onClick={() => deleteQuestion(question.id)}
          >
            <Icons.trash />
          </button>

          {GRADABLE_TYPES.has(question.type) && (
            <>
              <span className="question-divider" />
              <label className="points-input-label">
                Points
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="points-input"
                  value={question.points ?? 1}
                  onChange={(e) =>
                    updateQuestion(question.id, { points: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </label>
            </>
          )}

          <span className="question-divider" />

          <label className="required-toggle">
            Required
            <input
              type="checkbox"
              checked={question.required}
              onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
            />
            <span className="toggle-switch" />
          </label>
        </div>
        )}
      </div>
    </div>
  );
}

import ShortAnswerField from "./ShortAnswerField";
import ParagraphField from "./ParagraphField";
import MultipleChoiceField from "./MultipleChoiceField";
import CheckboxesField from "./CheckboxesField";
import DropdownField from "./DropdownField";
import LinearScaleField from "./LinearScaleField";
import DateField from "./DateField";
import TimeField from "./TimeField";
import FileUploadField from "./FileUploadField";

const FIELD_COMPONENTS = {
  short_answer: ShortAnswerField,
  paragraph: ParagraphField,
  multiple_choice: MultipleChoiceField,
  checkboxes: CheckboxesField,
  dropdown: DropdownField,
  linear_scale: LinearScaleField,
  date: DateField,
  time: TimeField,
  file_upload: FileUploadField,
};

export default function AnswerQuestion({ question, index, value, onChange, error }) {
  const Field = FIELD_COMPONENTS[question.type];

  return (
    <div className={`answer-question-card ${error ? "answer-question-card-error" : ""}`}>
      <div className="answer-question-header">
        <span className="answer-question-index">{index + 1}</span>
        <h3 className="answer-question-title">
          {question.title || "Untitled question"}
          {question.required && <span className="answer-required-mark">*</span>}
        </h3>
      </div>

      {question.description && <p className="answer-question-description">{question.description}</p>}

      {question.imageUrl && (
        <div className="answer-question-image">
          <img src={question.imageUrl} alt="" />
        </div>
      )}

      {Field && <Field question={question} value={value} onChange={onChange} />}

      {error && <p className="answer-question-error">{error}</p>}
    </div>
  );
}

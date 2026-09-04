export default function MultipleChoiceField({ question, value, onChange, disabled }) {
  return (
    <div className="answer-options">
      {question.options.map((opt, i) => (
        <label className="answer-option-row" key={i}>
          <input
            type="radio"
            name={question.id}
            checked={value === i}
            onChange={() => onChange(i)}
            disabled={disabled}
          />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

export default function CheckboxesField({ question, value, onChange, disabled }) {
  const selected = Array.isArray(value) ? value : [];

  const toggle = (i) => {
    onChange(selected.includes(i) ? selected.filter((v) => v !== i) : [...selected, i]);
  };

  return (
    <div className="answer-options">
      {question.options.map((opt, i) => (
        <label className="answer-option-row" key={i}>
          <input
            type="checkbox"
            checked={selected.includes(i)}
            onChange={() => toggle(i)}
            disabled={disabled}
          />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

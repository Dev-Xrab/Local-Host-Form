export default function DropdownField({ question, value, onChange, disabled }) {
  return (
    <select
      className="answer-field answer-field-select"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      disabled={disabled}
    >
      <option value="">Choose</option>
      {question.options.map((opt, i) => (
        <option key={i} value={i}>
          {opt}
        </option>
      ))}
    </select>
  );
}

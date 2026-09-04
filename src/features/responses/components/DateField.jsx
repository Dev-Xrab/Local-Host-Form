export default function DateField({ value, onChange, disabled }) {
  return (
    <input
      className="answer-field answer-field-date"
      type="date"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
}

export default function TimeField({ value, onChange, disabled }) {
  return (
    <input
      className="answer-field answer-field-time"
      type="time"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
}

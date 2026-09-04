export default function ShortAnswerField({ value, onChange, disabled }) {
  return (
    <input
      className="answer-field answer-field-text"
      type="text"
      placeholder="Your answer"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
}

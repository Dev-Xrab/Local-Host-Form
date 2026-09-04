export default function ParagraphField({ value, onChange, disabled }) {
  return (
    <textarea
      className="answer-field answer-field-textarea"
      rows={3}
      placeholder="Your answer"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
}

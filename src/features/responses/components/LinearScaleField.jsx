export default function LinearScaleField({ question, value, onChange, disabled }) {
  const { min, max, minLabel, maxLabel } = question.scale;
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="answer-scale">
      <div className="answer-scale-row">
        {numbers.map((n) => (
          <label className="answer-scale-item" key={n}>
            <span>{n}</span>
            <input
              type="radio"
              name={question.id}
              checked={value === n}
              onChange={() => onChange(n)}
              disabled={disabled}
            />
          </label>
        ))}
      </div>
      {(minLabel || maxLabel) && (
        <div className="answer-scale-labels">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}

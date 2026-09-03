import useFormStore, { useFormActions } from "../../../../store/useFormStore";

const MIN_OPTIONS = [0, 1];
const MAX_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function LinearScale({ question }) {
  const mode = useFormStore((s) => s.mode);
  const { updateScale } = useFormActions();
  const { min, max, minLabel, maxLabel } = question.scale;

  return (
    <div className="field-linear-scale">
      <div className="scale-range-row">
        <select
          value={min}
          disabled={mode === "view"}
          onChange={(e) => updateScale(question.id, { min: Number(e.target.value) })}
        >
          {MIN_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span>to</span>
        <select
          value={max}
          disabled={mode === "view"}
          onChange={(e) => updateScale(question.id, { max: Number(e.target.value) })}
        >
          {MAX_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <div className="scale-labels-row">
        <input
          className="scale-label-input"
          type="text"
          placeholder="Label (optional)"
          value={minLabel}
          disabled={mode === "view"}
          readOnly={mode === "view"}
          onChange={(e) => updateScale(question.id, { minLabel: e.target.value })}
        />
        <input
          className="scale-label-input"
          type="text"
          placeholder="Label (optional)"
          value={maxLabel}
          disabled={mode === "view"}
          readOnly={mode === "view"}
          onChange={(e) => updateScale(question.id, { maxLabel: e.target.value })}
        />
      </div>

      <div className="scale-preview-row">
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
          <div className="scale-preview-item" key={n}>
            <span className="option-marker option-marker-radio" />
            <span className="scale-preview-number">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

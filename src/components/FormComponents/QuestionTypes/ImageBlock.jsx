import { useRef } from "react";
import useFormStore, { useFormActions } from "../../../../store/useFormStore";
import { Icons } from "../icons";

export default function ImageBlock({ question }) {
  const mode = useFormStore((s) => s.mode);
  const { updateQuestion } = useFormActions();
  const inputRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => updateQuestion(question.id, { imageUrl: reader.result });
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="field-image-input"
      onChange={handleFile}
    />
  );

  if (!question.imageUrl) {
    if (mode === "view") return null;
    return (
      <button type="button" className="field-image-empty" onClick={() => inputRef.current?.click()}>
        <Icons.image className="field-icon" />
        Click to upload an image
        {fileInput}
      </button>
    );
  }

  return (
    <div className="field-image-preview">
      <img src={question.imageUrl} alt={question.title || "Form image"} />

      {mode === "edit" && (
        <div className="field-image-actions">
          <button type="button" className="field-image-btn" onClick={() => inputRef.current?.click()}>
            Replace
          </button>
          <button
            type="button"
            className="field-image-btn"
            onClick={() => updateQuestion(question.id, { imageUrl: null })}
          >
            Remove
          </button>
          {fileInput}
        </div>
      )}
    </div>
  );
}

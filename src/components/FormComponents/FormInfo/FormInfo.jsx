import { useEffect, useRef } from "react";
import useFormStore, { useFormActions } from "../../../../store/useFormStore";
import "./form-info.css";

export default function FormInfo() {
  const formTitle = useFormStore((s) => s.formTitle);
  const formDescription = useFormStore((s) => s.formDescription);
  const mode = useFormStore((s) => s.mode);
  const { setFormTitle, setFormDescription } = useFormActions();
  const isView = mode === "view";
  const descriptionRef = useRef(null);

  useEffect(() => {
    const el = descriptionRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [formDescription]);

  return (
    <div className="form-info-content">
      <input
        type="text"
        className="form-title"
        id="formTitle"
        placeholder="Form Title"
        value={formTitle}
        onChange={(e) => setFormTitle(e.target.value)}
        readOnly={isView}
        disabled={isView}
      />

      <textarea
        ref={descriptionRef}
        className="form-description"
        id="formDescription"
        rows={1}
        placeholder="Form Description"
        value={formDescription}
        onChange={(e) => setFormDescription(e.target.value)}
        readOnly={isView}
        disabled={isView}
      />
    </div>
  );
}

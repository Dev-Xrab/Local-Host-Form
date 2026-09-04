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

  const resizeToContent = () => {
    const el = descriptionRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    resizeToContent();
  }, [formDescription]);

  // A value-only effect can measure scrollHeight while this textarea is still narrower than
  // its final width — e.g. before the sidebar (loaded async, alongside this) settles into its
  // own width — and freeze at a wrongly-inflated height forever, since typing is the only
  // other thing that re-triggers it. Re-measure whenever the container's actual width changes.
  useEffect(() => {
    const container = descriptionRef.current?.parentElement;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(resizeToContent);
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

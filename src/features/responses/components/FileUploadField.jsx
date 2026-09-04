import { useRef, useState } from "react";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB — keeps SQLite rows and JSON payloads reasonable for local self-hosting.

export default function FileUploadField({ value, onChange, disabled }) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setError("File is too large (max 5MB).");
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setFileName(file.name);
      onChange(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const clear = () => {
    setFileName("");
    setError(null);
    onChange(null);
  };

  return (
    <div className="answer-file-upload">
      {value ? (
        <div className="answer-file-chip">
          <span>{fileName || "1 file attached"}</span>
          <button type="button" onClick={clear} disabled={disabled}>
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="answer-file-btn"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          Add file
        </button>
      )}
      {error && <span className="answer-file-error">{error}</span>}
      <input ref={inputRef} type="file" className="answer-file-input" onChange={handleFile} />
    </div>
  );
}

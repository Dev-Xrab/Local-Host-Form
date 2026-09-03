import { Icons } from "../icons";

export default function FileUpload() {
  return (
    <div className="field-file-upload">
      <Icons.fileUpload className="field-icon" />
      <button type="button" className="field-file-upload-btn" disabled>
        Add file
      </button>
      <span className="field-file-upload-hint">File upload is disabled in the form builder preview.</span>
    </div>
  );
}

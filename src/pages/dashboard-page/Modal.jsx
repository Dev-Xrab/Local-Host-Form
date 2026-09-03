import { Icons } from "./icons";

export default function Modal({ title, onClose, children }) {
  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dash-modal-header">
          <h3>{title}</h3>
          <button type="button" className="dash-modal-close" onClick={onClose}>
            <Icons.close />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

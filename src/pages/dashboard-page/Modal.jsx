import { Icons } from "./icons";

export default function Modal({ title, onClose, children, headerActions }) {
  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dash-modal-header">
          <h3>{title}</h3>
          <div className="dash-modal-header-actions">
            {headerActions}
            <button type="button" className="dash-modal-close" onClick={onClose}>
              <Icons.close />
            </button>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

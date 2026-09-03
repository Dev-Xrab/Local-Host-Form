import { useNavigate } from "react-router-dom";
import "./role-page.css";
import hosterImg from "../../images/hosting.png";
import responderImg from "../../images/responder.png";

export default function RolePage() {
  const navigate = useNavigate();

  return (

    <div className="role-page-content">
          <div className="role-page-icon">-</div>
          <h1>StoneArch</h1>
          <p className="role-page-subtitle">
            Build forms your way, host them yourself, and keep your data locally.
          </p>

          <div className="role-choices-container">
            <button
              type="button"
              className="role-page-choice"
              onClick={() => navigate("/host/login")}
            >
              <span className="role-page-choice-icon">
                <img src={hosterImg} alt="" />
              </span>
              <span className="role-page-choice-text">
                <span className="role-page-choice-title">Hoster</span>
                <span className="role-page-choice-desc">Create and publish your own forms</span>
              </span>
            </button>

            <button
              type="button"
              className="role-page-choice"
              onClick={() => navigate("/respondent/login")}
            >
              <span className="role-page-choice-icon">
                <img src={responderImg} alt="" />
              </span>
              <span className="role-page-choice-text">
                <span className="role-page-choice-title">Responder</span>
                <span className="role-page-choice-desc">Fill out forms you've been sent</span>
              </span>
            </button>
          </div>
        </div>


  );
}
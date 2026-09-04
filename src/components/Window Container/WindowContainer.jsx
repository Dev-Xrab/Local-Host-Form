
import "./window-container.css";

export default function WindowContainer({
  component,
  navigationpath = "None",
  // Full-page routes (role picker, host/respondent login) want this centered in the
  // viewport; FormInfo's inline use inside the questions list (QuestionsPage.jsx) is just
  // one card among many in a scrolling column and must opt out, or the min-height:100vh
  // centering reserves a full screen's worth of space before the next question.
  center = true,
}) {
  return (
    <div className={`role-page-wrapper ${center ? "role-page-wrapper-centered" : ""}`}>
      <div className="role-page-window">
        <div className="role-page-topbar">
          <span className="role-page-dot" />
          <span className="role-page-dot" />
          <span className="role-page-dot" />

          <span className="role-page-breadcrumb">
            StoneArch / {navigationpath}
          </span>
        </div>

        {component}
      </div>
    </div>
  );
}


import { useEffect, useState } from "react";
import { useParams, Outlet } from "react-router-dom";
import Sidebar from "../../components/FormComponents/Sidebar/Sidebar";
import useFormStore, { useFormActions } from "../../../store/useFormStore";
import { formsApi } from "../../features/forms/services/formsApi";
import "./form-page.css";

export default function FormPage() {
  const { formId } = useParams();
  const loadedFormId = useFormStore((s) => s.formId);
  const { loadForm } = useFormActions();

  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);

    formsApi
      .get(formId)
      .then((form) => {
        if (cancelled) return;
        loadForm(form);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.status === 404 ? "This form doesn't exist." : err.message);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  if (status === "loading") {
    return <div className="form-page-message">Loading form…</div>;
  }

  if (status === "error") {
    return <div className="form-page-message form-page-message-error">{error}</div>;
  }

  if (loadedFormId !== formId) {
    // Guards a render between the fetch resolving and the store finishing its update.
    return <div className="form-page-message">Loading form…</div>;
  }

  return (
    <div className="form-page">
      <Sidebar />
      <div className="page-form-content">
        <Outlet />
      </div>
    </div>
  );
}

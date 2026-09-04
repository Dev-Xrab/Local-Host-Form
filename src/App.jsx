import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import { useAuthActions } from "../store/useAuthStore";
import RequireAuth from "./features/auth/components/RequireAuth";
import RolePage from "./pages/role-page/RolePage";
import WindowContainer from "./components/Window Container/WindowContainer";
import FormPage from "./pages/form-page/FormPage";
import QuestionsPage from "./pages/form-page/QuestionsPage";
import FormSettingsPage from "./pages/form-page/SettingsPage";
import DashboardLayout from "./pages/dashboard-page/DashboardLayout";
import DashboardHome from "./pages/dashboard-page/DashboardHome";
import SessionsListPage from "./pages/dashboard-page/SessionsListPage";
import SessionDetailPage from "./pages/dashboard-page/SessionDetailPage";
import SubjectsPage from "./pages/dashboard-page/SubjectsPage";
import SubjectDetailPage from "./pages/dashboard-page/SubjectDetailPage";
import FormsPage from "./pages/dashboard-page/FormsPage";
import BulkExportPage from "./pages/dashboard-page/BulkExportPage";
import GradebookPage from "./pages/dashboard-page/GradebookPage";
import SettingsPage from "./pages/dashboard-page/SettingsPage";
import HostLogin from "./pages/login-page/host/HostLogin";
import HostRecovery from "./pages/login-page/host/HostRecovery";
import RespondentLogin from "./pages/login-page/repondent/RespondentLogin";
import RespondForm from "./features/responses/pages/RespondForm";

function App() {
  const { checkSession } = useAuthActions();

  useEffect(() => {
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <WindowContainer
                component={<RolePage />}
                navigationpath="Get Started"
              />
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="sessions" element={<SessionsListPage />} />
            <Route path="sessions/:sessionId" element={<SessionDetailPage />} />
            <Route path="subjects" element={<SubjectsPage />} />
            <Route path="subjects/:subjectId" element={<SubjectDetailPage />} />
            <Route path="forms" element={<FormsPage />} />
            <Route path="export" element={<BulkExportPage />} />
            <Route path="gradebook" element={<GradebookPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route
            path="/forms/:formId"
            element={
              <RequireAuth>
                <FormPage />
              </RequireAuth>
            }
          >
            <Route index element={<QuestionsPage />} />
            <Route path="settings" element={<FormSettingsPage />} />
          </Route>
          <Route path="/s/:code" element={<RespondForm />} />
          <Route
            path="/respondent/login"
            element={
              <WindowContainer
                component={<RespondentLogin />}
                navigationpath="Responder Login"
              />
            }
          />
          <Route
            path="/host/login"
            element={
              <WindowContainer
                component={<HostLogin />}
                navigationpath="Hoster Login"
              />
            }
          />
          <Route
            path="/host/recover"
            element={
              <WindowContainer
                component={<HostRecovery />}
                navigationpath="Password Recovery"
              />
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;

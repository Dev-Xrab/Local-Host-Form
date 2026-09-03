import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import RolePage from "./pages/role-page/RolePage";
import WindowContainer from "./components/Window Container/WindowContainer";
import FormInfo from "./components/FormComponents/FormInfo/FormInfo";
import FormPage from "./pages/form-page/FormPage";
import DashboardLayout from "./pages/dashboard-page/DashboardLayout";
import DashboardHome from "./pages/dashboard-page/DashboardHome";
import QuizzesPage from "./pages/dashboard-page/QuizzesPage";
import QuizDetailPage from "./pages/dashboard-page/QuizDetailPage";
import SubjectsPage from "./pages/dashboard-page/SubjectsPage";
import FormsPage from "./pages/dashboard-page/FormsPage";
import BulkExportPage from "./pages/dashboard-page/BulkExportPage";
import GradebookPage from "./pages/dashboard-page/GradebookPage";
import SettingsPage from "./pages/dashboard-page/SettingsPage";
import HostLogin from "./pages/login-page/host/HostLogin";
import RespondentLogin from "./pages/login-page/repondent/RespondentLogin";

function App() {
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
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="quizzes" element={<QuizzesPage />} />
            <Route path="quizzes/:quizId" element={<QuizDetailPage />} />
            <Route path="subjects" element={<SubjectsPage />} />
            <Route path="forms" element={<FormsPage />} />
            <Route path="export" element={<BulkExportPage />} />
            <Route path="gradebook" element={<GradebookPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="/create-form" element={<FormPage />} />
          <Route path="/form" element={<FormPage />} />
          <Route path="/sessions" element={<FormPage />} />
          <Route path="/settings" element={<FormPage />} />
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
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;

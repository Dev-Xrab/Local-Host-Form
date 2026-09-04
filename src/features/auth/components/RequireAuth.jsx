import { Navigate } from "react-router-dom";
import useAuthStore from "../../../../store/useAuthStore";

export default function RequireAuth({ children }) {
  const isLogin = useAuthStore((s) => s.isLogin);
  const isChecking = useAuthStore((s) => s.isChecking);

  if (isChecking) return null;
  if (!isLogin) return <Navigate to="/host/login" replace />;
  return children;
}

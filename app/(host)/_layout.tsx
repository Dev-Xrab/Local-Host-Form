import { Redirect, Slot } from "expo-router";
import useAuthStore from "../../store/useAuthStore";
import { Spinner } from "../../ui";

// Every host route (dashboard, form editor) lives under this group; the group name is not part of
// the URL, so /dashboard and /forms/:id keep their existing addresses.
export default function HostGroup() {
  const isLogin = useAuthStore((s) => s.isLogin);
  const isChecking = useAuthStore((s) => s.isChecking);

  if (isChecking) return <Spinner fill />;
  if (!isLogin) return <Redirect href="/host/login" />;
  return <Slot />;
}

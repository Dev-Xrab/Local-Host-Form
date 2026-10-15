import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { authApi } from "../../src/features/auth/services/authApi";
import { AuthCard, AuthLink, PasswordField } from "../../components/AuthCard";
import { Button, Spinner, Text, TextField, space } from "../../ui";

type Status = "loading" | "ready" | "unavailable" | "local-only";

// The port this page was opened on, so the hint names an address that actually works on the host.
const localPort = (typeof window !== "undefined" && window.location?.port) || "5174";

export default function HostRecovery() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    authApi
      .getRecoveryQuestion()
      .then(({ question }: { question: string | null }) => {
        setQuestion(question);
        setStatus(question ? "ready" : "unavailable");
      })
      // 403: recovery is only offered on the computer running the server, never over the network.
      .catch((err: { status?: number }) => setStatus(err.status === 403 ? "local-only" : "unavailable"));
  }, []);

  async function submit() {
    if (!answer.trim() || !newPassword) return setError("Answer and new password are both required.");
    if (newPassword.length < 8) return setError("New password must be at least 8 characters.");
    if (newPassword !== confirm) return setError("New password and confirmation don't match.");
    setError(null);
    setSubmitting(true);
    try {
      await authApi.recoverPassword(answer.trim(), newPassword);
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const back = <AuthLink href="/host/login">Back to login</AuthLink>;

  if (status === "loading") return <Spinner fill />;
  if (status === "local-only")
    return <AuthCard title="Password recovery" subtitle={`For security, recovery only works on the computer running Self Host Form. Open the app on that computer (or go to http://localhost:${localPort} there) to reset your password.`} footer={back}><View /></AuthCard>;
  if (status === "unavailable")
    return <AuthCard title="Password recovery" subtitle="No recovery question has been set up on this server, so it can't verify who you are. Ask whoever administers this server to reset it, or set one up under Settings once you're logged in." footer={back}><View /></AuthCard>;
  if (done)
    return (
      <AuthCard title="Password reset" subtitle="Your password has been changed. Log in with your new password.">
        <Button label="Go to login" variant="primary" fullWidth onPress={() => router.replace("/host/login")} />
      </AuthCard>
    );

  return (
    <AuthCard title="Password recovery" subtitle="Answer your recovery question to set a new password." footer={back}>
      <View style={{ gap: space[3] }}>
        <TextField label={question ?? "Recovery question"} value={answer} onChangeText={setAnswer} placeholder="Your answer" autoComplete="off" autoFocus />
        <PasswordField label="New password" value={newPassword} onChangeText={setNewPassword} show={false} autoComplete="new-password" placeholder="At least 8 characters" />
        <PasswordField label="Confirm new password" value={confirm} onChangeText={setConfirm} show={false} autoComplete="new-password" onSubmitEditing={submit} />
        {error ? <Text variant="small" tone="danger" accessibilityRole="alert">{error}</Text> : null}
        <Button label="Reset password" variant="primary" fullWidth loading={submitting} onPress={submit} />
      </View>
    </AuthCard>
  );
}

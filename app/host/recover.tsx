import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { authApi } from "../../src/features/auth/services/authApi";
import { AuthCard, AuthField, AuthLink, Button, PasswordField } from "../../components/AuthCard";
import { Notice, Spinner, space } from "../../ui";

type Status = "loading" | "ready" | "unavailable" | "local-only" | "network-error";

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

  const load = useCallback(() => {
    setStatus("loading");
    authApi
      .getRecoveryQuestion()
      .then(({ question }: { question: string | null }) => {
        setQuestion(question);
        setStatus(question ? "ready" : "unavailable");
      })
      // 403: recovery is only offered on the computer running the server, never over the network.
      .catch((err: { status?: number }) => setStatus(err.status === 403 ? "local-only" : "network-error"));
  }, []);
  useEffect(load, [load]);

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
    return <AuthCard kind="host" eyebrow="Local recovery" title="Return to the host device." subtitle={`For security, password recovery works only on the computer running this server. Open the app there, or visit http://localhost:${localPort} on that computer.`} footer={back}><Notice tone="info">Your form and response data is still stored on the host device.</Notice></AuthCard>;
  if (status === "unavailable")
    return <AuthCard kind="host" eyebrow="Recovery unavailable" title="No recovery question is set." subtitle="This server cannot verify a password reset yet. Ask the person who manages it to sign in and set a recovery question in Settings." footer={back}><Notice tone="warning">No password change has been made.</Notice></AuthCard>;
  if (status === "network-error")
    return <AuthCard kind="host" eyebrow="Connection check" title="Cannot reach this server." subtitle="Check that the host app is open and try again." footer={back}><Button label="Try again" variant="primary" fullWidth onPress={load} /></AuthCard>;
  if (done)
    return (
      <AuthCard kind="host" eyebrow="Recovery complete" title="Your password is reset." subtitle="Use your new password to sign in to this server.">
        <Button label="Go to login" variant="primary" fullWidth onPress={() => router.replace("/host/login")} />
      </AuthCard>
    );

  return (
    <AuthCard kind="host" eyebrow="Verify and reset" title="Reset your host password." subtitle="Answer the question you set on this server, then choose a new password." footer={back}>
      <View style={{ gap: space[3] }}>
        <AuthField label={question ?? "Recovery question"} value={answer} onChangeText={setAnswer} placeholder="Your answer" autoComplete="off" autoFocus />
        <PasswordField label="New password" value={newPassword} onChangeText={setNewPassword} show={false} autoComplete="new-password" placeholder="At least 8 characters" />
        <PasswordField label="Confirm new password" value={confirm} onChangeText={setConfirm} show={false} autoComplete="new-password" onSubmitEditing={submit} />
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button label="Reset password" variant="primary" fullWidth loading={submitting} onPress={submit} />
      </View>
    </AuthCard>
  );
}

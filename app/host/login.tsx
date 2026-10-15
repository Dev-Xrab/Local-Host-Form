import { useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";
import useAuthStore, { useAuthActions } from "../../store/useAuthStore";
import { AuthCard, AuthLink, PasswordField, useReveal } from "../../components/AuthCard";
import { canHostOnPhone } from "../../lib/phoneServer";
import { Button, Spinner, Text, TextField, space } from "../../ui";

function HostSetup() {
  const router = useRouter();
  const { setup } = useAuthActions();
  const isSubmitting = useAuthStore((s) => s.isSubmitting);
  const serverError = useAuthStore((s) => s.error);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const { show, toggle } = useReveal();

  async function submit() {
    if (password.length < 8) return setFieldError("Password must be at least 8 characters.");
    if (password !== confirm) return setFieldError("Password and confirmation don't match.");
    setFieldError(null);
    if (await setup(password)) router.replace("/dashboard");
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Nobody has set up this server yet. Choose a password to become its host. You'll use it to sign in from now on."
      footer={<Text variant="small" tone="tertiary">You can add a recovery question later in Settings.</Text>}
    >
      <View style={{ gap: space[3] }}>
        <PasswordField label="Password" value={password} onChangeText={setPassword} show={show} onToggle={toggle} autoComplete="new-password" placeholder="At least 8 characters" autoFocus />
        <PasswordField label="Confirm password" value={confirm} onChangeText={setConfirm} show={show} autoComplete="new-password" placeholder="Type it again" error={fieldError ?? serverError} onSubmitEditing={submit} />
        <Button label="Create account" variant="primary" fullWidth loading={isSubmitting} onPress={submit} />
      </View>
    </AuthCard>
  );
}

// Native app only: there is no same-origin server, so either this phone hosts its own, or the
// address of a host computer is entered once and saved.
function ConnectServer() {
  const { connectServer, hostOnPhone } = useAuthActions();
  const isSubmitting = useAuthStore((s) => s.isSubmitting);
  const serverError = useAuthStore((s) => s.error);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState<"host" | "connect" | null>(null);
  const run = async (kind: "host" | "connect", fn: () => Promise<unknown>) => {
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <AuthCard
      title={canHostOnPhone ? "How do you want to run Self Host Form?" : "Connect to your server"}
      subtitle={canHostOnPhone ? "Host everything on this phone, or connect to a computer that's already running it." : "Enter the address shown on the computer running Self Host Form, e.g. 192.168.1.20:5174. Your phone must be on the same Wi-Fi."}
    >
      <View style={{ gap: space[4] }}>
        {canHostOnPhone ? (
          <View style={{ gap: space[2] }}>
            <Button label="Host on this phone" variant="primary" fullWidth loading={busy === "host"} disabled={isSubmitting && busy !== "host"} onPress={() => run("host", hostOnPhone)} />
            <Text variant="small" tone="secondary">Your forms and responses stay on this phone. Students on the same Wi-Fi join with its address. Keep the app open during a session. Syncs to your cloud account when you're online.</Text>
          </View>
        ) : null}
        <View style={{ gap: space[3] }}>
          <TextField label={canHostOnPhone ? "Or connect to a host computer" : "Server address"} value={address} onChangeText={setAddress} placeholder="192.168.1.20:5174" autoCapitalize="none" autoCorrect={false} keyboardType="url" error={serverError} onSubmitEditing={() => run("connect", () => connectServer(address))} autoFocus={!canHostOnPhone} />
          <Button label="Connect" variant={canHostOnPhone ? "secondary" : "primary"} fullWidth loading={busy === "connect"} disabled={!address.trim()} onPress={() => run("connect", () => connectServer(address))} />
        </View>
      </View>
    </AuthCard>
  );
}

export default function HostLogin() {
  const router = useRouter();
  const { login } = useAuthActions();
  const isSubmitting = useAuthStore((s) => s.isSubmitting);
  const serverError = useAuthStore((s) => s.error);
  const isChecking = useAuthStore((s) => s.isChecking);
  const needsSetup = useAuthStore((s) => s.needsSetup);
  const needsServer = useAuthStore((s) => s.needsServer);
  const serverUrl = useAuthStore((s) => s.serverUrl);
  const { changeServer } = useAuthActions();
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const { show, toggle } = useReveal();

  // Wait for the initial /api/auth/me check so a fresh install doesn't flash the login form.
  if (isChecking) return <Spinner fill />;
  if (needsServer) return <ConnectServer />;
  if (needsSetup) return <HostSetup />;

  async function submit() {
    if (!password) return setFieldError("Password is required.");
    setFieldError(null);
    if (await login(password)) router.replace("/dashboard");
  }

  return (
    <AuthCard
      title="Log in as host"
      subtitle="Manage your forms, sessions, and results."
      footer={
        <View style={{ gap: space[2] }}>
          <Text variant="small" tone="secondary">Answering a form instead? <AuthLink href="/respondent/login">Join as a respondent</AuthLink></Text>
          {serverUrl ? <Text variant="small" tone="tertiary">Server: {serverUrl} · <Text variant="small" tone="secondary" onPress={changeServer}>Change</Text></Text> : null}
        </View>
      }
    >
      <View style={{ gap: space[3] }}>
        <PasswordField label="Server password" value={password} onChangeText={setPassword} show={show} onToggle={toggle} autoComplete="current-password" placeholder="Enter your password" error={fieldError ?? serverError} onSubmitEditing={submit} autoFocus />
        <AuthLink href="/host/recover">Forgot password?</AuthLink>
        <Button label="Log in" variant="primary" fullWidth loading={isSubmitting} onPress={submit} />
      </View>
    </AuthCard>
  );
}

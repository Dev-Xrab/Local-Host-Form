import { useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";
import useAuthStore, { useAuthActions } from "../../store/useAuthStore";
import { AuthCard, AuthField, AuthLink, Button, PasswordField, useReveal } from "../../components/AuthCard";
import { canHostOnPhone } from "../../lib/phoneServer";
import { Notice, Spinner, space } from "../../ui";
import { GText } from "../../ui/gforms";

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
      kind="host"
      eyebrow="Set up your server"
      title="Start hosting on your terms."
      subtitle="Choose a password for this server. Your forms and responses stay on this device unless you choose to sync them."
      footer={<GText size={14} secondary>After setup, add a recovery question in Settings so you can reset this password.</GText>}
    >
      <View style={{ gap: space[3] }}>
        <PasswordField label="Password" value={password} onChangeText={setPassword} show={show} onToggle={toggle} autoComplete="new-password" placeholder="At least 8 characters" autoFocus />
        <PasswordField label="Confirm password" value={confirm} onChangeText={setConfirm} show={show} autoComplete="new-password" placeholder="Type it again" error={fieldError ?? serverError} onSubmitEditing={submit} />
        <Button label="Create host account" variant="primary" fullWidth loading={isSubmitting} onPress={submit} />
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
      kind="host"
      eyebrow="Connect to a host"
      title={canHostOnPhone ? "Choose your host device." : "Connect to your host."}
      subtitle={canHostOnPhone ? "Host everything on this phone, or connect to a computer that's already running it." : "Enter the address shown on the computer running Self-Host Form, e.g. 192.168.1.20:5174. Your phone must be on the same network."}
    >
      <View style={{ gap: space[4] }}>
        {canHostOnPhone ? (
          <View style={{ gap: space[2] }}>
            <Button label="Host on this phone" variant="primary" fullWidth loading={busy === "host"} disabled={isSubmitting && busy !== "host"} onPress={() => run("host", hostOnPhone)} />
            <GText size={14} secondary>Your forms and responses stay on this phone. Participants on the same network join with its address. Keep the app open during a session. Syncs to your cloud account when you're online.</GText>
          </View>
        ) : null}
        <View style={{ gap: space[3] }}>
          <AuthField label={canHostOnPhone ? "Or connect to a host computer" : "Server address"} value={address} onChangeText={setAddress} placeholder="192.168.1.20:5174" autoCapitalize="none" autoCorrect={false} keyboardType="url" error={serverError} onSubmitEditing={() => run("connect", () => connectServer(address))} autoFocus={!canHostOnPhone} />
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
  const remoteLoginRequired = useAuthStore((s) => s.remoteLoginRequired);
  const remoteAdminEnabled = useAuthStore((s) => s.remoteAdminEnabled);
  const { changeServer } = useAuthActions();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<{ password?: string; code?: string }>({});
  const { show, toggle } = useReveal();

  // Wait for the initial /api/auth/me check so a fresh install doesn't flash the login form.
  if (isChecking) return <Spinner fill />;
  if (needsServer) return <ConnectServer />;
  if (needsSetup) return <HostSetup />;

  async function submit() {
    if (!password) return setFieldError({ password: "Enter your server password." });
    if (remoteLoginRequired && !/^\d{6}$/.test(code)) return setFieldError({ code: "Enter the 6-digit authenticator code." });
    setFieldError({});
    if (await login(password, code)) router.replace("/dashboard");
  }

  return (
    <AuthCard
      kind="host"
      eyebrow={remoteLoginRequired ? "Remote access" : "Host sign in"}
      title={remoteLoginRequired ? "Secure access to your server." : "Pick up where you left off."}
      subtitle={remoteLoginRequired ? "Use your server password and authenticator code to manage forms remotely." : "Sign in to manage your forms, sessions and results on this server."}
      footer={
        <View style={{ gap: space[2] }}>
          <GText size={14} secondary>Here to respond? <AuthLink href="/respondent/login">Join a session</AuthLink></GText>
          {serverUrl ? <GText size={14} secondary>Server: {serverUrl} · <GText size={14} secondary onPress={changeServer}>Change</GText></GText> : null}
        </View>
      }
    >
      <View style={{ gap: space[3] }}>
        {remoteLoginRequired && !remoteAdminEnabled ? <Notice tone="warning">Remote administration is off. Enable it in Settings on the host computer.</Notice> : null}
        <PasswordField label="Server password" value={password} onChangeText={(v) => { setPassword(v); setFieldError((e) => ({ ...e, password: undefined })); }} show={show} onToggle={toggle} autoComplete="current-password" placeholder="Your host password" error={fieldError.password ?? (!remoteLoginRequired ? serverError : null)} onSubmitEditing={submit} autoFocus />
        {remoteLoginRequired ? <AuthField label="Authenticator code" value={code} onChangeText={(v) => { setCode(v); setFieldError((e) => ({ ...e, code: undefined })); }} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" error={fieldError.code ?? serverError} onSubmitEditing={submit} /> : <AuthLink href="/host/recover">Forgot your password?</AuthLink>}
        <Button label={remoteLoginRequired ? "Verify and sign in" : "Sign in"} variant="primary" fullWidth loading={isSubmitting} disabled={remoteLoginRequired && !remoteAdminEnabled} onPress={submit} />
      </View>
    </AuthCard>
  );
}

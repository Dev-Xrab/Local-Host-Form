import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Check, Cloud, Copy, Globe, LogOut, Trash2 } from "lucide-react-native";
import useAuthStore, { useAuthActions } from "../../store/useAuthStore";
import { authApi } from "../../src/features/auth/services/authApi";
import { settingsApi } from "../../src/features/settings/services/settingsApi";
import { cloudApi } from "../../src/features/cloud/services/cloudApi";
import { Button, Dialog, IconButton, Notice, Page, PageHeader, SegmentedControl, Section, SettingRow, Surface, Switch, Text, TextField, radius, space, useTheme, useToast } from "../../ui";
import { useCloudAccount, useTunnel } from "../../lib/data";
import { copyText } from "../../lib/platform";
import { useServerOrigin } from "../../lib/useServerOrigin";
import { QrCode } from "../QrCode";
import { SettingGroup } from "./SettingGroup";
import { DefaultsGroups } from "./DefaultsGroups";

const CLEAR_CONFIRM = "DELETE";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"; // addresses stay monospace so they copy and read exactly

function AddressBox({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceMuted, borderRadius: radius.md, paddingLeft: space[3], maxWidth: 420, minWidth: 0, alignSelf: "stretch" }}>
      <Text variant="small" style={{ flex: 1, minWidth: 0, fontFamily: MONO }} numberOfLines={1} selectable>{value}</Text>
      <IconButton icon={copied ? Check : Copy} label={copied ? "Copied" : label} onPress={async () => { if (await copyText(value)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }} />
    </View>
  );
}

function AppearancePanel() {
  const { mode, setMode } = useTheme();
  return (
    <SettingRow last label="Theme" description="System follows your device and is the default.">
      <SegmentedControl value={mode} onChange={setMode} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }, { value: "system", label: "System" }]} />
    </SettingRow>
  );
}

function ServerPanel() {
  const origin = useServerOrigin();
  return (
    <SettingRow last label="Local server address" description="Share this with participants on the same network.">
      <AddressBox value={origin} label="Copy address" />
    </SettingRow>
  );
}

function RemoteAdminPanel() {
  const hostingOnPhone = useAuthStore((s) => s.hostingOnPhone);
  const tunnel = useTunnel();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startAfterSetup, setStartAfterSetup] = useState(false);

  useEffect(() => {
    if (hostingOnPhone) return;
    authApi.remoteAdminStatus().then((result: { enabled: boolean }) => setEnabled(result.enabled)).catch(() => setError("Remote admin setup is available only on the computer running this server."));
  }, [hostingOnPhone]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };

  if (hostingOnPhone) return <View style={{ padding: space[4] }}><Text tone="secondary">Remote access needs the desktop app running on a computer.</Text></View>;

  const startAccess = async () => {
    if (tunnel.allowedEmails.length > 0) await tunnel.saveAccess([]);
    await tunnel.start();
  };

  return (
    <View style={{ padding: space[4], gap: space[3] }}>
      <>
        <Text tone="secondary">Cloudflare creates a temporary public link. It changes each time you start access and works only while this app stays open.</Text>
        {enabled === null ? <Text tone="secondary">{error || "Checking remote access…"}</Text> : setup ? (
          <View style={{ gap: space[3], maxWidth: 420 }}>
            <Text style={{ fontWeight: "600" }}>1. Protect admin sign-in</Text>
            <Text tone="secondary">Scan this QR code in an authenticator app, then enter its current code.</Text>
            <QrCode value={setup.uri} size={180} />
            <Text variant="small" selectable>Manual key: {setup.secret}</Text>
            <TextField label="Authenticator code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
            <Button label="Confirm code" variant="primary" loading={busy} disabled={!/^\d{6}$/.test(code)} onPress={() => run(async () => { await authApi.confirmRemoteAdmin(code); setEnabled(true); setSetup(null); setPassword(""); setCode(""); if (startAfterSetup) { setStartAfterSetup(false); await startAccess(); } })} />
            <Button label="Cancel" variant="ghost" onPress={() => { setSetup(null); setCode(""); setStartAfterSetup(false); }} />
          </View>
        ) : enabled ? (
          <>
            <Text style={{ fontWeight: "600" }}>1. Admin protection is on</Text>
            <Text tone="secondary">Admin sign-in requires your server password and a 6-digit authenticator code.</Text>
            {tunnel.allowedEmails.length > 0 ? <Notice tone="danger">The old email PIN list cannot be used with Quick Tunnels. Starting access will clear that list and create a public participant link. Admin sign-in will still require your password and authenticator code.</Notice> : null}
            <Text style={{ fontWeight: "600" }}>2. Start the public link</Text>
            {tunnel.status === "connected" ? <Button label="Stop remote access" variant="danger" loading={busy} onPress={() => run(tunnel.stop)} /> : tunnel.status === "error" ? <Button label="Reset remote access" variant="secondary" loading={busy} onPress={() => run(tunnel.stop)} /> : <Button label={tunnel.status === "installing" ? "Setting up…" : tunnel.status === "starting" ? "Connecting…" : "Start remote access"} icon={Globe} variant="primary" loading={busy || tunnel.status === "installing" || tunnel.status === "starting"} onPress={() => run(startAccess)} />}
            {tunnel.status === "connected" && tunnel.url ? <><Text style={{ fontWeight: "600" }}>3. Copy the right link</Text><Text variant="small" tone="secondary">Participant link</Text><AddressBox value={tunnel.url} label="Copy participant link" /><Text variant="small" tone="secondary">Admin link</Text><AddressBox value={`${tunnel.url}/host/login`} label="Copy admin link" /></> : null}
            {tunnel.status === "error" && tunnel.error ? <Notice tone="danger">{tunnel.error}</Notice> : null}
            <View style={{ gap: space[2], maxWidth: 420 }}>
              <TextField label="Server password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
              <TextField label="Authenticator code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
              <Button label="Replace authenticator" variant="secondary" loading={busy} disabled={!password} onPress={() => run(async () => { setSetup(await authApi.beginRemoteAdmin(password)); setPassword(""); setCode(""); })} />
              <Button label="Disable remote admin" variant="danger" loading={busy} disabled={!password || !/^\d{6}$/.test(code)} onPress={() => run(async () => { await authApi.disableRemoteAdmin(password, code); setEnabled(false); setPassword(""); setCode(""); })} />
            </View>
          </>
        ) : (
          <View style={{ gap: space[3], maxWidth: 420 }}>
            <Text style={{ fontWeight: "600" }}>1. Protect admin sign-in</Text>
            <Text tone="secondary">Enter your server password, then pair an authenticator app. The public link will start after you confirm its code.</Text>
            {tunnel.allowedEmails.length > 0 ? <Notice tone="danger">Starting a Quick Tunnel will clear the saved email PIN list because Cloudflare's email sign-in is failing. The participant link will be public. Admin sign-in will require your password and authenticator code.</Notice> : null}
            <TextField label="Server password" hint="Enter the password you use to sign in to this server." value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
            <Button label="Set up and start remote access" variant="primary" loading={busy} onPress={() => {
              if (!password.trim()) { setError("Enter your server password above to continue."); return; }
              run(async () => { setSetup(await authApi.beginRemoteAdmin(password)); setStartAfterSetup(true); setPassword(""); });
            }} />
            <Text variant="small" tone="tertiary">Need a participant link only? Start one without admin access.</Text>
            {tunnel.status === "connected" ? <><AddressBox value={tunnel.url!} label="Copy participant link" /><Button label="Stop participant link" variant="secondary" onPress={() => run(tunnel.stop)} /></> : <Button label="Start participant link only" variant="secondary" loading={busy || tunnel.status === "installing" || tunnel.status === "starting"} onPress={() => run(startAccess)} />}
            {tunnel.status === "error" ? <><Notice tone="danger">{tunnel.error || "Could not start the link."}</Notice><Button label="Reset remote access" variant="secondary" onPress={() => run(tunnel.stop)} /></> : null}
          </View>
        )}
        {enabled !== null && error ? <Notice tone="danger">{error}</Notice> : null}
      </>
    </View>
  );
}

function CloudPanel() {
  const { account, connected, loading, login, logout } = useCloudAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSave, setAutoSave] = useState<boolean | null>(null);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) return;
    cloudApi.getAutoSave().then((r: { enabled: boolean; error?: string | null }) => { setAutoSave(r.enabled); setAutoSaveError(r.error ?? null); }).catch(() => setAutoSave(null));
  }, [connected]);

  const toggleAutoSave = async (next: boolean) => {
    setAutoSave(next);
    try {
      setAutoSave((await cloudApi.setAutoSave(next)).enabled);
    } catch (e) {
      setAutoSave(!next);
      setError((e as Error).message);
    }
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <View>
      <>
        {loading ? (
          <View style={{ padding: space[4] }}><Text tone="secondary">Checking cloud connection…</Text></View>
        ) : connected && account ? (
          <>
            <SettingRow label={account.name || account.email || "Signed in"} description={`Signed in as ${account.email}. Forms and responses sync to a private folder in this Google Drive that only this app can see.`}>
              <Button label={busy ? "Signing out…" : "Sign out"} icon={LogOut} loading={busy} onPress={() => run(logout)} />
            </SettingRow>
            <SettingRow last label="Save to Drive automatically" description="Saves new and changed forms, and responses as they come in, whenever you're online. Anything that couldn't go up is retried when the connection is back.">
              <Switch label={autoSave ? "On" : "Off"} checked={!!autoSave} disabled={autoSave === null} onChange={toggleAutoSave} />
            </SettingRow>
            {autoSaveError ? (
              <View style={{ padding: space[4], paddingTop: 0, gap: space[2], alignItems: "flex-start" }}>
                <Notice tone="warning">{`The last automatic save failed: ${autoSaveError}. If it says Unauthorized, Google has expired this sign-in. Sign in again to resume saving.`}</Notice>
                <Button label={busy ? "Opening browser…" : "Sign in again"} icon={Cloud} loading={busy} onPress={() => run(login)} />
              </View>
            ) : null}
          </>
        ) : (
          <SettingRow last label="Not connected" description="Sign in with Google to sync forms and responses between your devices. They are stored in a private folder in your own Google Drive, not on our servers.">
            <Button label={busy ? "Opening browser…" : "Sign in with Google"} icon={Cloud} variant="primary" loading={busy} onPress={() => run(login)} />
          </SettingRow>
        )}
      </>
      {error ? <View style={{ padding: space[4], paddingTop: 0 }}><Notice tone="danger">{error}</Notice></View> : null}
    </View>
  );
}

function PasswordForm() {
  const [f, setF] = useState({ old: "", next: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => { setF((p) => ({ ...p, [k]: v })); setDone(false); };

  const submit = async () => {
    setError(null);
    setDone(false);
    if (!f.old || !f.next) return setError("Current and new password are both required.");
    if (f.next.length < 8) return setError("New password must be at least 8 characters.");
    if (f.next !== f.confirm) return setError("New password and confirmation don't match.");
    setSaving(true);
    try {
      await authApi.changePassword(f.old, f.next);
      setF({ old: "", next: "", confirm: "" });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ padding: space[4], gap: space[3], maxWidth: 420 }}>
      <Text variant="bodyStrong">Change password</Text>
      <TextField label="Current password" value={f.old} onChangeText={set("old")} secureTextEntry autoComplete="current-password" autoCapitalize="none" />
      <TextField label="New password" value={f.next} onChangeText={set("next")} secureTextEntry autoComplete="new-password" autoCapitalize="none" hint="At least 8 characters." />
      <TextField label="Confirm new password" value={f.confirm} onChangeText={set("confirm")} secureTextEntry autoComplete="new-password" autoCapitalize="none" onSubmitEditing={submit} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {done ? <Notice tone="success">Password updated.</Notice> : null}
      <Button label="Change password" variant="primary" loading={saving} onPress={submit} />
    </View>
  );
}

function RecoveryForm() {
  const hasQuestion = useAuthStore((s) => s.hasRecoveryQuestion);
  const { recoveryQuestionSet } = useAuthActions();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ currentPassword: "", question: "", answer: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => { setF((p) => ({ ...p, [k]: v })); setDone(false); };

  const submit = async () => {
    setError(null);
    setDone(false);
    if (!f.currentPassword || !f.question.trim() || !f.answer.trim()) return setError("Your current password, a question, and an answer are all required.");
    setSaving(true);
    try {
      await authApi.setRecoveryQuestion(f.currentPassword, f.question.trim(), f.answer.trim());
      recoveryQuestionSet();
      setF({ currentPassword: "", question: "", answer: "" });
      setDone(true);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      {hasQuestion && !editing ? (
        <SettingRow last label="Recovery question" description="Used on the login screen to reset your password if you forget it.">
          <Button label="Change" onPress={() => { setEditing(true); setError(null); }} />
        </SettingRow>
      ) : (
        <View style={{ padding: space[4], gap: space[3], maxWidth: 420 }}>
          <Text variant="bodyStrong">Recovery question</Text>
          {!hasQuestion ? <Notice tone="warning">No recovery question is set. If you forget your password, you won't be able to get back in without editing the database directly.</Notice> : null}
          <TextField label="Question" value={f.question} onChangeText={set("question")} placeholder="e.g. What was your first pet's name?" />
          <TextField label="Answer" value={f.answer} onChangeText={set("answer")} autoComplete="off" />
          <TextField label="Current password" value={f.currentPassword} onChangeText={set("currentPassword")} secureTextEntry autoComplete="current-password" autoCapitalize="none" onSubmitEditing={submit} />
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <View style={{ flexDirection: "row", gap: space[2] }}>
            {editing ? <Button label="Cancel" variant="ghost" onPress={() => { setEditing(false); setError(null); }} /> : null}
            <Button label={hasQuestion ? "Update recovery question" : "Set recovery question"} variant="primary" loading={saving} onPress={submit} />
          </View>
        </View>
      )}
      {done ? <View style={{ padding: space[4], paddingTop: 0 }}><Notice tone="success">Recovery question saved.</Notice></View> : null}
    </View>
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const flat = { borderRadius: 0, backgroundColor: "transparent" } as const;
  const [confirmClear, setConfirmClear] = useState(false);
  const [text, setText] = useState("");
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const close = () => { setConfirmClear(false); setText(""); setClearError(null); };
  const clear = async () => {
    if (text !== CLEAR_CONFIRM || clearing) return;
    setClearing(true);
    setClearError(null);
    try {
      await settingsApi.clearData();
      close();
      toast("All local data cleared");
      router.replace("/dashboard");
    } catch (e) {
      setClearError((e as Error).message);
    } finally {
      setClearing(false);
    }
  };

  return (
    <Page maxWidth={820}>
      <PageHeader title="Settings" subtitle="Configure how this server and your account behave." />
      <Section title="Settings">
        <Surface padded={false} style={flat}>
          <SettingGroup title="Appearance" description="Choose how the interface looks on this device"><AppearancePanel /></SettingGroup>
          <SettingGroup title="Local server" description="For participants on the same network"><ServerPanel /></SettingGroup>
          <SettingGroup title="Remote access" description="Share forms and manage this server from another network"><RemoteAdminPanel /></SettingGroup>
          <SettingGroup title="Cloud account" description="Connect Google to sync forms and responses through your own Google Drive"><CloudPanel /></SettingGroup>
          <SettingGroup title="Security" description="Your server password and recovery question" last>
            <PasswordForm />
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <RecoveryForm />
          </SettingGroup>
        </Surface>
      </Section>

      <Section title="Defaults">
        <Surface padded={false} style={flat}>
          <DefaultsGroups />
        </Surface>
      </Section>

      <Section title="Danger zone" description="Irreversible actions. Check twice.">
        <Surface padded={false} style={flat}>
          <SettingRow last label="Clear all local data" description="Removes forms, sessions and responses from this server.">
            <Button label="Clear data" icon={Trash2} variant="danger" onPress={() => setConfirmClear(true)} />
          </SettingRow>
        </Surface>
      </Section>

      <Dialog
        visible={confirmClear}
        title="Clear all local data"
        onClose={close}
        footer={<><Button label="Cancel" variant="ghost" onPress={close} /><Button label="Clear all data" variant="danger" disabled={text !== CLEAR_CONFIRM} loading={clearing} onPress={clear} /></>}
      >
        <Text tone="secondary">This permanently deletes every form, question, session and response on this server, along with every folder except "General". This can't be undone.</Text>
        <TextField label={`Type ${CLEAR_CONFIRM} to confirm`} value={text} onChangeText={setText} autoFocus autoComplete="off" autoCapitalize="characters" onSubmitEditing={clear} />
        {clearError ? <Notice tone="danger">{clearError}</Notice> : null}
      </Dialog>
    </Page>
  );
}

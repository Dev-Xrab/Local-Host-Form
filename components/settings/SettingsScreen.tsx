import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Check, Cloud, Copy, Globe, LogOut, Trash2 } from "lucide-react-native";
import useAuthStore, { useAuthActions } from "../../store/useAuthStore";
import { authApi } from "../../src/features/auth/services/authApi";
import { settingsApi } from "../../src/features/settings/services/settingsApi";
import { Button, Dialog, IconButton, Notice, Page, PageHeader, SegmentedControl, Section, SettingRow, Surface, Text, TextField, radius, space, useTheme, useToast } from "../../ui";
import { useCloudAccount, useTunnel } from "../../lib/data";
import { copyText } from "../../lib/platform";
import { useServerOrigin } from "../../lib/useServerOrigin";

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

function AppearanceSection() {
  const { mode, setMode } = useTheme();
  return (
    <Section split title="Appearance" description="Choose how the interface looks on this device.">
      <Surface padded={false}>
        <SettingRow last label="Theme" description="Dark is the default. System follows your device.">
          <SegmentedControl value={mode} onChange={setMode} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }, { value: "system", label: "System" }]} />
        </SettingRow>
      </Surface>
    </Section>
  );
}

function ServerSection() {
  const origin = useServerOrigin();
  const hostingOnPhone = useAuthStore((s) => s.hostingOnPhone);
  const tunnel = useTunnel();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const starting = tunnel.status === "installing" || tunnel.status === "starting";

  return (
    <Section split title="Server" description="Where students reach this server, locally or over the internet.">
      <Surface padded={false}>
        <SettingRow label="Local server address" description="Share this with students on the same network.">
          <AddressBox value={origin} label="Copy address" />
        </SettingRow>
        {hostingOnPhone ? (
          <SettingRow last label="Remote access (Internet)" description="Not available when this phone is the host: the public-link tunnel needs a program that can't run on a phone. Students on the same Wi-Fi can still join with the address above. For internet access, host from a computer, or sync to your cloud account." >
            <Text variant="small" tone="tertiary">Unavailable on phone</Text>
          </SettingRow>
        ) : (
        <SettingRow
          last
          stacked
          label="Remote access (Internet)"
          description="Create a temporary public link so students can join from outside this network, with no router setup and no account. Powered by a Cloudflare Quick Tunnel: the link changes every time you start it, and stops working as soon as you stop it or close the app."
        >
          <View style={{ gap: space[2], alignItems: "flex-start" }}>
            {tunnel.status === "connected" ? (
              <Button label="Stop" variant="danger" loading={busy} onPress={() => run(tunnel.stop)} />
            ) : (
              <Button label={tunnel.status === "installing" ? "Setting up…" : tunnel.status === "starting" ? "Connecting…" : "Start remote access"} icon={Globe} variant="primary" loading={busy || starting} onPress={() => run(tunnel.start)} />
            )}
            {tunnel.status === "connected" && tunnel.url ? <AddressBox value={tunnel.url} label="Copy link" /> : null}
            {tunnel.status === "error" && tunnel.error ? <Text variant="small" tone="danger">{tunnel.error}</Text> : null}
          </View>
        </SettingRow>
        )}
      </Surface>
    </Section>
  );
}

function CloudSection() {
  const { account, connected, loading, login, logout } = useCloudAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Section split title="Cloud account" description="Connect Google to sync forms and responses.">
      <Surface padded={false}>
        {loading ? (
          <View style={{ padding: space[4] }}><Text tone="secondary">Checking cloud connection…</Text></View>
        ) : connected && account ? (
          <SettingRow last label={account.name || account.email || "Signed in"} description={`Signed in as ${account.email}. Forms can be imported from and published to this account.`}>
            <Button label={busy ? "Signing out…" : "Sign out"} icon={LogOut} loading={busy} onPress={() => run(logout)} />
          </SettingRow>
        ) : (
          <SettingRow last label="Not connected" description="Sign in with Google to import forms from your account and publish forms from this device.">
            <Button label={busy ? "Opening browser…" : "Sign in with Google"} icon={Cloud} variant="primary" loading={busy} onPress={() => run(login)} />
          </SettingRow>
        )}
      </Surface>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Section>
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
      <AppearanceSection />
      <ServerSection />
      <CloudSection />
      <Section split title="Security" description="Your server password and recovery question.">
        <Surface padded={false}>
          <PasswordForm />
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <RecoveryForm />
        </Surface>
      </Section>
      <Section split title="Danger zone" description="Irreversible actions. Check twice.">
        <Surface padded={false}>
          <SettingRow last label="Clear all local data" description="Removes quizzes, folders, and forms from this server.">
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
        <Text tone="secondary">This permanently deletes every quiz, form, question, session, and response on this server, along with every folder except "General". This can't be undone.</Text>
        <TextField label={`Type ${CLEAR_CONFIRM} to confirm`} value={text} onChangeText={setText} autoFocus autoComplete="off" autoCapitalize="characters" onSubmitEditing={clear} />
        {clearError ? <Notice tone="danger">{clearError}</Notice> : null}
      </Dialog>
    </Page>
  );
}

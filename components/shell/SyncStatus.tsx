import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { AlertTriangle, Check, Cloud, CloudOff, RefreshCw, Wifi } from "lucide-react-native";
import { useSyncIssues } from "../../src/features/cloud/hooks/useSyncIssues";
import { Button, Dialog, EmptyState, IconButton, Notice, Spinner, Text, radius, space, useTheme } from "../../ui";
import { timeAgo } from "../timeAgo";

export interface SyncSummary { uploaded: number; downloaded: number; rejected?: unknown[]; downloadFailed?: unknown[]; incomplete?: boolean }
export interface SyncState {
  status: { pendingCount?: number; failedCount?: number; unsavedToCloudCount?: number; lastSyncedAt?: string; autoSave?: boolean; autoSaveError?: string | null } | null;
  phase: "checking" | "disconnected" | "offline" | "online" | "syncing" | "synced" | "error";
  result: SyncSummary | null;
  error: string | null;
  sync: () => Promise<SyncSummary>;
}

/**
 * Five distinct phases, not one generic spinner: offline, online-idle, syncing, synced and error
 * each mean something different to a host deciding whether it's safe to close the laptop.
 */
export function SyncStatus({ sync, compact }: { sync: SyncState; compact?: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [showIssues, setShowIssues] = useState(false);
  const { status, phase, result, error } = sync;

  if (phase === "checking") return null;

  const pending = status?.pendingCount || 0;
  const failed = status?.failedCount || 0;
  const busy = phase === "syncing";

  if (phase === "disconnected") {
    return compact ? (
      <IconButton icon={CloudOff} label="Connect Google to enable sync" onPress={() => router.push("/dashboard/settings")} />
    ) : (
      <Button label="Connect Google to sync" icon={Cloud} variant="ghost" compact onPress={() => router.push("/dashboard/settings")} />
    );
  }

  const tone = { offline: colors.warning, online: colors.success, syncing: colors.accent, synced: colors.success, error: colors.danger }[phase as string] ?? colors.textTertiary;
  const PhaseIcon = phase === "offline" ? Wifi : phase === "synced" ? Check : phase === "error" ? AlertTriangle : RefreshCw;
  const partial = result && (result.rejected?.length || result.downloadFailed?.length);

  const label =
    phase === "offline" ? "Offline"
    : phase === "online" ? "Online"
    : phase === "syncing" ? "Syncing…"
    : phase === "synced" ? "Synced"
    : partial ? "Sync partially completed" : "Sync failed";

  const detail =
    phase === "offline" ? (pending > 0 ? `${pending} response${pending === 1 ? "" : "s"} waiting to sync` : "Responses save locally")
    : phase === "online" ? `${status?.lastSyncedAt ? `Last synced ${timeAgo(status.lastSyncedAt)}` : "Never synced"}${pending > 0 ? ` · ${pending} pending` : ""}${status?.autoSave === false ? " · auto-save off" : ""}${status?.autoSaveError ? ` · auto-save: ${status.autoSaveError}` : ""}`
    : phase === "syncing" ? "Uploading and downloading changes"
    : phase === "synced" && result ? `${result.uploaded} uploaded · ${result.downloaded} downloaded${result.incomplete ? " · more to sync" : ""}`
    : error || (result ? `Uploaded ${result.uploaded}, downloaded ${result.downloaded}, ${(result.rejected?.length || 0) + (result.downloadFailed?.length || 0)} failed` : "");

  if (compact) {
    return (
      <>
        <IconButton icon={PhaseIcon} label={`${label}. ${detail}. Tap to sync.`} disabled={busy || phase === "offline"} onPress={() => sync.sync().catch(() => {})} />
        {failed > 0 ? <IssuesDialog visible={showIssues} onClose={() => setShowIssues(false)} /> : null}
      </>
    );
  }

  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: "row", gap: space[2], alignItems: "flex-start" }} accessibilityLiveRegion="polite">
        <View style={{ width: 8, height: 8, borderRadius: radius.pill, backgroundColor: tone, marginTop: 6 }} />
        <View style={{ flex: 1 }}>
          <Text variant="label">{label}</Text>
          <Text variant="caption" tone="secondary" style={{ fontWeight: "400" }}>{detail}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
        <Button
          label={busy ? "Syncing…" : phase === "error" ? "Retry" : "Sync now"}
          icon={RefreshCw}
          compact
         
          disabled={busy || phase === "offline"}
          onPress={() => sync.sync().catch(() => {})}
        />
        {failed > 0 ? <Button label={`${failed} need${failed === 1 ? "s" : ""} attention`} compact variant="ghost" onPress={() => setShowIssues(true)} /> : null}
      </View>
      <IssuesDialog visible={showIssues} onClose={() => setShowIssues(false)} />
    </View>
  );
}

// Surfaces what the "N need attention" count only hints at: which response failed to sync, on
// which form, and why — a rejected response otherwise sits in 'failed' and is retried forever
// with no way for the host to act on it.
function IssuesDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { issues, loading, error, actingId, refresh, retry, discard } = useSyncIssues();

  useEffect(() => {
    if (visible) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Dialog visible={visible} title="Sync issues" onClose={onClose} width={520}>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {loading ? (
        <Spinner label="Loading" />
      ) : issues.length === 0 ? (
        <EmptyState icon={Check} title="Nothing needs attention" />
      ) : (
        issues.map((issue: { id: string; formTitle?: string; respondentName?: string; submittedAt?: string; retryCount: number; syncError?: string; nonRetryable?: boolean }) => (
          <View key={issue.id} style={{ gap: space[2], paddingBottom: space[3], borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text variant="bodyStrong">{issue.formTitle || "Untitled form"}{issue.respondentName ? ` — ${issue.respondentName}` : ""}</Text>
            <Text variant="small" tone="secondary">{timeAgo(issue.submittedAt)} · retried {issue.retryCount}×</Text>
            <Text variant="small" tone="danger">{issue.syncError || "Unknown error"}</Text>
            <View style={{ flexDirection: "row", gap: space[2] }}>
              {!issue.nonRetryable ? <Button label="Retry" compact disabled={actingId === issue.id} onPress={() => retry(issue.id)} /> : null}
              <Button label="Discard" compact variant="ghost" disabled={actingId === issue.id} onPress={() => discard(issue.id)} />
            </View>
          </View>
        ))
      )}
    </Dialog>
  );
}

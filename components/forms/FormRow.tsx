import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Cloud, Download, FileText, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react-native";
import { Badge, Dialog, Icon, IconButton, ListRow, Text, space, useLayout, useTheme } from "../../ui";
import { useFocusRing } from "../../ui/interactive";
import type { FormSummary } from "../../lib/domain";
import { formatRelative } from "../../src/features/sessions/utils/time";

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

// Where this form lives, as one status pill. What the host most needs at a glance is whether the
// cloud copy is in step with what's on this device.
export function cloudStatus(form: FormSummary): { tone: Tone; label: string } {
  if (form.googleFormId) return form.hasUnsavedCloudChanges ? { tone: "warning", label: "Google · unsaved" } : { tone: "accent", label: "Google Forms" };
  if (form.remoteFormId) return form.hasUnsavedCloudChanges ? { tone: "warning", label: "Cloud · unsaved" } : { tone: "success", label: "Cloud" };
  return { tone: "neutral", label: "Local" };
}

export const FORM_ACTIONS_WIDTH = 160;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export interface FormRowActions {
  cloudConnected: boolean;
  exporting: boolean;
  publishing: boolean;
  refreshing: boolean;
  onExport: (f: FormSummary) => void;
  onPublish: (f: FormSummary) => void;
  onRefreshGoogle: (f: FormSummary) => void;
  onDelete: (f: FormSummary) => void;
}

export function FormRow({ form, a, last }: { form: FormSummary; a: FormRowActions; last?: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();
  const { isPhone } = useLayout();
  const { ring, onFocus, onBlur } = useFocusRing(colors);
  const [sheet, setSheet] = useState(false);
  const status = cloudStatus(form);
  const open = () => router.push(`/forms/${form.id}` as never);

  const publishLabel = form.hasUnsavedCloudChanges ? "Save changes to cloud" : form.remoteFormId ? "Save to cloud" : "Publish to cloud";

  const actions = (
    <View style={{ flexDirection: "row", width: FORM_ACTIONS_WIDTH, justifyContent: "flex-end" }}>
      <IconButton icon={Download} label="Export as JSON" disabled={a.exporting} onPress={() => a.onExport(form)} />
      {a.cloudConnected ? <IconButton icon={Cloud} label={publishLabel} disabled={a.publishing} onPress={() => a.onPublish(form)} /> : null}
      {a.cloudConnected && form.googleFormId ? <IconButton icon={RefreshCw} label="Sync from Google Forms" disabled={a.refreshing} onPress={() => a.onRefreshGoogle(form)} /> : null}
      <IconButton icon={Trash2} label="Delete form" tone="danger" onPress={() => a.onDelete(form)} />
    </View>
  );

  const stats = `${plural(form.questionCount, "question")} · ${plural(form.responseCount, "response")}`;

  if (isPhone) {
    return (
      <>
        <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
          <View style={{ flex: 1 }}>
            <ListRow
              icon={FileText}
              title={form.title || "Untitled form"}
              subtitle={`${stats} · edited ${formatRelative(form.updatedAt, { short: true })}`}
              onPress={open}
              last
            />
          </View>
          <IconButton icon={MoreHorizontal} label={`Actions for ${form.title || "Untitled form"}`} onPress={() => setSheet(true)} />
        </View>
        <Dialog visible={sheet} title={form.title || "Untitled form"} onClose={() => setSheet(false)}>
          <Badge label={status.label} tone={status.tone} />
          {form.unsavedResponseCount ? <Text variant="small" tone="warning">{plural(form.unsavedResponseCount, "response")} not saved to cloud yet</Text> : null}
          <SheetAction icon={Download} label="Export as JSON" onPress={() => { setSheet(false); a.onExport(form); }} />
          {a.cloudConnected ? <SheetAction icon={Cloud} label={publishLabel} onPress={() => { setSheet(false); a.onPublish(form); }} /> : null}
          {a.cloudConnected && form.googleFormId ? <SheetAction icon={RefreshCw} label="Sync from Google Forms" onPress={() => { setSheet(false); a.onRefreshGoogle(form); }} /> : null}
          <SheetAction icon={Trash2} label="Delete form" danger onPress={() => { setSheet(false); a.onDelete(form); }} />
        </Dialog>
      </>
    );
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open ${form.title || "Untitled form"}`}
      onPress={open}
      onFocus={onFocus}
      onBlur={onBlur}
      style={(s) => [
        { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 56, paddingLeft: space[4], paddingRight: space[2], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border },
        (s as { hovered?: boolean }).hovered && { backgroundColor: colors.hover },
        ring,
      ]}
    >
      <Icon icon={FileText} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1}>{form.title || "Untitled form"}</Text>
        <Text variant="small" tone={form.description ? "secondary" : "tertiary"} numberOfLines={1}>{form.description || "No description"}</Text>
        {form.unsavedResponseCount ? <Text variant="caption" tone="danger">{plural(form.unsavedResponseCount, "response")} not saved to cloud yet</Text> : null}
      </View>
      <View style={{ width: 120 }}><Badge label={status.label} tone={status.tone} /></View>
      <View style={{ width: 150 }}>
        <Text variant="small">{stats}</Text>
        <Text variant="caption" tone="tertiary">{form.lastResponseAt ? `Last ${formatRelative(form.lastResponseAt, { short: true })}` : "No responses"}</Text>
      </View>
      <View style={{ width: 96 }}><Text variant="small" tone="secondary">{formatRelative(form.updatedAt)}</Text></View>
      {actions}
    </Pressable>
  );
}

function SheetAction({ icon, label, onPress, danger }: { icon: typeof Cloud; label: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 48 }}>
      <Icon icon={icon} color={danger ? colors.danger : colors.textSecondary} />
      <Text tone={danger ? "danger" : "default"}>{label}</Text>
    </Pressable>
  );
}

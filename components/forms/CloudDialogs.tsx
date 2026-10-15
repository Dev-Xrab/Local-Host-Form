import { useState } from "react";
import { View } from "react-native";
import { describeCloudError } from "../../src/features/cloud/utils/describeCloudError";
import { Button, Dialog, Notice, Text, space } from "../../ui";

/** Shown instead of silently launching the OS-browser sign-in (or a raw API error) when a cloud action is attempted signed out. */
export function GoogleAuthRequiredDialog({ visible, onConfirm, onCancel }: { visible: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Dialog
      visible={visible}
      title="Google account required"
      onClose={onCancel}
      footer={<><Button label="Cancel" variant="ghost" onPress={onCancel} /><Button label="Sign in with Google" variant="primary" onPress={onConfirm} /></>}
    >
      <Text tone="secondary">You need to sign in with Google before importing a form. Sign-in opens in your browser.</Text>
    </Dialog>
  );
}

/**
 * Responses fetched from Google are stored on this device first; this is the "save them to your
 * cloud account too?" question. `onSave` performs the save and throws on failure, which is shown
 * here and leaves the responses safely on the device.
 */
export function SaveResponsesPrompt({ count, onSave, onDismiss }: { count: number; onSave: () => Promise<void>; onDismiss?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave();
    } catch (err) {
      setError(describeCloudError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space[2] }}>
      <Notice tone="info">{`${count} response${count === 1 ? "" : "s"} fetched from Google ${count === 1 ? "is" : "are"} saved on this device only. Save ${count === 1 ? "it" : "them"} to your cloud account too?`}</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <Button label="Save to cloud" variant="primary" compact loading={busy} onPress={save} />
        {onDismiss ? <Button label="Not now" variant="ghost" compact disabled={busy} onPress={onDismiss} /> : null}
      </View>
    </View>
  );
}

export interface GoogleDiff {
  added: { id: string; title: string }[];
  modified: { id: string; title: string }[];
  removed: { id: string; title: string }[];
  reordered?: boolean;
  skippedUnsupported?: unknown[];
}

const SECTIONS = [
  { key: "added", label: "Added", prefix: "+" },
  { key: "modified", label: "Modified", prefix: "~" },
  { key: "removed", label: "Removed", prefix: "−" },
] as const;

/** Shown whenever a structural check finds the linked Google Form changed since the last sync. The full diff is inline. */
export function GoogleSyncDialog({ diff, busy, onKeepLocal, onSyncFromOnline, onCancel }: { diff: GoogleDiff | null; busy: boolean; onKeepLocal: () => void; onSyncFromOnline: () => void; onCancel: () => void }) {
  const skipped = diff?.skippedUnsupported?.length ?? 0;
  return (
    <Dialog
      visible={!!diff}
      title="Changes detected in the online form"
      onClose={onCancel}
      width={520}
      footer={<><Button label="Keep local version" variant="ghost" disabled={busy} onPress={onKeepLocal} /><Button label="Sync from online" variant="primary" loading={busy} onPress={onSyncFromOnline} /></>}
    >
      <Text tone="secondary">The linked Google Form has changed since this form was last synced. Review what's different, then choose how to handle it.</Text>
      {diff && SECTIONS.map(({ key, label, prefix }) =>
        diff[key].length === 0 ? null : (
          <View key={key} style={{ gap: 2 }}>
            <Text variant="label">{label}</Text>
            {diff[key].map((q) => <Text key={q.id} variant="small" tone="secondary">{prefix} {q.title}</Text>)}
          </View>
        )
      )}
      {diff?.reordered ? <Text variant="small" tone="secondary">Questions have also been reordered online.</Text> : null}
      {skipped > 0 ? <Text variant="small" tone="secondary">{`${skipped} question${skipped === 1 ? "" : "s"} on the online form can't be imported (unsupported question type) and ${skipped === 1 ? "isn't" : "aren't"} reflected above.`}</Text> : null}
      <Text variant="small" tone="tertiary">Removing a question here never deletes its past answers. It stays visible, labeled as removed, in this form's response history.</Text>
    </Dialog>
  );
}

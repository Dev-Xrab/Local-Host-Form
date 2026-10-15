import { useEffect, useState } from "react";
import { Button, Dialog, Notice, Radio, Text, TextField } from "../../ui";
import type { Subject } from "../../lib/domain";
import { oneLine } from "../../lib/text";

const COUNTDOWN_SECONDS = 5;

/** One dialog for both "New folder" (initial = null) and "Rename" (initial set), so renaming has no separate implementation. */
export function SubjectFormDialog({ visible, initial, onClose, onSave }: { visible: boolean; initial: Subject | null; onClose: () => void; onSave: (v: { name: string; code: string }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? "");
    setCode(initial?.code ?? "");
    setError(null);
  }, [visible, initial]);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), code: code.trim() });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      title={initial ? "Rename folder" : "New folder"}
      onClose={onClose}
      footer={<><Button label="Cancel" variant="ghost" onPress={onClose} /><Button label={initial ? "Save changes" : "Create folder"} variant="primary" disabled={!name.trim()} loading={busy} onPress={submit} /></>}
    >
      <TextField label="Folder name" value={name} onChangeText={setName} placeholder="e.g. Data Structures" autoFocus onSubmitEditing={submit} />
      <TextField label="Folder code (optional)" value={code} onChangeText={setCode} placeholder="e.g. CC104" onSubmitEditing={submit} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Dialog>
  );
}

/**
 * Deleting a folder is destructive to more than the folder once "delete" is chosen: it takes every
 * form under it, and their sessions and responses, with it. The countdown exists only to stop a
 * reflex click before the choice is read.
 */
export function DeleteSubjectDialog({ subject, onCancel, onConfirm }: { subject: Subject | null; onCancel: () => void; onConfirm: (formsAction: "move" | "delete") => Promise<void> }) {
  const [action, setAction] = useState<"move" | "delete">("move");
  const [left, setLeft] = useState(COUNTDOWN_SECONDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subject) return;
    setAction("move");
    setLeft(COUNTDOWN_SECONDS);
    setBusy(false);
    setError(null);
  }, [subject]);

  useEffect(() => {
    if (!subject || left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [subject, left]);

  const confirm = async () => {
    if (left > 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(action);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const n = subject?.formCount ?? 0;
  return (
    <Dialog
      visible={!!subject}
      title="Delete folder"
      onClose={onCancel}
      footer={<><Button label="Cancel" variant="ghost" onPress={onCancel} /><Button label={left > 0 ? `Delete folder (${left})` : "Delete folder"} variant="danger" disabled={left > 0} loading={busy} onPress={confirm} /></>}
    >
      <Text>{`Delete the "${oneLine(subject?.name)}" folder${n > 0 ? ` and its ${n} form${n === 1 ? "" : "s"}` : ""}?`}</Text>
      {n > 0 ? (
        <>
          <Radio label="Move forms to General" description="The forms stay; they just leave this folder." checked={action === "move"} onChange={() => setAction("move")} />
          <Radio label="Delete all forms in this folder" description={`Permanently deletes ${n} form${n === 1 ? "" : "s"} and every session and response under them. This can't be undone.`} checked={action === "delete"} onChange={() => setAction("delete")} />
        </>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Dialog>
  );
}

import { useState } from "react";
import { Button, Dialog, Notice, Select, TextField } from "../../ui";
import type { Subject } from "../../lib/domain";

export interface NewForm { title: string; description: string; subjectId: string | null }

/** Name, description and folder for a blank form. Every form always has a real folder (the server defaults to "General"). */
export function CreateFormDialog({ visible, subjects, onClose, onCreate }: { visible: boolean; subjects: Subject[]; onClose: () => void; onCreate: (f: NewForm) => Promise<void> }) {
  const defaultId = subjects.find((s) => s.isDefault)?.id ?? null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({ title: name.trim(), description: description.trim(), subjectId: subjectId ?? defaultId });
      setName("");
      setDescription("");
      setSubjectId(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      title="New form"
      onClose={onClose}
      footer={<><Button label="Cancel" variant="ghost" onPress={onClose} /><Button label="Create form" variant="primary" disabled={!name.trim()} loading={busy} onPress={submit} /></>}
    >
      <TextField label="Form name" value={name} onChangeText={setName} placeholder="e.g. Midterm feedback" autoFocus onSubmitEditing={submit} />
      <TextField label="Description" value={description} onChangeText={setDescription} placeholder="What is this form for?" multiline rows={3} />
      <Select label="Folder" value={subjectId ?? defaultId} onChange={setSubjectId} options={subjects.map((s) => ({ value: s.id, label: s.name }))} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Dialog>
  );
}

import { useState } from "react";
import { View } from "react-native";
import { DURATION_DEFAULT_SECONDS, durationPartsToSeconds } from "../../src/features/sessions/utils/time";
import { sessionsApi } from "../../src/features/sessions/services/sessionsApi";
import { Button, Checkbox, Dialog, Notice, Select, SearchSelect, TextField, space } from "../../ui";
import type { FormSummary } from "../../lib/domain";

const EMPTY = { name: "", formId: "", durationMinutes: "", responsesEditable: false, fullscreenEnabled: false, refocusLock: false, refocusValue: String(DURATION_DEFAULT_SECONDS), refocusUnit: "seconds" };

export function CreateSessionDialog({ visible, forms, onClose, onCreated }: { visible: boolean; forms: FormSummary[]; onClose: () => void; onCreated: () => void | Promise<unknown> }) {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.name.trim() || !f.formId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await sessionsApi.create({
        name: f.name.trim(),
        formId: f.formId,
        durationMinutes: f.durationMinutes ? Number(f.durationMinutes) : null,
        responsesEditable: f.responsesEditable,
        fullscreenEnabled: f.fullscreenEnabled,
        refocusLockSeconds: f.refocusLock ? durationPartsToSeconds(f.refocusValue, f.refocusUnit) : null,
      });
      setF(EMPTY);
      await onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      title="Create session"
      onClose={onClose}
      width={500}
      footer={<><Button label="Cancel" variant="ghost" onPress={onClose} /><Button label="Create session" variant="primary" disabled={!f.name.trim() || !f.formId} loading={busy} onPress={submit} /></>}
    >
      <TextField label="Session name" value={f.name} onChangeText={(v) => set("name", v)} placeholder="e.g. Midterm examination" autoFocus />
      <SearchSelect label="Form" value={f.formId || null} placeholder="Choose a form" searchPlaceholder="Search forms" emptyText="No forms found." onChange={(v) => set("formId", v)} options={forms.map((x) => ({ value: x.id, label: x.title || "Untitled form", meta: `${x.questionCount} question${x.questionCount === 1 ? "" : "s"}` }))} />
      <TextField label="Time limit per respondent (minutes, optional)" value={f.durationMinutes} onChangeText={(v) => set("durationMinutes", v.replace(/\D/g, ""))} keyboardType="numeric" placeholder="No limit" />
      <Checkbox label="Allow respondents to edit their answer after submitting" checked={f.responsesEditable} onChange={(v) => set("responsesEditable", v)} />
      <Checkbox label="Fullscreen when a respondent starts answering" checked={f.fullscreenEnabled} onChange={(v) => set("fullscreenEnabled", v)} />
      <Checkbox label="Lock the screen for a countdown when a respondent switches tabs and comes back" checked={f.refocusLock} onChange={(v) => set("refocusLock", v)} />
      {f.refocusLock ? (
        <View style={{ flexDirection: "row", gap: space[2], paddingLeft: space[5] }}>
          <View style={{ width: 90 }}><TextField label="Length" value={f.refocusValue} onChangeText={(v) => set("refocusValue", v.replace(/\D/g, ""))} keyboardType="numeric" /></View>
          <View style={{ width: 140 }}><Select label="Unit" value={f.refocusUnit as "seconds" | "minutes"} options={[{ value: "seconds", label: "seconds" }, { value: "minutes", label: "minutes" }]} onChange={(v) => set("refocusUnit", v)} /></View>
        </View>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Dialog>
  );
}

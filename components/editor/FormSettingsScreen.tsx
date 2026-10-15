import { useState } from "react";
import { useRouter } from "expo-router";
import { formsApi } from "../../src/features/forms/services/formsApi";
import { Button, Notice, Page, PageHeader, Section, Select, SettingRow, Surface, Switch, useToast } from "../../ui";
import { useSubjects } from "../../lib/data";
import { DeleteFormDialog } from "../forms/DeleteFormDialog";
import { useFormActions, useFormStore, type FormSettings } from "../../lib/formStore";
import { buildFormExport } from "../../lib/formExport";
import { saveTextFile } from "../../lib/saveFile";

type Extra = FormSettings & { downloadIncludesChoices?: boolean };

function Toggle({ label, description, field, last }: { label: string; description: string; field: keyof Extra; last?: boolean }) {
  const settings = useFormStore((s) => s.formSettings) as Extra;
  const { updateFormSettings } = useFormActions();
  return (
    <SettingRow label={label} description={description} last={last}>
      <Switch label={settings[field] ? "On" : "Off"} checked={!!settings[field]} onChange={(v) => updateFormSettings({ [field]: v } as Partial<FormSettings>)} />
    </SettingRow>
  );
}

export function FormSettingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const formId = useFormStore((s) => s.formId)!;
  const title = useFormStore((s) => s.formTitle);
  const subjectId = useFormStore((s) => s.subjectId);
  const { setSubjectId } = useFormActions();
  const { subjects } = useSubjects();
  const defaultId = subjects.find((s) => s.isDefault)?.id ?? null;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportForm = async () => {
    setExporting(true);
    setError(null);
    try {
      const { filename, json } = buildFormExport(await formsApi.get(formId));
      await saveTextFile(filename, json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Page maxWidth={760}>
      <PageHeader title="Settings" subtitle="Everything here runs locally on this server. Changes apply when you save the form." />

      <Section title="Organization">
        <Surface padded={false}>
          <SettingRow label="Folder" description="Group this form under a folder on the dashboard." last>
            <Select value={subjectId ?? defaultId} options={subjects.map((s) => ({ value: s.id, label: s.name }))} onChange={setSubjectId} />
          </SettingRow>
        </Surface>
      </Section>

      <Section title="Responses" description="Session codes and time limits are set per session, not here, so a form can be reused across many sessions.">
        <Surface padded={false}>
          <Toggle field="allowMultipleResponses" label="Allow multiple responses per device" description="Let the same device start a new attempt instead of resuming or blocking a repeat." />
          <Toggle field="blurOnDisconnect" label="Blur the screen when a respondent loses connection" description="If a respondent's device can't reach this server, their screen is blurred and locked until the connection is back. Their answers are kept." />
          <Toggle field="shuffleQuestions" label="Randomize question order" description="Each respondent sees the questions in a different random order. Sections keep their order and the questions inside each one are shuffled. The order stays the same if a respondent refreshes. Scoring is unaffected." />
          <Toggle field="restrictCopying" last label="Restrict copying on the respondent screen" description="Blocks right-click, text selection, copy, cut, select-all, dragging and printing while a respondent answers, and clears the clipboard on Print Screen. This discourages copying but can't stop a photo of the screen or a determined user." />
        </Surface>
      </Section>

      <Section title="Results">
        <Surface padded={false}>
          <Toggle field="showScoreImmediately" label="Show score immediately" description="Respondents see their score right after submitting." />
          <Toggle field="revealCorrectAnswers" last label="Reveal correct answers" description="Respondents can see which answers were correct after submitting." />
        </Surface>
      </Section>

      <Section title="Downloads">
        <Surface padded={false}>
          <Toggle field="downloadIncludesChoices" last label="Include all choices in downloaded answers" description="When a respondent downloads their answers, also list every option for multiple-choice questions, not just the one they picked." />
        </Surface>
      </Section>

      <Section title="Backup">
        <Surface padded={false}>
          <SettingRow label="Export this form" description="Download the questions, settings and embedded images as one JSON file. Re-import it here or on another server to recreate this form." last>
            <Button label="Export" loading={exporting} onPress={exportForm} />
          </SettingRow>
        </Surface>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </Section>

      <Section title="Danger zone">
        <Surface padded={false}>
          <SettingRow label="Delete this form" description="Permanently deletes this form along with every session and response under it." last>
            <Button label="Delete form" variant="danger" onPress={() => setConfirmDelete(true)} />
          </SettingRow>
        </Surface>
      </Section>

      <DeleteFormDialog
        form={confirmDelete ? { id: formId, title } : null}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await formsApi.remove(formId);
          toast("Form deleted");
          router.replace("/dashboard/forms");
        }}
      />
    </Page>
  );
}

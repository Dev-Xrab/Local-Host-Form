import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { formsApi } from "../../src/features/forms/services/formsApi";
import { isQuiz } from "../../src/lib/quiz";
import { Button, Notice, Page, PageHeader, Section, Select, SettingRow, Surface, Switch, TextField, space, useToast } from "../../ui";
import { useSubjects } from "../../lib/data";
import { SettingGroup } from "../settings/SettingGroup";
import { DefaultsGroups } from "../settings/DefaultsGroups";
import { DeleteFormDialog } from "../forms/DeleteFormDialog";
import { useFormActions, useFormStore, type FormSettings } from "../../lib/formStore";
import { buildFormExport } from "../../lib/formExport";
import { saveTextFile } from "../../lib/saveFile";

type BoolKey = { [K in keyof FormSettings]-?: FormSettings[K] extends boolean | undefined ? K : never }[keyof FormSettings];

/** A switch bound to one form setting. `invert` flips it, for settings phrased the other way round (e.g. "Limit to 1 response"). */
function Toggle({ label, description, field, last, invert, disabled }: { label: string; description?: string; field: BoolKey; last?: boolean; invert?: boolean; disabled?: boolean }) {
  const settings = useFormStore((s) => s.formSettings);
  const { updateFormSettings } = useFormActions();
  const on = invert ? !settings[field] : !!settings[field];
  return (
    <SettingRow label={label} description={description} last={last}>
      <Switch label={on ? "On" : "Off"} checked={on} disabled={disabled} onChange={(v) => updateFormSettings({ [field]: invert ? !v : v } as Partial<FormSettings>)} />
    </SettingRow>
  );
}

export function FormSettingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const formId = useFormStore((s) => s.formId)!;
  const title = useFormStore((s) => s.formTitle);
  const subjectId = useFormStore((s) => s.subjectId);
  const settings = useFormStore((s) => s.formSettings);
  const questions = useFormStore((s) => s.questions);
  const { setSubjectId, updateFormSettings } = useFormActions();
  const { subjects } = useSubjects();
  const defaultId = subjects.find((s) => s.isDefault)?.id ?? null;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quiz = isQuiz(settings, questions);

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

  const flat = { borderRadius: 0, backgroundColor: "transparent" } as const;

  return (
    <Page maxWidth={760}>
      <PageHeader title="Form settings" subtitle="These rules apply to this form. Changes take effect when you save it on this server." />

      <Section title="Settings">
        <Surface padded={false} style={flat}>
          <SettingRow label="Make this a quiz" description="Assign point values, set answers, and automatically provide feedback" last={!quiz}>
            <Switch label={quiz ? "On" : "Off"} checked={quiz} onChange={(v) => updateFormSettings({ isQuiz: v })} />
          </SettingRow>
          {quiz ? (
            <View style={{ paddingLeft: space[4] }}>
              <Toggle field="showScoreImmediately" label="Release grade immediately after each submission" description="Off hides the score from respondents; you still see it in Results." />
              <Toggle field="showMissedQuestions" label="Respondent can see: missed questions" description="Shows which questions they got right and wrong." />
              <Toggle field="revealCorrectAnswers" label="Respondent can see: correct answers" description="Shows the right answer to each question they missed." />
              <Toggle field="showPointValues" label="Respondent can see: point values" description="Shows the points each question was worth and what they earned." last />
            </View>
          ) : null}

          <SettingGroup title="Responses" description="Manage how responses are collected and protected">
            <Toggle field="collectEmail" label="Collect email addresses" description="Respondents enter an email address before they start. It is saved with their response and included in exports. Addresses are not verified, and this server doesn't send email." />
            <Toggle field="allowDownloadCopy" label="Let respondents download a copy of their answers" description="This server can't send email, so respondents get a download button on the confirmation page instead." />
            <Toggle field="allowResponseEditing" label="Allow response editing" description="Respondents can change their answers with their edit code while the session is active. Applies to every session of this form." />
            <Toggle field="allowMultipleResponses" invert label="Limit to 1 response" description="One response per device in each session; a returning respondent resumes or sees their result." />
            <Toggle field="blurOnDisconnect" label="Blur the screen when a respondent loses connection" description="If a respondent's device can't reach this server, their screen is blurred and locked until the connection is back. Their answers are kept." />
            <Toggle field="restrictCopying" last label="Restrict copying on the respondent screen" description="Blocks right-click, text selection, copy, cut, select-all, dragging and printing while a respondent answers, and clears the clipboard on Print Screen. This discourages copying but can't stop a photo of the screen or a determined user." />
          </SettingGroup>

          <SettingGroup title="Presentation" description="Manage how the form and responses are presented" last>
            <Toggle field="showProgressBar" label="Show progress bar" description="Shows how far through the form a respondent is." />
            <Toggle field="shuffleQuestions" label="Shuffle question order" description="Each respondent sees the questions in a different random order. Sections keep their order and the questions inside each one are shuffled. The order stays the same if a respondent refreshes. Scoring is unaffected." />
            <Toggle field="showSubmitAnother" label="Show link to submit another response" description={settings.allowMultipleResponses ? "Adds a button on the confirmation page to start a new response." : "Turn off “Limit to 1 response” first: a device can only submit once while it is on."} disabled={!settings.allowMultipleResponses} />
            <Toggle field="disableAutosave" label="Disable autosave for all respondents" description="Answers are no longer kept on the respondent's device, so a refresh or closed tab loses them." />
            <Toggle field="downloadIncludesChoices" label="Include all choices in downloaded answers" description="When a respondent downloads their answers, also list every option for multiple-choice questions, not just the one they picked." />
            <SettingRow label="Confirmation message" description="Shown after a respondent submits. Leave empty for the standard message." stacked last>
              <View style={{ width: "100%" }}>
                <TextField multiline rows={3} value={settings.confirmationMessage ?? ""} onChangeText={(v) => updateFormSettings({ confirmationMessage: v })} placeholder="Your response has been recorded." maxLength={2000} />
              </View>
            </SettingRow>
          </SettingGroup>
        </Surface>
      </Section>

      <Section title="Defaults">
        <Surface padded={false} style={flat}>
          <DefaultsGroups form={{ settings, update: updateFormSettings }} />
        </Surface>
      </Section>

      <Section title="Organization">
        <Surface padded={false} style={flat}>
          <SettingRow label="Folder" description="Group this form with others in Forms." last>
            <Select value={subjectId ?? defaultId} options={subjects.map((s) => ({ value: s.id, label: s.name }))} onChange={setSubjectId} />
          </SettingRow>
        </Surface>
      </Section>

      <Section title="Backup">
        <Surface padded={false} style={flat}>
          <SettingRow label="Export this form" description="Download the questions, settings and embedded images as one JSON file. Re-import it here or on another server to recreate this form." last>
            <Button label="Export" loading={exporting} onPress={exportForm} />
          </SettingRow>
        </Surface>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </Section>

      <Section title="Danger zone">
        <Surface padded={false} style={flat}>
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

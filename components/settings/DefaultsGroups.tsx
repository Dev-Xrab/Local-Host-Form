import { useEffect, useState } from "react";
import { View } from "react-native";
import { formsApi } from "../../src/features/forms/services/formsApi";
import { SettingRow, Switch, TextField, useToast } from "../../ui";
import { useFormActions, type FormSettings } from "../../lib/formStore";
import { SettingGroup } from "./SettingGroup";

const FORM_DEFAULTS: { field: "collectEmail" | "allowDownloadCopy" | "allowResponseEditing" | "showProgressBar"; label: string; description: string }[] = [
  { field: "collectEmail", label: "Collect email addresses", description: "Ask respondents for an email address before they start." },
  { field: "allowDownloadCopy", label: "Let respondents download a copy of their answers", description: "Adds a download button to the confirmation page." },
  { field: "allowResponseEditing", label: "Allow response editing", description: "Respondents can change their answers after submitting, while the session is active." },
  { field: "showProgressBar", label: "Show progress bar", description: "Shows how far through the form a respondent is." },
];

type Field = (typeof FORM_DEFAULTS)[number]["field"];
interface Defaults { form: Record<Field, boolean>; question: { required: boolean; points: number } }

/**
 * The "Form defaults" and "Question defaults" groups, shared by the server Settings page and a
 * form's own settings. Defaults are stored once per server and apply to forms and questions created
 * from now on. Inside a form, `form` is passed so a change to a form default also applies to that
 * form ("settings applied to this form and new forms").
 */
export function DefaultsGroups({ form }: { form?: { settings: FormSettings; update: (patch: Partial<FormSettings>) => void } }) {
  const toast = useToast();
  const { setQuestionDefaults } = useFormActions();
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [points, setPoints] = useState("1");

  useEffect(() => {
    let cancelled = false;
    formsApi.getDefaults().then((d: Defaults) => { if (!cancelled) { setDefaults(d); setPoints(String(d.question.points)); } }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const save = async (patch: { form?: Partial<Record<Field, boolean>>; question?: { required?: boolean; points?: number } }) => {
    try {
      const saved: Defaults = await formsApi.setDefaults(patch);
      setDefaults(saved);
      setQuestionDefaults(saved.question);
      toast("Default saved");
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const setFormDefault = (field: Field, value: boolean) => {
    form?.update({ [field]: value } as Partial<FormSettings>);
    save({ form: { [field]: value } });
  };

  return (
    <>
      <SettingGroup title="Form defaults" description={form ? "Settings applied to this form and new forms" : "Settings applied to new forms"}>
        {FORM_DEFAULTS.map((d, i) => (
          <SettingRow key={d.field} label={d.label} description={d.description} last={i === FORM_DEFAULTS.length - 1}>
            <Switch label={(form ? form.settings[d.field] : defaults?.form[d.field]) ? "On" : "Off"} checked={!!(form ? form.settings[d.field] : defaults?.form[d.field])} disabled={!defaults} onChange={(v) => setFormDefault(d.field, v)} />
          </SettingRow>
        ))}
      </SettingGroup>
      <SettingGroup title="Question defaults" description="Settings applied to all new questions" last>
        <SettingRow label="Make questions required by default" description="New questions start with “Required” switched on.">
          <Switch label={defaults?.question.required ? "On" : "Off"} checked={!!defaults?.question.required} disabled={!defaults} onChange={(v) => save({ question: { required: v } })} />
        </SettingRow>
        <SettingRow label="Default point value" description="Points a new question is worth when it is in a quiz." last>
          <View style={{ width: 100 }}>
            <TextField value={points} keyboardType="numeric" onChangeText={(v) => setPoints(v.replace(/\D/g, ""))} onBlur={() => { const n = Number(points) || 0; setPoints(String(n)); if (defaults && n !== defaults.question.points) save({ question: { points: n } }); }} accessibilityLabel="Default point value" />
          </View>
        </SettingRow>
      </SettingGroup>
    </>
  );
}

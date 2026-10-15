import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Plus, Save } from "lucide-react-native";
import { cloudApi } from "../../src/features/cloud/services/cloudApi";
import { describeCloudError } from "../../src/features/cloud/utils/describeCloudError";
import { Badge, Button, Dialog, Divider, Icon, IconButton, Notice, SegmentedControl, Tabs, Text, radius, size, space, useLayout, useTheme } from "../../ui";
import { QUESTION_TYPES, useFormActions, useFormStore } from "../../lib/formStore";
import { QUESTION_ICONS, SectionIcon } from "../../lib/questionIcons";
import { useFocusRing } from "../../ui/interactive";

const SAVE_LABEL = { idle: "Save", saving: "Saving…", saved: "Saved", error: "Retry save" } as const;

function useFormPaths(formId: string) {
  return [
    { value: `/forms/${formId}`, label: "Questions" },
    { value: `/forms/${formId}/responses`, label: "Responses" },
    { value: `/forms/${formId}/settings`, label: "Settings" },
  ];
}

function scrollToQuestion(id: string) {
  if (Platform.OS !== "web") return;
  document.getElementById(`question-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/** Palette used by the desktop sidebar and by the "Add question" dialog on smaller screens. */
function PaletteItem({ label, icon, onPress, width }: { label: string; icon: typeof SectionIcon; onPress: () => void; width: `${number}%` }) {
  const { colors } = useTheme();
  const { ring, onFocus, onBlur } = useFocusRing(colors);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${label}`}
      onPress={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      style={(s) => [{ flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 36, paddingHorizontal: space[2], borderRadius: radius.md, width }, (s as { hovered?: boolean }).hovered && { backgroundColor: colors.hover }, ring]}
    >
      <Icon icon={icon} size={16} />
      <Text variant="small">{label}</Text>
    </Pressable>
  );
}

/** Palette used by the desktop sidebar and by the "Add question" dialog on smaller screens. */
export function AddQuestionPalette({ onAdded, columns = 1 }: { onAdded?: () => void; columns?: number }) {
  const { addQuestion, addSection } = useFormActions();
  const width = `${100 / columns}%` as const;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {QUESTION_TYPES.map((t) => <PaletteItem key={t.id} width={width} label={t.label} icon={QUESTION_ICONS[t.icon]} onPress={() => { addQuestion(t.id); onAdded?.(); }} />)}
      <PaletteItem width={width} label="Section" icon={SectionIcon} onPress={() => { addSection(); onAdded?.(); }} />
    </View>
  );
}

function Outline() {
  const { colors } = useTheme();
  const questions = useFormStore((s) => s.questions);
  const [active, setActive] = useState<string | null>(null);
  let n = 0;
  return (
    <View style={{ gap: 2 }}>
      <Text variant="caption" tone="tertiary" style={{ textTransform: "uppercase", letterSpacing: 0.4, paddingHorizontal: space[2], paddingBottom: space[1] }}>Jump to · {questions.filter((q) => q.type !== "section").length} questions</Text>
      {questions.length === 0 ? <Text variant="small" tone="tertiary" style={{ paddingHorizontal: space[2] }}>No questions yet</Text> : null}
      {questions.map((q) => {
        const section = q.type === "section";
        if (!section) n += 1;
        const isActive = active === q.id;
        return (
          <Pressable key={q.id} accessibilityRole="button" accessibilityLabel={`Go to ${q.title || "untitled"}`} onPress={() => { setActive(q.id); scrollToQuestion(q.id); }} style={(s) => [{ flexDirection: "row", gap: space[2], alignItems: "center", minHeight: 32, paddingHorizontal: space[2], marginTop: section ? space[2] : 0, borderRadius: radius.md }, isActive ? { backgroundColor: colors.pressed } : (s as { hovered?: boolean }).hovered && { backgroundColor: colors.hover }]}>
            {section ? <Icon icon={SectionIcon} size={14} color={colors.accent} /> : <Text variant="caption" tone="tertiary" style={{ width: 18, textAlign: "right" }}>{n}</Text>}
            <Text variant={section ? "label" : "small"} tone={section ? "accent" : "secondary"} numberOfLines={1} style={{ flex: 1 }}>{q.title || (section ? "Untitled section" : "Untitled question")}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SaveArea({ formId, compact }: { formId: string; compact?: boolean }) {
  const { saveForm, setCloudUnsaved } = useFormActions();
  const saveStatus = useFormStore((s) => s.saveStatus);
  const saveError = useFormStore((s) => s.saveError);
  const mode = useFormStore((s) => s.mode);
  const recalculated = useFormStore((s) => s.recalculatedResponses);
  const cloudUnsaved = useFormStore((s) => s.cloudUnsaved);

  // After a local save, a cloud-linked form that now differs from its cloud copy asks whether to
  // save there too. "Not now" leaves it flagged rather than silently diverging.
  const [prompt, setPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const promptedFor = useRef<string | null>(null);

  useEffect(() => {
    if (saveStatus === "saved" && cloudUnsaved && promptedFor.current !== saveStatus + formId) {
      promptedFor.current = saveStatus + formId;
      setPrompt(true);
    }
    if (saveStatus !== "saved") promptedFor.current = null;
  }, [saveStatus, cloudUnsaved, formId]);

  const saveToCloud = async () => {
    setBusy(true);
    setError(null);
    try {
      await cloudApi.publishForm(formId);
      setCloudUnsaved(false);
      setPrompt(false);
    } catch (err) {
      setError(describeCloudError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space[2], alignItems: compact ? "flex-end" : "stretch" }}>
      {saveStatus === "error" ? <Text variant="small" tone="danger" accessibilityRole="alert">Couldn't save. Check the server. {saveError ?? ""}</Text> : null}
      {saveStatus === "saved" && recalculated > 0 ? <Text variant="small" tone="secondary">{`Rescored ${recalculated} existing response${recalculated === 1 ? "" : "s"}.`}</Text> : null}
      {cloudUnsaved && saveStatus !== "saving" ? <Button label="Not saved to cloud" variant="ghost" compact onPress={() => setPrompt(true)} /> : null}
      <Button label={SAVE_LABEL[saveStatus]} icon={Save} variant="primary" loading={saveStatus === "saving"} disabled={mode === "view"} fullWidth={!compact} onPress={saveForm} />
      <Dialog
        visible={prompt}
        title="Save changes to cloud?"
        onClose={() => setPrompt(false)}
        footer={<><Button label="Not now" variant="ghost" disabled={busy} onPress={() => setPrompt(false)} /><Button label="Save to cloud" variant="primary" loading={busy} onPress={saveToCloud} /></>}
      >
        <Text tone="secondary">This form is saved in your cloud account, and your changes aren't there yet. Save them now so your other devices get the latest version?</Text>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </Dialog>
    </View>
  );
}

export function FormShell({ formId, children }: { formId: string; children: ReactNode }) {
  const { colors } = useTheme();
  const { isDesktop } = useLayout();
  const router = useRouter();
  const path = usePathname();
  const tabs = useFormPaths(formId);
  const title = useFormStore((s) => s.formTitle);
  const mode = useFormStore((s) => s.mode);
  const { setMode } = useFormActions();
  const [adding, setAdding] = useState(false);
  const onQuestions = path === `/forms/${formId}`;
  const current = tabs.find((t) => t.value === path)?.value ?? tabs[0].value;
  const go = (href: string) => router.push(href as never);

  const modeControl = onQuestions ? (
    <SegmentedControl value={mode} onChange={setMode} options={[{ value: "edit", label: "Edit" }, { value: "view", label: "Preview" }]} />
  ) : null;

  if (isDesktop) {
    const showRail = onQuestions && mode === "edit";
    return (
      <View style={{ flex: 1 }}>
        <View style={{ height: 48, flexDirection: "row", alignItems: "center", gap: space[4], paddingHorizontal: space[4], backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], flex: 1, minWidth: 0 }}>
            <IconButton icon={ArrowLeft} label="Back to all forms" onPress={() => go("/dashboard/forms")} />
            <Text variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>{title || "Untitled form"}</Text>
          </View>
          <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 2 }}>
            {tabs.map((t) => {
              const active = t.value === current;
              return (
                <Pressable key={t.value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => go(t.value)} style={(st) => [{ height: 48, justifyContent: "center", paddingHorizontal: space[3], borderBottomWidth: 2, borderBottomColor: active ? colors.accent : "transparent" }, !active && (st as { hovered?: boolean }).hovered && { backgroundColor: colors.hover }]}>
                  <Text variant="small" tone={active ? "default" : "secondary"} style={{ fontWeight: "500" }}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: space[3] }}>
            {modeControl}
            <SaveArea formId={formId} compact />
          </View>
        </View>
        <View style={{ flex: 1, flexDirection: "row" }}>
          {showRail ? (
            <View style={{ width: 264, backgroundColor: colors.bg, borderRightWidth: 1, borderRightColor: colors.border }}>
              <ScrollView contentContainerStyle={{ padding: space[3], gap: space[4] }}>
                <View style={{ gap: space[1] }}>
                  <Text variant="caption" tone="tertiary" style={{ textTransform: "uppercase", letterSpacing: 0.4, paddingHorizontal: space[2] }}>Add question</Text>
                  <AddQuestionPalette columns={2} />
                </View>
                <Divider />
                <Outline />
              </ScrollView>
            </View>
          ) : null}
          <View style={{ flex: 1 }}>{children}</View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
      <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: space[3], paddingTop: space[2], gap: space[1] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <IconButton icon={ArrowLeft} label="Back to forms" onPress={() => go("/dashboard/forms")} />
          <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>{title || "Untitled form"}</Text>
          <SaveArea formId={formId} compact />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
          <View style={{ flex: 1 }}><Tabs value={current} onChange={go} options={tabs} /></View>
        </View>
        {modeControl ? <View style={{ paddingVertical: space[2] }}>{modeControl}</View> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
      {onQuestions && mode === "edit" ? (
        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: space[2] }}>
          <Button label="Add question" icon={Plus} variant="primary" fullWidth onPress={() => setAdding(true)} />
        </SafeAreaView>
      ) : null}
      <Dialog visible={adding} title="Add question" onClose={() => setAdding(false)}>
        <AddQuestionPalette columns={2} onAdded={() => setAdding(false)} />
        <Divider />
        <Badge label="New questions are added at the end" />
      </Dialog>
    </SafeAreaView>
  );
}

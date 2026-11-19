import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertCircle, ArrowLeft, Check, Eye, EyeOff, Play, Save } from "lucide-react-native";
import { cloudApi } from "../../src/features/cloud/services/cloudApi";
import { describeCloudError } from "../../src/features/cloud/utils/describeCloudError";
import { Button, Dialog, Notice, Text, useLayout } from "../../ui";
import { GButton, GIconButton, GLineInput, GText, useGF } from "../../ui/gforms";
import { useFormActions, useFormStore } from "../../lib/formStore";
import { EditorSelection } from "./EditorSelection";

function useFormPaths(formId: string) {
  return [
    { value: `/forms/${formId}`, label: "Questions" },
    { value: `/forms/${formId}/responses`, label: "Results" },
    { value: `/forms/${formId}/settings`, label: "Settings" },
  ];
}

function SaveArea({ formId }: { formId: string }) {
  const g = useGF();
  const { saveForm, setCloudUnsaved } = useFormActions();
  const saveStatus = useFormStore((s) => s.saveStatus);
  const saveError = useFormStore((s) => s.saveError);
  const mode = useFormStore((s) => s.mode);
  const cloudUnsaved = useFormStore((s) => s.cloudUnsaved);
  const currentSignature = useFormStore((s) => JSON.stringify({ title: s.formTitle, description: s.formDescription, bannerImage: s.bannerImage, settings: s.formSettings, questions: s.questions, subjectId: s.subjectId }));
  const savedSignature = useFormStore((s) => s.savedSignature);
  const dirty = currentSignature !== savedSignature;
  const statusLabel = saveStatus === "error" ? "Save failed" : saveStatus === "saving" ? "Saving…" : dirty ? "Unsaved" : "Saved";
  const StatusIcon = saveStatus === "error" ? AlertCircle : dirty || saveStatus === "saving" ? Save : Check;

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

  const bad = saveStatus === "error";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View accessibilityLiveRegion="polite" accessibilityRole={bad ? "alert" : undefined} accessibilityLabel={`${statusLabel}${saveError ? `. ${saveError}` : ""}`} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8 }}>
        <StatusIcon size={15} color={bad ? g.error : g.textSecondary} />
        <GText size={13} color={bad ? g.error : g.textSecondary}>{statusLabel}</GText>
      </View>
      {cloudUnsaved && saveStatus !== "saving" ? <GButton label="Cloud pending" onPress={() => setPrompt(true)} /> : null}
      <GButton variant="filled" label={saveStatus === "error" ? "Retry" : "Save"} loading={saveStatus === "saving"} disabled={mode === "view" || (!dirty && saveStatus === "saved")} onPress={saveForm} />
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

function EditorTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const g = useGF();
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress}
      style={(s) => [{ height: 48, paddingHorizontal: 20, justifyContent: "center", borderBottomWidth: 3, borderBottomColor: active ? g.accent : "transparent", backgroundColor: (s as { hovered?: boolean }).hovered ? g.hover : "transparent" }]}>
      <GText size={14} weight="500" color={active ? g.accent : g.textSecondary}>{label}</GText>
    </Pressable>
  );
}

export function FormShell({ formId, children }: { formId: string; children: ReactNode }) {
  const g = useGF();
  const { width } = useLayout();
  const wide = width >= 1000;
  const router = useRouter();
  const path = usePathname();
  const tabs = useFormPaths(formId);
  const title = useFormStore((s) => s.formTitle);
  const mode = useFormStore((s) => s.mode);
  const { setMode, setFormTitle } = useFormActions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const onQuestions = path === `/forms/${formId}`;
  const current = tabs.find((t) => t.value === path)?.value ?? tabs[0].value;
  const go = (href: string) => router.push(href as never);
  const previewing = onQuestions && mode === "view";
  const saveStatus = useFormStore((st) => st.saveStatus);
  const saveError = useFormStore((st) => st.saveError);
  const { saveForm } = useFormActions();

  const titleBlock = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: wide ? undefined : 1, width: wide ? 300 : undefined, minWidth: 0 }}>
      <GIconButton label="Back to all forms" onPress={() => go("/dashboard/forms")}><ArrowLeft size={20} color={g.textSecondary} /></GIconButton>
      <View style={{ flex: 1, minWidth: 0 }}>
        <GText size={11} secondary>Form editor</GText>
        <GLineInput quiet fontSize={16} weight="500" placeholder="Untitled form" value={title} onChangeText={setFormTitle} numberOfLines={1} />
      </View>
    </View>
  );
  const tabBar = <View accessibilityRole="tablist" style={{ flexDirection: "row", justifyContent: "center" }}>{tabs.map((t) => <EditorTab key={t.value} label={t.label} active={t.value === current} onPress={() => go(t.value)} />)}</View>;
  const actions = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
      {onQuestions ? <GButton variant={previewing ? "filled" : "outlined"} label={previewing ? "Edit" : "Preview"} icon={previewing ? <EyeOff size={16} color={g.accentText} /> : <Eye size={16} color={g.accent} />} onPress={() => setMode(previewing ? "edit" : "view")} /> : null}
      {onQuestions ? <GButton variant="outlined" label="Create session" icon={<Play size={14} color={g.accent} />} onPress={() => go(`/dashboard/sessions?create=1&formId=${formId}`)} /> : null}
      <SaveArea formId={formId} />
    </View>
  );

  return (
    <EditorSelection.Provider value={{ selectedId, setSelectedId }}>
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: g.canvas }}>
        <View style={{ backgroundColor: g.topbar, borderBottomWidth: 1, borderBottomColor: g.border, paddingHorizontal: 12, zIndex: 20 }}>
          {wide ? (
            <View style={{ flexDirection: "row", alignItems: "center", minHeight: 64 }}>
              {titleBlock}
              <View style={{ flex: 1 }}>{tabBar}</View>
              {actions}
            </View>
          ) : (
            <>
              <View style={{ minHeight: 56, justifyContent: "center" }}>{titleBlock}</View>
              {tabBar}
              <View style={{ paddingVertical: 8 }}>{actions}</View>
            </>
          )}
        </View>
        {saveStatus === "error" ? (
          <View accessibilityRole="alert" style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: g.errorSoft, borderBottomWidth: 1, borderBottomColor: g.error }}>
            <AlertCircle size={18} color={g.error} />
            <GText size={13} color={g.error} style={{ flex: 1 }}>{`Your changes were not saved${saveError ? `: ${saveError}` : "."}`}</GText>
            <GButton label="Retry" onPress={saveForm} />
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      </SafeAreaView>
    </EditorSelection.Provider>
  );
}

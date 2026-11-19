import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronDown, Cloud, FileInput, Upload } from "lucide-react-native";
import { formsApi } from "../../../src/features/forms/services/formsApi";
import { cloudApi } from "../../../src/features/cloud/services/cloudApi";
import { describeCloudError } from "../../../src/features/cloud/utils/describeCloudError";
import { groupBySubjects } from "../../../src/features/subjects/utils/groupBySubjects";
import { Button, Dialog, Icon, Notice, SearchField, Skeleton, TableHeader, Text, space, useLayout, useTheme, useToast } from "../../../ui";
import { useFocusRing } from "../../../ui/interactive";
import { useCloudAccount, useForms, useSubjects } from "../../../lib/data";
import { pickJsonText } from "../../../lib/platform";
import type { FormSummary, Subject } from "../../../lib/domain";
import { FormRow, FORM_ACTIONS_WIDTH } from "../../../components/forms/FormRow";
import { useFormExport } from "../../../components/forms/useFormExport";
import { TemplateGallery } from "../../../components/forms/TemplateGallery";
import { CreateFormDialog } from "../../../components/forms/CreateFormDialog";
import { CloudImportDialog } from "../../../components/forms/ImportDialogs";
import { GoogleFormsImportDialog } from "../../../components/forms/GoogleFormsImportDialog";
import { GoogleAuthRequiredDialog } from "../../../components/forms/CloudDialogs";
import { DeleteFormDialog } from "../../../components/forms/DeleteFormDialog";

function FolderGroup({ group, connected, exporter, publishingId, onPublish, onDelete }: {
  group: { subject: Subject | null; items: FormSummary[] };
  connected: boolean;
  exporter: ReturnType<typeof useFormExport>;
  publishingId: string | null;
  onPublish: (form: FormSummary) => Promise<void>;
  onDelete: (form: FormSummary) => void;
}) {
  const { colors } = useTheme();
  const { ring, onFocus, onBlur } = useFocusRing(colors);
  const [open, setOpen] = useState(true);
  const name = group.subject?.name ?? "General";
  return (
    <View style={{ borderTopWidth: 1, borderBottomWidth: open ? 1 : 0, borderColor: colors.border }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${name} folder, ${group.items.length} forms`} accessibilityState={{ expanded: open }} onPress={() => setOpen((value) => !value)} onFocus={onFocus} onBlur={onBlur}
        style={(state) => [{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space[2], backgroundColor: (state as { hovered?: boolean }).hovered ? colors.hover : "transparent", paddingHorizontal: space[2] }, ring]}>
        <View style={{ transform: [{ rotate: open ? "0deg" : "-90deg" }] }}><Icon icon={ChevronDown} size={18} color={colors.textSecondary} /></View>
        <Text variant="title" style={{ flex: 1 }}>{name}</Text>
        <Text variant="small" tone="tertiary">{group.items.length} {group.items.length === 1 ? "form" : "forms"}</Text>
      </Pressable>
      {open ? <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
        <TableHeader columns={[{ label: "", width: 18 }, { label: "Name" }, { label: "Location", width: 120 }, { label: "Activity", width: 150 }, { label: "Updated", width: 96 }, { label: "", width: FORM_ACTIONS_WIDTH }]} />
        {group.items.map((form, index) => <FormRow key={form.id} form={form} last={index === group.items.length - 1} a={{ cloudConnected: connected, exporting: exporter.exportingId === form.id, publishing: publishingId === form.id, onExport: exporter.request, onPublish, onDelete }} />)}
      </View> : null}
    </View>
  );
}

export default function FormsPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isDesktop } = useLayout();
  const { create, import: importRequested } = useLocalSearchParams<{ create?: string; import?: string }>();
  const toast = useToast();
  const { forms, loading, error, refresh } = useForms();
  const { subjects } = useSubjects();
  const defaultSubjectId = subjects.find((s) => s.isDefault)?.id ?? null;
  const { account, connected, login, logout } = useCloudAccount();

  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(create === "1");
  const [showImportMenu, setShowImportMenu] = useState(importRequested === "1");
  const [deleteTarget, setDeleteTarget] = useState<FormSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const exporter = useFormExport(setNotice);

  // An import requested while signed out. The Google sign-in itself happens in the OS browser, so the
  // request is resumed once `connected` flips true, not when login() resolves.
  const [pending, setPending] = useState(false);
  const [showAuthRequired, setShowAuthRequired] = useState(false);
  const [showCloud, setShowCloud] = useState(false);
  const [showGoogleForms, setShowGoogleForms] = useState(false);
  // Which dialog a request made while signed out should open once sign-in completes.
  const [pendingTarget, setPendingTarget] = useState<"drive" | "forms">("drive");

  useEffect(() => { if (importRequested === "1") setShowImportMenu(true); }, [importRequested]);

  useEffect(() => {
    if (!connected || !pending) return;
    if (pendingTarget === "forms") setShowGoogleForms(true);
    else setShowCloud(true);
    setPending(false);
  }, [connected, pending, pendingTarget]);

  const requireCloudThen = (target: "drive" | "forms" = "drive") => {
    if (connected) return target === "forms" ? setShowGoogleForms(true) : setShowCloud(true);
    setNotice(null);
    setPendingTarget(target);
    setPending(true);
    setShowAuthRequired(true);
  };

  const confirmSignIn = async () => {
    setShowAuthRequired(false);
    try {
      await login();
    } catch (err) {
      setNotice(describeCloudError(err));
      setPending(false);
    }
  };

  const open = (id: string) => router.push(`/forms/${id}` as never);

  const createBlank = async (f: { title: string; description: string; subjectId: string | null }) => {
    const created = await formsApi.create(f);
    setShowCreate(false);
    open(created.id);
  };

  // A template is just a canned {title, description, questions} payload, so it goes through the same
  // POST /api/forms/import path a JSON file does. There is no separate "create from template" route.
  const createFromTemplate = async (t: { title: string; description?: string; questions: unknown[] }) => {
    const created = await formsApi.import({ title: t.title, description: t.description || "", settings: {}, questions: t.questions, subjectId: defaultSubjectId });
    open(created.id);
  };

  const importFile = async () => {
    setImporting(true);
    setNotice(null);
    try {
      const text = await pickJsonText();
      if (text == null) return;
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("That file isn't valid JSON.");
      }
      const created = await formsApi.import(data);
      open(created.id);
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const publish = async (f: FormSummary) => {
    setPublishingId(f.id);
    setNotice(null);
    try {
      await cloudApi.publishForm(f.id);
      toast("Saved to your Google Drive", "success");
      await refresh();
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setPublishingId(null);
    }
  };

  const filtered = forms.filter((f) => (f.title || "").toLowerCase().includes(query.toLowerCase()));
  const groups = groupBySubjects(filtered, subjects, (f: FormSummary) => f.subjectId) as { subject: Subject | null; items: FormSummary[] }[];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ maxWidth: 1400, width: "100%", alignSelf: "center", padding: isDesktop ? space[6] : space[4], gap: space[6] }}>
        <View style={{ flexDirection: isDesktop ? "row" : "column", alignItems: isDesktop ? "flex-end" : "stretch", justifyContent: "space-between", gap: space[4], borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: space[5] }}>
          <View style={{ gap: space[2], flexShrink: 1 }}>
            <Text variant="label" tone="accent">Form library</Text>
            <Text accessibilityRole="header" style={{ fontSize: 28, lineHeight: 36, fontWeight: "400", color: colors.text }}>Build once. Use it again.</Text>
            <Text tone="secondary">Create reusable forms for feedback, registration, assessments and more. {forms.length} on this server.</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            <Button label="Import" icon={Upload} disabled={importing || pending} onPress={() => setShowImportMenu(true)} />
          </View>
        </View>

        <TemplateGallery onBlank={() => setShowCreate(true)} onPick={createFromTemplate} />
        {notice ? <Notice tone="danger" actionLabel="Dismiss" onAction={() => setNotice(null)}>{notice}</Notice> : null}
        {forms.length > 0 || query ? <View style={{ maxWidth: 440 }}><SearchField value={query} onChangeText={setQuery} placeholder="Find a form" /></View> : null}

        {loading && forms.length === 0 ? <View style={{ gap: space[3] }}><Skeleton height={20} width="40%" /><Skeleton height={48} /><Skeleton height={48} /></View> : error ? (
          <Notice tone="danger" actionLabel="Retry" onAction={refresh}>{`Couldn't load forms: ${error}`}</Notice>
        ) : filtered.length === 0 ? (
          query ? <View style={{ gap: space[2], paddingVertical: space[4], borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}><Text variant="bodyStrong">No forms match</Text><Text tone="secondary">Try another title or clear the search.</Text><Button label="Clear search" variant="ghost" onPress={() => setQuery("")} /></View> : null
        ) : groups.map((group) => <FolderGroup key={group.subject?.id ?? "unsorted"} group={group} connected={connected} exporter={exporter} publishingId={publishingId} onPublish={publish} onDelete={setDeleteTarget} />)}
      </ScrollView>

      <CreateFormDialog visible={showCreate} subjects={subjects} onClose={() => setShowCreate(false)} onCreate={createBlank} />
      <Dialog visible={showImportMenu} title="Import a form" onClose={() => setShowImportMenu(false)}>
        <Button label="From JSON file" icon={Upload} fullWidth onPress={() => { setShowImportMenu(false); void importFile(); }} />
        <Button label="From Google Drive" icon={Cloud} fullWidth onPress={() => { setShowImportMenu(false); requireCloudThen("drive"); }} />
        <Button label="From Google Forms" icon={FileInput} fullWidth onPress={() => { setShowImportMenu(false); requireCloudThen("forms"); }} />
      </Dialog>

      {exporter.dialog}

      <DeleteFormDialog
        form={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          await formsApi.remove(deleteTarget!.id);
          setDeleteTarget(null);
          await refresh();
          toast("Form deleted");
        }}
      />

      <GoogleAuthRequiredDialog visible={showAuthRequired} onConfirm={confirmSignIn} onCancel={() => { setShowAuthRequired(false); setPending(false); }} />
      <GoogleFormsImportDialog
        visible={showGoogleForms}
        forms={forms}
        canAccessForms={!!account?.googleFormsAccess}
        onClose={() => setShowGoogleForms(false)}
        onOpenForm={open}
        onChanged={refresh}
        onReconnect={async () => { setShowGoogleForms(false); await logout(); setPendingTarget("forms"); setPending(true); await login(); }}
      />
      <CloudImportDialog visible={showCloud} forms={forms} onClose={() => setShowCloud(false)} onOpenForm={open} onChanged={refresh} />
    </View>
  );
}

import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Cloud, FileText, Plus, Upload } from "lucide-react-native";
import { formsApi } from "../../../src/features/forms/services/formsApi";
import { cloudApi } from "../../../src/features/cloud/services/cloudApi";
import { describeCloudError } from "../../../src/features/cloud/utils/describeCloudError";
import { groupBySubjects } from "../../../src/features/subjects/utils/groupBySubjects";
import { Button, EmptyState, Notice, Page, PageHeader, SearchField, Section, Skeleton, Surface, TableHeader, useToast } from "../../../ui";
import { useCloudAccount, useForms, useSubjects } from "../../../lib/data";
import { pickJsonText } from "../../../lib/platform";
import type { FormSummary, Subject } from "../../../lib/domain";
import { FormRow, FORM_ACTIONS_WIDTH } from "../../../components/forms/FormRow";
import { useFormExport } from "../../../components/forms/useFormExport";
import { TemplateGallery } from "../../../components/forms/TemplateGallery";
import { CreateFormDialog } from "../../../components/forms/CreateFormDialog";
import { CloudImportDialog } from "../../../components/forms/ImportDialogs";
import { GoogleAuthRequiredDialog } from "../../../components/forms/CloudDialogs";
import { DeleteFormDialog } from "../../../components/forms/DeleteFormDialog";

export default function FormsPage() {
  const router = useRouter();
  const toast = useToast();
  const { forms, loading, error, refresh } = useForms();
  const { subjects } = useSubjects();
  const defaultSubjectId = subjects.find((s) => s.isDefault)?.id ?? null;
  const { connected, login } = useCloudAccount();

  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
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

  useEffect(() => {
    if (!connected || !pending) return;
    setShowCloud(true);
    setPending(false);
  }, [connected, pending]);

  const requireCloudThen = () => {
    if (connected) return setShowCloud(true);
    setNotice(null);
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
    <Page>
      <PageHeader
        title="Forms"
        subtitle="Every form on this server, grouped by folder."
        actions={
          <>
            <Button label={importing ? "Importing…" : "Import file"} icon={Upload} disabled={importing} onPress={importFile} />
            <Button label={pending ? "Waiting for sign-in…" : "From Drive"} icon={Cloud} disabled={pending} onPress={requireCloudThen} />
            <Button label="New form" icon={Plus} variant="primary" onPress={() => setShowCreate(true)} />
          </>
        }
      />

      <TemplateGallery onBlank={() => setShowCreate(true)} onPick={createFromTemplate} />

      {notice ? <Notice tone="danger" actionLabel="Dismiss" onAction={() => setNotice(null)}>{notice}</Notice> : null}
      <SearchField value={query} onChangeText={setQuery} placeholder="Search forms" />

      {loading && forms.length === 0 ? (
        <Surface><Skeleton height={16} width="40%" /><Skeleton height={16} /><Skeleton height={16} width="70%" /></Surface>
      ) : error ? (
        <Notice tone="danger" actionLabel="Retry" onAction={refresh}>{`Couldn't load forms: ${error}`}</Notice>
      ) : filtered.length === 0 ? (
        <Surface><EmptyState icon={FileText} title={query ? "No forms match your search" : "No forms yet"} body={query ? undefined : "Start from a template above, import a file, or create a blank form."} actionLabel={query ? "Clear search" : "New form"} onAction={query ? () => setQuery("") : () => setShowCreate(true)} /></Surface>
      ) : (
        groups.map((g) => (
          <Section key={g.subject?.id ?? "unsorted"} title={g.subject?.name ?? "General"} description={`${g.items.length} form${g.items.length === 1 ? "" : "s"}`}>
            <Surface padded={false}>
              <TableHeader columns={[{ label: "", width: 18 }, { label: "Name" }, { label: "Location", width: 120 }, { label: "Activity", width: 150 }, { label: "Updated", width: 96 }, { label: "", width: FORM_ACTIONS_WIDTH }]} />
              {g.items.map((f, i) => (
                <FormRow
                  key={f.id}
                  form={f}
                  last={i === g.items.length - 1}
                  a={{
                    cloudConnected: connected,
                    exporting: exporter.exportingId === f.id,
                    publishing: publishingId === f.id,
                    onExport: exporter.request,
                    onPublish: publish,
                    onDelete: setDeleteTarget,
                  }}
                />
              ))}
            </Surface>
          </Section>
        ))
      )}

      <CreateFormDialog visible={showCreate} subjects={subjects} onClose={() => setShowCreate(false)} onCreate={createBlank} />

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
      <CloudImportDialog visible={showCloud} forms={forms} onClose={() => setShowCloud(false)} onOpenForm={open} onChanged={refresh} />
    </Page>
  );
}

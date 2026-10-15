import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, FileText, Pencil, Plus, Trash2 } from "lucide-react-native";
import { formsApi } from "../../../../src/features/forms/services/formsApi";
import { subjectsApi } from "../../../../src/features/subjects/services/subjectsApi";
import { Button, ConfirmDialog, EmptyState, Notice, Page, PageHeader, SearchField, Skeleton, Surface, useToast } from "../../../../ui";
import { useForms, useSubjects } from "../../../../lib/data";
import type { FormSummary } from "../../../../lib/domain";
import { FormRow } from "../../../../components/forms/FormRow";
import { CreateFormDialog } from "../../../../components/forms/CreateFormDialog";
import { useFormExport } from "../../../../components/forms/useFormExport";
import { DeleteSubjectDialog, SubjectFormDialog } from "../../../../components/subjects/SubjectDialogs";
import { subjectsPath } from "../../../../components/shell/paths";
import { oneLine } from "../../../../lib/text";

export default function FolderDetail() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const router = useRouter();
  const toast = useToast();
  const { subjects, loading: subjectsLoading, refresh: refreshSubjects } = useSubjects();
  const { forms, loading, error, refresh } = useForms();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteForm, setDeleteForm] = useState<FormSummary | null>(null);
  const exporter = useFormExport(setNotice);

  const subject = subjects.find((s) => s.id === subjectId);
  const subjectForms = forms.filter((f) => f.subjectId === subjectId);
  const shown = subjectForms.filter((f) => (f.title || "").toLowerCase().includes(query.toLowerCase()));

  const back = <Button label="All folders" icon={ArrowLeft} variant="ghost" compact onPress={() => router.push(subjectsPath as never)} />;

  if (!subjectsLoading && !loading && !subject) {
    return (
      <Page>
        {back}
        <Surface><EmptyState icon={FileText} title="Folder not found" body="This folder may have been deleted." actionLabel="Back to folders" onAction={() => router.replace(subjectsPath as never)} /></Surface>
      </Page>
    );
  }

  return (
    <Page>
      {back}
      <PageHeader
        title={subject?.name ?? "Folder"}
        subtitle={`${subject?.code ? `${subject.code} · ` : ""}${subjectForms.length} form${subjectForms.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Button label="Rename" icon={Pencil} onPress={() => setRenaming(true)} />
            {subject && !subject.isDefault ? <Button label="Delete folder" icon={Trash2} onPress={() => setDeleting(true)} /> : null}
            <Button label="New form" icon={Plus} variant="primary" onPress={() => setCreating(true)} />
          </>
        }
      />

      {notice ? <Notice tone="danger" actionLabel="Dismiss" onAction={() => setNotice(null)}>{notice}</Notice> : null}
      {subjectForms.length > 0 ? <SearchField value={query} onChangeText={setQuery} placeholder="Search forms in this folder" /> : null}

      {loading && forms.length === 0 ? (
        <Surface><Skeleton height={16} width="50%" /><Skeleton height={16} /></Surface>
      ) : error ? (
        <Notice tone="danger" actionLabel="Retry" onAction={refresh}>{`Couldn't load forms: ${error}`}</Notice>
      ) : shown.length === 0 ? (
        <Surface><EmptyState icon={FileText} title={query ? `No forms match "${query}"` : "No forms in this folder yet"} actionLabel={query ? "Clear search" : "New form"} onAction={query ? () => setQuery("") : () => setCreating(true)} /></Surface>
      ) : (
        <Surface padded={false}>
          {shown.map((f, i) => (
            // Saving to Drive lives on the Forms page; this view keeps the same row without duplicating that machinery.
            <FormRow
              key={f.id}
              form={f}
              last={i === shown.length - 1}
              a={{ cloudConnected: false, exporting: exporter.exportingId === f.id, publishing: false, onExport: exporter.request, onPublish: () => {}, onDelete: setDeleteForm }}
            />
          ))}
        </Surface>
      )}

      {exporter.dialog}

      <CreateFormDialog
        visible={creating}
        subjects={subject ? [subject] : []}
        onClose={() => setCreating(false)}
        onCreate={async (f) => {
          const created = await formsApi.create({ ...f, subjectId });
          setCreating(false);
          router.push(`/forms/${created.id}` as never);
        }}
      />
      <SubjectFormDialog
        visible={renaming}
        initial={subject ?? null}
        onClose={() => setRenaming(false)}
        onSave={async (v) => {
          await subjectsApi.update(subjectId, v);
          setRenaming(false);
          await refreshSubjects();
          toast("Folder renamed", "success");
        }}
      />
      <DeleteSubjectDialog
        subject={deleting && subject ? { ...subject, formCount: subjectForms.length } : null}
        onCancel={() => setDeleting(false)}
        onConfirm={async (action) => {
          await subjectsApi.remove(subjectId, action);
          router.replace(subjectsPath as never);
        }}
      />
      <ConfirmDialog
        visible={!!deleteForm}
        title="Delete form"
        confirmLabel="Delete form"
        message={`Delete "${oneLine(deleteForm?.title, "Untitled form")}"? This permanently deletes it along with every session and response under it.`}
        onCancel={() => setDeleteForm(null)}
        onConfirm={async () => {
          await formsApi.remove(deleteForm!.id);
          setDeleteForm(null);
          await refresh();
          toast("Form deleted");
        }}
      />
    </Page>
  );
}

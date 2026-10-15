import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Folder, Pencil, Plus, Trash2 } from "lucide-react-native";
import { subjectsApi } from "../../../../src/features/subjects/services/subjectsApi";
import { formatRelative } from "../../../../src/features/sessions/utils/time";
import { Badge, Button, EmptyState, IconButton, ListRow, Notice, Page, PageHeader, SearchField, Skeleton, Surface, useLayout, useToast } from "../../../../ui";
import { useSubjects } from "../../../../lib/data";
import type { Subject } from "../../../../lib/domain";
import { DeleteSubjectDialog, SubjectFormDialog } from "../../../../components/subjects/SubjectDialogs";

export default function FoldersPage() {
  const router = useRouter();
  const toast = useToast();
  const { isPhone } = useLayout();
  const { subjects, loading, error, refresh } = useSubjects();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Subject | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Subject | null>(null);

  const shown = subjects.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Page>
      <PageHeader title="Folders" subtitle="Organize your forms into folders, the same way you'd sort files." actions={<Button label="New folder" icon={Plus} variant="primary" onPress={() => setCreating(true)} />} />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search folders" />

      {loading && subjects.length === 0 ? (
        <Surface><Skeleton height={16} width="50%" /><Skeleton height={16} /></Surface>
      ) : error ? (
        <Notice tone="danger" actionLabel="Retry" onAction={refresh}>{`Couldn't load folders: ${error}`}</Notice>
      ) : shown.length === 0 ? (
        <Surface><EmptyState icon={Folder} title={query ? `No folders match "${query}"` : "No folders yet"} actionLabel={query ? "Clear search" : "New folder"} onAction={query ? () => setQuery("") : () => setCreating(true)} /></Surface>
      ) : (
        <Surface padded={false}>
          {shown.map((s, i) => (
            <ListRow
              key={s.id}
              last={i === shown.length - 1}
              icon={Folder}
              title={s.name}
              subtitle={[s.code, isPhone && s.updatedAt ? formatRelative(s.updatedAt, { short: true }) : null].filter(Boolean).join(" · ") || undefined}
              meta={`${s.formCount} form${s.formCount === 1 ? "" : "s"}`}
              trailing={isPhone ? (s.isDefault ? <Badge label="Default" /> : undefined) : <View style={{ width: 64, alignItems: "flex-start" }}>{s.isDefault ? <Badge label="Default" /> : null}</View>}
              actions={
                // Fixed two-slot width so rename/delete line up in every row, default folder included.
                <View style={{ flexDirection: "row", width: 80, justifyContent: "flex-end" }}>
                  <IconButton icon={Pencil} label={`Rename ${s.name}`} onPress={() => setEditing(s)} />
                  {!s.isDefault ? <IconButton icon={Trash2} label={`Delete ${s.name}`} tone="danger" onPress={() => setDeleting(s)} /> : <View style={{ width: 40 }} />}
                </View>
              }
              onPress={() => router.push(`/dashboard/subjects/${s.id}` as never)}
            />
          ))}
        </Surface>
      )}

      <SubjectFormDialog
        visible={creating || !!editing}
        initial={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={async (v) => {
          if (editing) await subjectsApi.update(editing.id, v);
          else await subjectsApi.create(v);
          setCreating(false);
          setEditing(null);
          await refresh();
          toast(editing ? "Folder renamed" : "Folder created", "success");
        }}
      />
      <DeleteSubjectDialog
        subject={deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={async (action) => {
          await subjectsApi.remove(deleting!.id, action);
          setDeleting(null);
          await refresh();
          toast("Folder deleted");
        }}
      />
    </Page>
  );
}

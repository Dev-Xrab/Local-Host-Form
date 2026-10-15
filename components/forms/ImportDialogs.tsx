import { useEffect, useState } from "react";
import { View } from "react-native";
import { FileText, Trash2 } from "lucide-react-native";
import { cloudApi } from "../../src/features/cloud/services/cloudApi";
import { describeCloudError } from "../../src/features/cloud/utils/describeCloudError";
import { Badge, Button, ConfirmDialog, Dialog, EmptyState, IconButton, ListRow, Notice, SearchField, Spinner, Text, space } from "../../ui";
import type { FormSummary } from "../../lib/domain";
import { SaveResponsesPrompt } from "./CloudDialogs";

interface RemoteForm { id: string; title: string; questionCount: number; version: number }
interface GoogleForm { id: string; name: string; modifiedTime: string }
interface GoogleImportResult {
  id: string; title: string; skipped: { title: string; reason: string }[];
  importedResponseCount?: number; unsavedCount?: number; responseImportError?: string;
}

const untitled = (t?: string) => t || "Untitled form";

/** Import from (or update/save/delete on) the user's own cloud account. */
export function CloudImportDialog({ visible, forms, onClose, onOpenForm, onChanged }: {
  visible: boolean; forms: FormSummary[]; onClose: () => void; onOpenForm: (id: string) => void; onChanged: () => void | Promise<unknown>;
}) {
  const [query, setQuery] = useState("");
  const [list, setList] = useState<RemoteForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RemoteForm | null>(null);
  // A cloud form whose latest version would overwrite local edits that were never saved to the cloud.
  const [updateTarget, setUpdateTarget] = useState<RemoteForm | null>(null);

  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setError(null);
    setLoading(true);
    cloudApi.listForms().then(setList).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, [visible]);

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const importNew = (rf: RemoteForm) => run(rf.id, async () => {
    const created = await cloudApi.importForm(rf.id);
    onClose();
    onOpenForm(created.id);
  });
  const pull = (rf: RemoteForm, linked: FormSummary) => {
    if (linked.hasUnsavedCloudChanges) return setUpdateTarget(rf);
    return run(rf.id, async () => { await cloudApi.importForm(rf.id); onClose(); await onChanged(); });
  };
  const save = (rf: RemoteForm, linked: FormSummary) => run(rf.id, async () => {
    await cloudApi.publishForm(linked.id);
    const [fresh] = await Promise.all([cloudApi.listForms(), onChanged()]);
    setList(fresh);
  });

  const shown = list.filter((rf) => untitled(rf.title).toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <Dialog visible={visible} title="Import from cloud" onClose={onClose} width={560}>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {loading ? <Spinner label="Loading your forms" /> : list.length === 0 ? (
          <EmptyState icon={FileText} title="Nothing published yet" body="Publish a form from this device first (the cloud icon on a form), or publish one from another device signed in to the same account." />
        ) : (
          <>
            <SearchField value={query} onChangeText={setQuery} placeholder="Search your cloud forms" />
            <View>
              {shown.map((rf, i) => {
                // Already on this device: the cloud copy is always the latest, so the action is whichever brings the two in step.
                const linked = forms.find((f) => f.remoteFormId === rf.id);
                const behind = !!linked && rf.version > (linked.remoteVersion ?? 0);
                const dirty = !!linked?.hasUnsavedCloudChanges;
                const busy = busyId === rf.id;
                const status = behind ? "Cloud has a newer version" : dirty ? "Unsaved changes" : linked ? "Up to date" : null;
                return (
                  <ListRow
                    key={rf.id}
                    last={i === shown.length - 1}
                    icon={FileText}
                    title={untitled(rf.title)}
                    subtitle={`${rf.questionCount} question${rf.questionCount === 1 ? "" : "s"}${status ? ` · ${status}` : ""}`}
                    trailing={
                      <View style={{ flexDirection: "row", gap: space[1], alignItems: "center" }}>
                        {!linked ? <Button label="Import" variant="primary" compact loading={busy} onPress={() => importNew(rf)} /> : (
                          <>
                            <Button label="Open" compact variant="ghost" onPress={() => { onClose(); onOpenForm(linked.id); }} />
                            {behind ? <Button label="Update" variant="primary" compact loading={busy} onPress={() => pull(rf, linked)} /> : dirty ? <Button label="Save" variant="primary" compact loading={busy} onPress={() => save(rf, linked)} /> : null}
                          </>
                        )}
                        <IconButton icon={Trash2} label="Delete from cloud account" tone="danger" onPress={() => setDeleteTarget(rf)} />
                      </View>
                    }
                  />
                );
              })}
              {shown.length === 0 ? <Text tone="secondary" align="center">No forms match "{query}".</Text> : null}
            </View>
          </>
        )}
      </Dialog>

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete from cloud account"
        message={`Delete "${untitled(deleteTarget?.title)}" from your cloud account? This removes it and every response under it, for every device signed in to this account. This can't be undone.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          await cloudApi.deleteCloudForm(deleteTarget!.id);
          setList((prev) => prev.filter((f) => f.id !== deleteTarget!.id));
          setDeleteTarget(null);
        }}
      />
      <ConfirmDialog
        visible={!!updateTarget}
        title="Update form from cloud"
        destructive={false}
        confirmLabel="Update"
        message={`"${untitled(updateTarget?.title)}" has changes on this device that aren't saved to the cloud. Updating replaces this device's copy with the cloud's latest and discards those changes. Responses already collected are kept, but one answered under a question the cloud copy no longer has won't be shown.`}
        onCancel={() => setUpdateTarget(null)}
        onConfirm={async () => {
          await cloudApi.importForm(updateTarget!.id, { overwrite: true });
          setUpdateTarget(null);
          onClose();
          await onChanged();
        }}
      />
    </>
  );
}

/** Import a real Google Form (forms.google.com) and, optionally, its responses. */
export function GoogleImportDialog({ visible, forms, onClose, onOpenForm, onSaveResponses }: {
  visible: boolean; forms: FormSummary[]; onClose: () => void; onOpenForm: (id: string) => void; onSaveResponses: (formId: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [list, setList] = useState<GoogleForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Kept on screen (rather than jumping straight into the form) when something was skipped or responses came over, so the user sees what did and didn't.
  const [result, setResult] = useState<GoogleImportResult | null>(null);

  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setResult(null);
    setError(null);
    setLoading(true);
    cloudApi.listGoogleForms().then(setList).catch((e: Error) => setError(describeCloudError(e))).finally(() => setLoading(false));
  }, [visible]);

  const importOne = async (g: GoogleForm) => {
    setBusyId(g.id);
    setError(null);
    try {
      const created: GoogleImportResult = await cloudApi.importGoogleForm(g.id);
      if (created.skipped?.length || created.importedResponseCount || created.unsavedCount || created.responseImportError) setResult(created);
      else { onClose(); onOpenForm(created.id); }
    } catch (err) {
      const e = err as Error & { body?: { skipped?: unknown[] } };
      const n = e.body?.skipped?.length;
      setError(n ? `${describeCloudError(e)} (${n} unsupported question${n === 1 ? "" : "s"})` : describeCloudError(e));
    } finally {
      setBusyId(null);
    }
  };

  const shown = list.filter((g) => (g.name || "Untitled form").toLowerCase().includes(query.toLowerCase()));

  return (
    <Dialog visible={visible} title="Import Google Form" onClose={onClose} width={560}>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {result ? (
        <>
          <Notice tone={result.responseImportError ? "warning" : "success"} title={`Imported "${result.title}"`}>
            {`${result.importedResponseCount || 0} response${result.importedResponseCount === 1 ? "" : "s"} brought over.${result.responseImportError ? ` Responses couldn't be pulled in: ${result.responseImportError}` : ""}`}
          </Notice>
          {result.skipped.length > 0 ? (
            <View style={{ gap: 2 }}>
              <Text variant="label">{`${result.skipped.length} question${result.skipped.length === 1 ? "" : "s"} couldn't be brought over`}</Text>
              {result.skipped.map((s, i) => <Text key={i} variant="small" tone="secondary">{s.title}: {s.reason}</Text>)}
            </View>
          ) : null}
          {result.unsavedCount ? <SaveResponsesPrompt count={result.unsavedCount} onSave={() => onSaveResponses(result.id).then(() => setResult({ ...result, unsavedCount: 0 }))} /> : null}
          <Button label="Go to form" variant="primary" onPress={() => { onClose(); onOpenForm(result.id); }} />
        </>
      ) : loading ? <Spinner label="Loading your Google Forms" /> : list.length === 0 ? (
        <EmptyState icon={FileText} title="No forms found" body="There are no forms in your Google account." />
      ) : (
        <>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search your Google Forms" />
          <View>
            {shown.map((g, i) => {
              // Already linked on this device: no reason to round-trip to confirm what we know locally.
              const linked = forms.find((f) => f.googleFormId === g.id);
              return (
                <ListRow
                  key={g.id}
                  last={i === shown.length - 1}
                  icon={FileText}
                  title={g.name || "Untitled form"}
                  subtitle={`Edited ${new Date(g.modifiedTime).toLocaleDateString()}`}
                  trailing={linked ? (
                    <View style={{ flexDirection: "row", gap: space[2], alignItems: "center" }}>
                      <Badge label="Imported" tone="success" />
                      <Button label="Open" compact variant="ghost" onPress={() => { onClose(); onOpenForm(linked.id); }} />
                    </View>
                  ) : <Button label="Import" variant="primary" compact loading={busyId === g.id} onPress={() => importOne(g)} />}
                />
              );
            })}
            {shown.length === 0 ? <Text tone="secondary" align="center">No forms match "{query}".</Text> : null}
          </View>
        </>
      )}
    </Dialog>
  );
}

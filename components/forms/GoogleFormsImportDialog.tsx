import { useEffect, useState } from "react";
import { View } from "react-native";
import { FileText } from "lucide-react-native";
import { googleFormsApi } from "../../src/features/cloud/services/cloudApi";
import { Button, Dialog, EmptyState, ListRow, Notice, SearchField, Spinner, Text, TextField, space, useToast } from "../../ui";
import type { FormSummary } from "../../lib/domain";
import { oneLine } from "../../lib/text";

interface GoogleFormItem { id: string; name: string; modifiedTime?: string; localFormId: string | null }
interface ImportResult {
  form: { id: string; title: string };
  alreadyImported: boolean;
  skipped: { title: string; reason: string }[];
  sync?: { newResponseCount: number } | null;
  responseImportError?: string | null;
}
type ApiError = Error & { body?: { code?: string } };

const untitled = (t?: string) => oneLine(t, "Untitled form");

/** Import a Google Form and its responses by pasting its link, or by picking it from the user's own forms. */
export function GoogleFormsImportDialog({ visible, forms, canAccessForms, onClose, onOpenForm, onChanged, onReconnect }: {
  visible: boolean;
  forms: FormSummary[];
  /** False when the signed-in account never allowed Google Forms access: importing needs a fresh sign-in. */
  canAccessForms: boolean;
  onClose: () => void;
  onOpenForm: (id: string) => void;
  onChanged: () => void | Promise<unknown>;
  onReconnect: () => void | Promise<unknown>;
}) {
  const toast = useToast();
  const [link, setLink] = useState("");
  const [query, setQuery] = useState("");
  const [list, setList] = useState<GoogleFormItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listNote, setListNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLink("");
    setQuery("");
    setError(null);
    setListNote(null);
    setList([]);
    if (!canAccessForms) return;
    setLoading(true);
    googleFormsApi.list()
      .then((items: GoogleFormItem[]) => setList(items))
      // Listing is a convenience: without its permission the pasted link still works.
      .catch((e: ApiError) => (e.body?.code === "listing_scope_missing" ? setListNote(e.message) : setError(e.message)))
      .finally(() => setLoading(false));
  }, [visible, canAccessForms]);

  const finish = async (result: ImportResult) => {
    const parts = [result.alreadyImported ? "Already on this device" : `Imported "${untitled(result.form.title)}"`];
    if (result.sync) parts.push(`${result.sync.newResponseCount} new response${result.sync.newResponseCount === 1 ? "" : "s"}`);
    if (result.skipped?.length) parts.push(`${result.skipped.length} unsupported item${result.skipped.length === 1 ? "" : "s"} skipped`);
    toast(parts.join(" · "), "success");
    if (result.responseImportError) toast(`Responses weren't imported: ${result.responseImportError}`, "danger");
    onClose();
    await onChanged();
    onOpenForm(result.form.id);
  };

  const run = async (key: string, fn: () => Promise<ImportResult>) => {
    setBusyId(key);
    setError(null);
    try {
      await finish(await fn());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const importLink = () => link.trim() && run("link", () => googleFormsApi.importLink(link));
  const shown = list.filter((f) => untitled(f.name).toLowerCase().includes(query.toLowerCase()));

  return (
    <Dialog visible={visible} title="Import from Google Forms" onClose={onClose} width={560}>
      {!canAccessForms ? (
        <Notice tone="warning" title="More access needed" actionLabel="Sign in again" onAction={() => void onReconnect()}>
          This Google account hasn't allowed access to Google Forms yet. Sign in again and leave the Google Forms permissions ticked.
        </Notice>
      ) : (
        <>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <TextField
            label="Form link"
            hint="Open the form in Google Forms as its owner and paste the link from the address bar."
            placeholder="https://docs.google.com/forms/d/…/edit"
            value={link}
            onChangeText={setLink}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={importLink}
          />
          <Button label="Import" variant="primary" disabled={!link.trim()} loading={busyId === "link"} onPress={importLink} />

          {listNote ? <Text variant="small" tone="secondary">{listNote}</Text> : null}
          {loading ? <Spinner label="Loading your Google Forms" /> : list.length > 0 ? (
            <>
              <Text variant="bodyStrong">Or pick one of your forms</Text>
              <SearchField value={query} onChangeText={setQuery} placeholder="Search your Google Forms" />
              <View>
                {shown.map((f, i) => {
                  const linked = forms.find((x) => x.googleFormId === f.id);
                  return (
                    <ListRow
                      key={f.id}
                      last={i === shown.length - 1}
                      icon={FileText}
                      title={untitled(f.name)}
                      subtitle={linked ? "Already on this device" : undefined}
                      trailing={
                        <Button
                          label={linked ? "Sync" : "Import"}
                          variant={linked ? "secondary" : "primary"}
                          compact
                          loading={busyId === f.id}
                          onPress={() => run(f.id, () => googleFormsApi.importId(f.id))}
                        />
                      }
                    />
                  );
                })}
                {shown.length === 0 ? <Text tone="secondary" align="center">No forms match "{query}".</Text> : null}
              </View>
            </>
          ) : !listNote && !error ? (
            <EmptyState icon={FileText} title="No Google Forms found" body="Paste a form's link above to import it." />
          ) : null}
          <View style={{ height: space[1] }} />
        </>
      )}
    </Dialog>
  );
}

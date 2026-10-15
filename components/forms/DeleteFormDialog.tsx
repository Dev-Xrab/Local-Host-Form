import { useEffect, useState } from "react";
import { View } from "react-native";
import { formsApi } from "../../src/features/forms/services/formsApi";
import { formatDateTime } from "../../src/features/sessions/utils/time";
import { Badge, Button, Dialog, Notice, Spinner, Surface, Text, TextField, radius, space, useTheme } from "../../ui";
import { ScrollView } from "react-native";
import { oneLine } from "../../lib/text";

interface ResponseRow { id: string; respondentName?: string; sessionName?: string; status?: string; submittedAt?: string | null }

const MAX_LISTED = 100;

/**
 * Delete confirmation for a form. A form with no responses is a plain confirm. A form with
 * responses lists them first and only unlocks "Delete form" once its ID is typed exactly, so a
 * form that holds collected data can't be removed by a stray click.
 */
export function DeleteFormDialog({ form, onCancel, onConfirm }: { form: { id: string; title?: string } | null; onCancel: () => void; onConfirm: () => void | Promise<void> }) {
  const { colors } = useTheme();
  const [responses, setResponses] = useState<ResponseRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTyped("");
    setError(null);
    setResponses(null);
    setLoadError(null);
    if (!form) return;
    let cancelled = false;
    formsApi.responses(form.id)
      .then((rows: ResponseRow[]) => { if (!cancelled) setResponses(rows); })
      .catch((err: Error) => { if (!cancelled) setLoadError(err.message); });
    return () => { cancelled = true; };
  }, [form?.id]);

  if (!form) return null;
  const loading = responses === null && !loadError;
  const count = responses?.length ?? 0;
  const needsId = count > 0 || !!loadError;
  const idMatches = typed.trim() === form.id;
  const canDelete = !loading && (!needsId || idMatches);

  const confirm = async () => {
    if (!canDelete || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      visible
      title="Delete form"
      onClose={onCancel}
      width={520}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onCancel} />
          <Button label="Delete form" variant="danger" disabled={!canDelete} loading={busy} onPress={confirm} />
        </>
      }
    >
      <Text tone="secondary">{`Delete "${oneLine(form.title, "Untitled form")}"? This permanently deletes it along with every session and response under it. This can't be undone.`}</Text>

      {loading ? <Spinner label="Checking responses" /> : null}
      {loadError ? <Notice tone="warning">{`Couldn't check this form's responses (${loadError}). Type the form ID to delete it anyway.`}</Notice> : null}

      {count > 0 ? (
        <View style={{ gap: space[2] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <Text variant="label">Responses that will be deleted</Text>
            <Badge label={String(count)} tone="danger" />
          </View>
          <Surface padded={false} style={{ borderRadius: radius.md }}>
            <ScrollView style={{ maxHeight: 220 }}>
              {responses!.slice(0, MAX_LISTED).map((r, i, arr) => (
                <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[3], paddingVertical: space[2], borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="small" style={{ fontWeight: "500" }} numberOfLines={1}>{r.respondentName || "Anonymous"}</Text>
                    <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ fontWeight: "400" }}>{r.sessionName || "Untitled session"}</Text>
                  </View>
                  <Text variant="caption" tone="secondary" style={{ fontWeight: "400" }}>{r.submittedAt ? formatDateTime(r.submittedAt) : r.status === "in_progress" ? "In progress" : "—"}</Text>
                </View>
              ))}
              {count > MAX_LISTED ? <Text variant="caption" tone="tertiary" style={{ padding: space[3], fontWeight: "400" }}>{`+${count - MAX_LISTED} more not shown`}</Text> : null}
            </ScrollView>
          </Surface>
        </View>
      ) : null}

      {needsId ? (
        <View style={{ gap: space[2] }}>
          <Text variant="small" tone="secondary">Type this form's ID to confirm:</Text>
          <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radius.md, paddingHorizontal: space[3], paddingVertical: space[2] }}>
            <Text variant="small" selectable style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>{form.id}</Text>
          </View>
          <TextField value={typed} onChangeText={setTyped} placeholder="Paste or type the form ID" autoCapitalize="none" autoCorrect={false} accessibilityLabel="Form ID" onSubmitEditing={confirm} error={typed && !idMatches ? "That doesn't match the form ID." : null} />
        </View>
      ) : null}

      {error ? <Text variant="small" tone="danger" accessibilityRole="alert">{error}</Text> : null}
    </Dialog>
  );
}

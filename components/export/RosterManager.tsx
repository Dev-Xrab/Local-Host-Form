import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { ConfirmDialog, Notice, Text, TextField, space } from "../../ui";
import { parseRosterText, rosterToText, syncRoster, type Student } from "../../lib/roster";

const DEBOUNCE_MS = 700;

/**
 * The roster lets many differently-typed respondent names ("Jon" vs "Jonathan D.") fold into one
 * real student row in the Bulk Export table. Edits save on their own shortly after the last
 * keystroke, then `onChanged` lets the parent refresh whatever is built from the roster.
 */
export function RosterManager({ students, onChanged }: { students: Student[]; onChanged: () => void | Promise<unknown> }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pendingClear, setPendingClear] = useState(false);
  const edited = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);
  const queued = useRef<string | null>(null);

  // Mirror the stored roster into the box until the user starts typing; after that the box is theirs.
  useEffect(() => {
    if (!edited.current) setText(rosterToText(students));
  }, [students]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const run = async (value: string): Promise<void> => {
    if (running.current) { queued.current = value; return; }
    running.current = true;
    setStatus("saving");
    setError(null);
    try {
      await syncRoster(value);
      await onChanged();
      setStatus("saved");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    } finally {
      running.current = false;
      if (queued.current !== null) {
        const next = queued.current;
        queued.current = null;
        run(next);
      }
    }
  };

  // Wiping the whole box while students exist is far more likely a slip than an intent, and here it
  // would delete the roster live, so that one case asks first.
  const commit = (value: string) => {
    if (!parseRosterText(value).length && students.length > 0) return setPendingClear(true);
    run(value);
  };

  const change = (value: string) => {
    edited.current = true;
    setText(value);
    setStatus("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; commit(value); }, DEBOUNCE_MS);
  };

  const blur = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    commit(text);
  };

  return (
    <View style={{ gap: space[2] }}>
      <Text variant="small" tone="secondary">One student per line: name, then optionally a student ID and email, separated by commas, e.g. "Juan Dela Cruz, 2021-0456, juan@school.edu". The table updates as you type; a student removed from this list is removed from the roster.</Text>
      <TextField accessibilityLabel="Roster" value={text} onChangeText={change} onBlur={blur} multiline rows={5} placeholder={"Juan Dela Cruz, 2021-0456, juan@school.edu\nMaria Santos, 2021-0457"} />
      {status === "saving" ? <Text variant="small" tone="secondary">Saving…</Text> : null}
      {status === "saved" ? <Text variant="small" tone="success">{`Saved. ${students.length} student${students.length === 1 ? "" : "s"} on the roster.`}</Text> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <ConfirmDialog
        visible={pendingClear}
        title="Clear roster"
        confirmLabel="Clear roster"
        message={`The roster box is empty. This will remove all ${students.length} student${students.length === 1 ? "" : "s"} from the roster.`}
        onCancel={() => { setPendingClear(false); edited.current = false; setText(rosterToText(students)); }}
        onConfirm={async () => { setPendingClear(false); await run(""); }}
      />
    </View>
  );
}

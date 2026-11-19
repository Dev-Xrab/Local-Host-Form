import { useMemo, useState, type DragEvent } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { Paperclip } from "lucide-react-native";
import { MAX_UPLOAD_BYTES, isAllowedUploadType } from "../../src/lib/fileTypes";
import { getMatrixMissingRows, isMatrixMultiSelect } from "../../src/lib/matrixQuestions";
import { Select, Text, radius, space, useLayout } from "../../ui";
import { GButton, GChoice, GLineInput, GMark, GText, useGF } from "../../ui/gforms";
import type { MatrixColumn, Question } from "../../lib/formStore";
import { pickFileDataUri } from "../../lib/platform";
import { DateTimeInput } from "./DateTimeInput";

export interface FieldProps<T = unknown> {
  question: Question;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  error?: string;
}

const ShortAnswerField = ({ value, onChange, disabled, error }: FieldProps<string | undefined>) => (
  <GLineInput value={value ?? ""} onChangeText={onChange} editable={!disabled} invalid={!!error} placeholder="Your answer" accessibilityLabel="Your answer" width="60%" />
);

const ParagraphField = ({ value, onChange, disabled, error }: FieldProps<string | undefined>) => (
  <GLineInput value={value ?? ""} onChangeText={onChange} editable={!disabled} invalid={!!error} placeholder="Your answer" autoGrow accessibilityLabel="Your answer" />
);

const MultipleChoiceField = ({ question, value, onChange, disabled }: FieldProps<number | undefined>) => (
  <View accessibilityRole="radiogroup" style={{ gap: 2 }}>
    {(question.options as string[]).map((opt, i) => <GChoice key={i} shape="radio" label={opt} checked={value === i} disabled={disabled} onPress={() => onChange(i)} />)}
  </View>
);

const CheckboxesField = ({ question, value, onChange, disabled }: FieldProps<number[] | undefined>) => {
  const selected = Array.isArray(value) ? value : [];
  return (
    <View>
      {(question.options as string[]).map((opt, i) => (
        <GChoice key={i} shape="check" label={opt} checked={selected.includes(i)} disabled={disabled} onPress={() => onChange(selected.includes(i) ? selected.filter((v) => v !== i) : [...selected, i])} />
      ))}
    </View>
  );
};

const DropdownField = ({ question, value, onChange, disabled }: FieldProps<number | null | undefined>) => (
  <View style={{ maxWidth: 360 }} pointerEvents={disabled ? "none" : "auto"}>
    <Select<string>
      value={value == null ? null : String(value)}
      placeholder="Choose"
      options={(question.options as string[]).map((o, i) => ({ value: String(i), label: o }))}
      onChange={(v) => onChange(Number(v))}
    />
  </View>
);

function LinearScaleField({ question, value, onChange, disabled }: FieldProps<number | undefined>) {
  const g = useGF();
  const { min, max, minLabel, maxLabel } = question.scale;
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
      {minLabel ? <GText size={14} secondary style={{ paddingBottom: 8 }}>{minLabel}</GText> : null}
      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
        {numbers.map((n) => (
          <Pressable key={n} accessibilityRole="radio" accessibilityLabel={String(n)} accessibilityState={{ checked: value === n, disabled }} disabled={disabled} onPress={() => onChange(n)}
            style={(s) => [{ minWidth: 44, alignItems: "center", gap: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: (s as { hovered?: boolean }).hovered ? g.hover : "transparent" }]}>
            <GText size={14} secondary>{n}</GText>
            <GMark shape="radio" checked={value === n} size={22} />
          </Pressable>
        ))}
      </View>
      {maxLabel ? <GText size={14} secondary style={{ paddingBottom: 8 }}>{maxLabel}</GText> : null}
    </View>
  );
}

const DateField = ({ value, onChange, disabled }: FieldProps<string | undefined>) => <DateTimeInput kind="date" value={value ?? ""} onChange={onChange} disabled={disabled} />;
const TimeField = ({ value, onChange, disabled }: FieldProps<string | undefined>) => <DateTimeInput kind="time" value={value ?? ""} onChange={onChange} disabled={disabled} />;

function FileUploadField({ value, onChange, disabled }: FieldProps<string | null | undefined>) {
  const g = useGF();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const dropped = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) return setError("File is too large (max 5 MB).");
    if (!isAllowedUploadType(file.type)) return setError("This file type is not supported. Use an image, PDF, document, audio, video or text file.");
    setError(null);
    setPreparing(true);
    try {
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read this file. Try choosing it again."));
        reader.readAsDataURL(file);
      });
      setName(file.name);
      onChange(dataUri);
    } catch (cause) { setError((cause as Error).message); }
    finally { setPreparing(false); }
  };

  const choose = async () => {
    setError(null);
    try {
      const file = await pickFileDataUri();
      if (!file) return;
      // 5MB keeps SQLite rows and JSON payloads reasonable for local self-hosting. The server
      // re-checks size, type, and the file's actual contents (server/security/uploads.js).
      if (file.size > MAX_UPLOAD_BYTES) return setError("File is too large (max 5MB).");
      if (!isAllowedUploadType(file.mime)) return setError("This type of file can't be uploaded. Use an image, PDF, document, audio, video, or text file.");
      setName(file.name);
      onChange(file.dataUri);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <View style={{ gap: space[2] }}>
      {value ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Paperclip size={16} color={g.textSecondary} />
          <GText>{name || "1 file attached"}</GText>
          <GButton label="Replace" disabled={disabled} onPress={choose} />
          <GButton label="Remove" disabled={disabled} onPress={() => { setName(""); setError(null); onChange(null); }} />
        </View>
      ) : (
        <View {...(Platform.OS === "web" ? { onDragOver: (event: DragEvent<HTMLElement>) => event.preventDefault(), onDrop: dropped } : {})} style={{ minHeight: 128, borderWidth: 1, borderStyle: "dashed", borderColor: g.borderStrong, borderRadius: 8, alignItems: "center", justifyContent: "center", padding: space[4], gap: space[2] }}>
          <Text variant="small" tone="secondary">Drop a file here, or choose one (up to 5 MB)</Text>
          <GButton variant="outlined" label={preparing ? "Preparing file…" : "Add file"} icon={<Paperclip size={16} color={g.accent} />} loading={preparing} disabled={disabled} onPress={choose} />
          <Text variant="small" tone="secondary">Image, PDF, document, audio, video or text</Text>
        </View>
      )}
      {error ? <GText size={12} color={g.error} accessibilityRole="alert">{error}</GText> : null}
    </View>
  );
}

function MarkCell({ checked, multiple, label, onPress, disabled }: { checked: boolean; multiple: boolean; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole={multiple ? "checkbox" : "radio"} accessibilityLabel={label} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress} hitSlop={10}>
      <GMark shape={multiple ? "check" : "radio"} checked={checked} size={22} />
    </Pressable>
  );
}

/**
 * One grid, never separate per-row questions: rows share one column list. Wide screens get a real
 * table; phones stack each row into its own option group so no sideways scrolling is required.
 */
function MatrixGridField({ question, value, onChange, disabled, error }: FieldProps<Record<string, string | string[]> | undefined>) {
  const g = useGF();
  const { isPhone } = useLayout();
  const rows = question.rows || [];
  const columns = question.options as MatrixColumn[];
  const multiple = isMatrixMultiSelect(question.type);
  const answers = (value && typeof value === "object" ? value : {}) as Record<string, string | string[]>;

  const missing = useMemo(() => (error ? new Set((getMatrixMissingRows(question, value) as { id: string }[]).map((r) => r.id)) : null), [error, question, value]);

  const isChecked = (rowId: string, colId: string) => (multiple ? Array.isArray(answers[rowId]) && (answers[rowId] as string[]).includes(colId) : answers[rowId] === colId);
  const toggle = (rowId: string, colId: string) => {
    if (multiple) {
      const cur = Array.isArray(answers[rowId]) ? (answers[rowId] as string[]) : [];
      onChange({ ...answers, [rowId]: cur.includes(colId) ? cur.filter((c) => c !== colId) : [...cur, colId] });
    } else onChange({ ...answers, [rowId]: colId });
  };

  if (isPhone) {
    return (
      <View style={{ gap: space[4] }}>
        {rows.map((row) => (
          <View key={row.id} style={{ gap: space[1], padding: space[3], borderWidth: 1, borderColor: missing?.has(row.id) ? g.error : g.border, borderRadius: 8 }}>
            <GText weight="500" color={missing?.has(row.id) ? g.error : undefined}>{row.label}{missing?.has(row.id) ? " (required)" : ""}</GText>
            {columns.map((col) => {
              const props = { label: col.label, checked: isChecked(row.id, col.id), disabled, onChange: () => toggle(row.id, col.id) };
              return <GChoice key={col.id} shape={multiple ? "check" : "radio"} label={props.label} checked={props.checked} disabled={disabled} onPress={props.onChange} />;
            })}
          </View>
        ))}
      </View>
    );
  }

  const cellWidth = 76;
  const labelWidth = isPhone ? 120 : 180;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }}>
      <View accessibilityRole="none" style={{ minWidth: "100%" }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", borderBottomWidth: 1, borderBottomColor: g.border, paddingBottom: space[2] }}>
          <View style={{ width: labelWidth }} />
          {columns.map((c) => <GText key={c.id} size={13} secondary style={{ width: cellWidth, textAlign: "center" }}>{c.label}</GText>)}
        </View>
        {rows.map((row) => (
          <View key={row.id} style={{ flexDirection: "row", alignItems: "center", minHeight: 48, borderBottomWidth: 1, borderBottomColor: g.border, backgroundColor: missing?.has(row.id) ? g.errorSoft : undefined }}>
            <View nativeID={`matrix-label-${row.id}`} style={{ width: labelWidth, paddingRight: space[2], backgroundColor: g.card }}>
              <GText size={14}>{row.label}</GText>
              {missing?.has(row.id) ? <GText size={12} color={g.error}>Required</GText> : null}
            </View>
            {columns.map((c) => (
              <View key={c.id} style={{ width: cellWidth, alignItems: "center" }}>
                <MarkCell checked={isChecked(row.id, c.id)} multiple={multiple} label={`${row.label}: ${c.label}`} disabled={disabled} onPress={() => toggle(row.id, c.id)} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/** type -> renderer. Question *metadata* lives in src/lib/questionTypes.js; this is the respondent UI's own map. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const RESPONDENT_FIELDS: Record<string, (p: FieldProps<any>) => React.ReactElement> = {
  short_answer: ShortAnswerField,
  paragraph: ParagraphField,
  multiple_choice: MultipleChoiceField,
  checkboxes: CheckboxesField,
  dropdown: DropdownField,
  linear_scale: LinearScaleField,
  date: DateField,
  time: TimeField,
  file_upload: FileUploadField,
  matrix: MatrixGridField,
  matrix_checkbox: MatrixGridField,
};

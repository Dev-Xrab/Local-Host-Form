import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Paperclip } from "lucide-react-native";
import { MAX_UPLOAD_BYTES, isAllowedUploadType } from "../../src/lib/fileTypes";
import { getMatrixMissingRows, isMatrixMultiSelect } from "../../src/lib/matrixQuestions";
import { Button, Checkbox, Icon, Radio, Select, Text, TextField, radius, space, useLayout, useTheme } from "../../ui";
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

const ShortAnswerField = ({ value, onChange, disabled }: FieldProps<string | undefined>) => (
  <TextField value={value ?? ""} onChangeText={onChange} editable={!disabled} placeholder="Your answer" accessibilityLabel="Your answer" />
);

const ParagraphField = ({ value, onChange, disabled }: FieldProps<string | undefined>) => (
  <TextField value={value ?? ""} onChangeText={onChange} editable={!disabled} placeholder="Your answer" multiline rows={4} accessibilityLabel="Your answer" />
);

const MultipleChoiceField = ({ question, value, onChange, disabled }: FieldProps<number | undefined>) => (
  <View accessibilityRole="radiogroup">
    {(question.options as string[]).map((opt, i) => <Radio key={i} label={opt} checked={value === i} disabled={disabled} onChange={() => onChange(i)} />)}
  </View>
);

const CheckboxesField = ({ question, value, onChange, disabled }: FieldProps<number[] | undefined>) => {
  const selected = Array.isArray(value) ? value : [];
  return (
    <View>
      {(question.options as string[]).map((opt, i) => (
        <Checkbox key={i} label={opt} checked={selected.includes(i)} disabled={disabled} onChange={() => onChange(selected.includes(i) ? selected.filter((v) => v !== i) : [...selected, i])} />
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
  const { colors } = useTheme();
  const { min, max, minLabel, maxLabel } = question.scale;
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <View style={{ gap: space[2] }}>
      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {numbers.map((n) => {
          const on = value === n;
          return (
            <Pressable
              key={n}
              accessibilityRole="radio"
              accessibilityLabel={String(n)}
              accessibilityState={{ checked: on, disabled }}
              disabled={disabled}
              onPress={() => onChange(n)}
              style={{ width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: on ? colors.primary : colors.borderStrong, backgroundColor: on ? colors.primary : colors.surface }}
            >
              <Text variant="label" style={{ color: on ? colors.primaryText : colors.text }}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      {minLabel || maxLabel ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text variant="small" tone="secondary">{minLabel}</Text>
          <Text variant="small" tone="secondary">{maxLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

const DateField = ({ value, onChange, disabled }: FieldProps<string | undefined>) => <DateTimeInput kind="date" value={value ?? ""} onChange={onChange} disabled={disabled} />;
const TimeField = ({ value, onChange, disabled }: FieldProps<string | undefined>) => <DateTimeInput kind="time" value={value ?? ""} onChange={onChange} disabled={disabled} />;

function FileUploadField({ value, onChange, disabled }: FieldProps<string | null | undefined>) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    <View style={{ gap: space[2], alignItems: "flex-start" }}>
      {value ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Icon icon={Paperclip} size={16} />
          <Text>{name || "1 file attached"}</Text>
          <Button label="Remove" variant="ghost" compact disabled={disabled} onPress={() => { setName(""); setError(null); onChange(null); }} />
        </View>
      ) : (
        <Button label="Add file" icon={Paperclip} disabled={disabled} onPress={choose} />
      )}
      {error ? <Text variant="small" tone="danger" accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

function MarkCell({ checked, multiple, label, onPress, disabled }: { checked: boolean; multiple: boolean; label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={{ width: 22, height: 22, borderRadius: multiple ? 4 : radius.pill, borderWidth: 1.5, borderColor: checked ? colors.primary : colors.borderStrong, backgroundColor: checked ? colors.primary : colors.surface, alignItems: "center", justifyContent: "center" }}
    >
      {checked ? <View style={{ width: multiple ? 10 : 8, height: multiple ? 10 : 8, borderRadius: multiple ? 2 : radius.pill, backgroundColor: colors.primaryText }} /> : null}
    </Pressable>
  );
}

/**
 * One grid, never separate per-row questions: rows share one column list. Wide screens get a real
 * table; a phone with few columns restacks into one option list per row; a phone with many columns
 * (say a 1-10 rating) scrolls the table sideways instead of stacking ten options per row.
 */
function MatrixGridField({ question, value, onChange, disabled, error }: FieldProps<Record<string, string | string[]> | undefined>) {
  const { colors } = useTheme();
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

  if (isPhone && columns.length <= 4) {
    return (
      <View style={{ gap: space[4] }}>
        {rows.map((row) => (
          <View key={row.id} style={{ gap: space[1] }}>
            <Text variant="bodyStrong" tone={missing?.has(row.id) ? "danger" : "default"}>{row.label}{missing?.has(row.id) ? " (required)" : ""}</Text>
            {columns.map((col) => {
              const props = { label: col.label, checked: isChecked(row.id, col.id), disabled, onChange: () => toggle(row.id, col.id) };
              return multiple ? <Checkbox key={col.id} {...props} /> : <Radio key={col.id} {...props} />;
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
        <View style={{ flexDirection: "row", alignItems: "flex-end", borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: space[2] }}>
          <View style={{ width: labelWidth }} />
          {columns.map((c) => <Text key={c.id} variant="caption" tone="secondary" align="center" style={{ width: cellWidth }}>{c.label}</Text>)}
        </View>
        {rows.map((row) => (
          <View key={row.id} style={{ flexDirection: "row", alignItems: "center", minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: missing?.has(row.id) ? colors.dangerSoft : undefined }}>
            <View style={{ width: labelWidth, paddingRight: space[2] }}>
              <Text variant="small">{row.label}</Text>
              {missing?.has(row.id) ? <Text variant="caption" tone="danger">Required</Text> : null}
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

import { Pressable, View } from "react-native";
import { ArrowDown, ArrowUp, Check, Plus, X } from "lucide-react-native";
import { Button, Checkbox, IconButton, Icon, InlineInput, Select, Text, TextField, radius, space, useTheme } from "../../ui";
import { MATRIX_SCALE_PRESETS } from "../../src/lib/matrixQuestions";
import { useFormActions, type MatrixColumn, type Question } from "../../lib/formStore";

type Variant = "radio" | "checkbox" | "numbered";

function Marker({ variant, index, correct, onToggle }: { variant: Variant; index: number; correct?: boolean; onToggle?: () => void }) {
  const { colors } = useTheme();
  const shape = { width: 22, height: 22, borderWidth: 1.5, alignItems: "center" as const, justifyContent: "center" as const, borderRadius: variant === "checkbox" ? 4 : radius.pill };
  const border = correct ? colors.success : colors.borderStrong;
  const inner =
    variant === "numbered" ? <Text variant="caption" tone={correct ? "success" : "tertiary"}>{index + 1}</Text> : correct ? <Icon icon={Check} size={13} color={colors.success} strokeWidth={3} /> : null;
  if (!onToggle) return <View style={[shape, { borderColor: border }]}>{inner}</View>;
  return (
    <Pressable
      accessibilityRole={variant === "checkbox" ? "checkbox" : "radio"}
      accessibilityLabel={correct ? `Option ${index + 1} is a correct answer` : `Mark option ${index + 1} as a correct answer`}
      accessibilityState={{ checked: !!correct }}
      hitSlop={10}
      onPress={onToggle}
      style={[shape, { borderColor: border, backgroundColor: correct ? colors.successSoft : "transparent" }]}
    >
      {inner}
    </Pressable>
  );
}

/** Options for multiple choice, checkboxes and dropdown. The marker doubles as the answer-key toggle. */
export function OptionList({ question, variant }: { question: Question; variant: Variant }) {
  const { updateOption, removeOption, addOption, toggleCorrectAnswer } = useFormActions();
  const correct = Array.isArray(question.correctAnswerIndex) ? question.correctAnswerIndex : [];
  const options = question.options as string[];

  return (
    <View style={{ gap: space[1] }}>
      <Text variant="caption" tone="tertiary">Tap a marker to set the correct answer</Text>
      {options.map((opt, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <Marker variant={variant} index={i} correct={correct.includes(i)} onToggle={() => toggleCorrectAnswer(question.id, i)} />
          <View style={{ flex: 1 }}>
            <InlineInput value={opt} placeholder={`Option ${i + 1}`} onChangeText={(v) => updateOption(question.id, i, v)} onSubmitEditing={() => addOption(question.id)} />
          </View>
          {options.length > 1 ? <IconButton icon={X} label={`Remove option ${i + 1}`} onPress={() => removeOption(question.id, i)} /> : null}
        </View>
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <Marker variant={variant} index={options.length} />
        <Button label="Add option" variant="ghost" compact icon={Plus} onPress={() => addOption(question.id)} />
      </View>
    </View>
  );
}

/** One question, many rows, one shared column scale: editing a column updates every row at once. */
export function MatrixEditor({ question }: { question: Question }) {
  const a = useFormActions();
  const variant: Variant = question.type === "matrix_checkbox" ? "checkbox" : "radio";
  const columns = question.options as MatrixColumn[];
  const requireAll = question.scale?.requireAllRows !== false;

  return (
    <View style={{ gap: space[4] }}>
      <View style={{ gap: space[1] }}>
        <Text variant="label">Rows</Text>
        {question.rows.map((row, i) => (
          <View key={row.id} style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <Text variant="caption" tone="tertiary" style={{ width: 20 }}>{i + 1}.</Text>
            <View style={{ flex: 1 }}><InlineInput value={row.label} placeholder={`Row ${i + 1}`} onChangeText={(v) => a.updateMatrixRow(question.id, row.id, v)} /></View>
            <IconButton icon={ArrowUp} label="Move row up" disabled={i === 0} onPress={() => a.moveMatrixRow(question.id, row.id, -1)} />
            <IconButton icon={ArrowDown} label="Move row down" disabled={i === question.rows.length - 1} onPress={() => a.moveMatrixRow(question.id, row.id, 1)} />
            {question.rows.length > 1 ? <IconButton icon={X} label="Remove row" onPress={() => a.removeMatrixRow(question.id, row.id)} /> : null}
          </View>
        ))}
        <Button label="Add row" icon={Plus} variant="ghost" compact onPress={() => a.addMatrixRow(question.id)} />
      </View>

      <View style={{ gap: space[1] }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
          <View style={{ flex: 1 }}>
            <Text variant="label">Columns</Text>
            <Text variant="caption" tone="tertiary">Shared scale: applies to every row above</Text>
          </View>
          <View style={{ width: 170 }}>
            <Select label={undefined} value={null} placeholder="Use a preset…" options={MATRIX_SCALE_PRESETS.map((p: { id: string; label: string }) => ({ value: p.id, label: p.label }))} onChange={(id) => a.applyMatrixColumnPreset(question.id, id)} />
          </View>
        </View>
        {columns.map((col, i) => (
          <View key={col.id} style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <Marker variant={variant} index={i} />
            <View style={{ flex: 1 }}><InlineInput value={col.label} placeholder={`Column ${i + 1}`} onChangeText={(v) => a.updateMatrixColumn(question.id, col.id, { label: v })} /></View>
            <View style={{ width: 56 }}>
              <InlineInput value={String(col.value ?? "")} keyboardType="numeric" accessibilityLabel={`Numeric value of column ${i + 1}, used for row averages`} onChangeText={(v) => a.updateMatrixColumn(question.id, col.id, { value: Number(v) || 0 })} />
            </View>
            <IconButton icon={ArrowUp} label="Move column earlier" disabled={i === 0} onPress={() => a.moveMatrixColumn(question.id, col.id, -1)} />
            <IconButton icon={ArrowDown} label="Move column later" disabled={i === columns.length - 1} onPress={() => a.moveMatrixColumn(question.id, col.id, 1)} />
            {columns.length > 1 ? <IconButton icon={X} label="Remove column" onPress={() => a.removeMatrixColumn(question.id, col.id)} /> : null}
          </View>
        ))}
        <Button label="Add column" icon={Plus} variant="ghost" compact onPress={() => a.addMatrixColumn(question.id)} />
      </View>

      <Checkbox label="Require a response for every row" checked={requireAll} onChange={(v) => a.updateMatrixSettings(question.id, { requireAllRows: v })} />
    </View>
  );
}

const MIN_OPTIONS = ["0", "1"].map((n) => ({ value: n, label: n }));
const MAX_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: String(n), label: String(n) }));

export function ScaleEditor({ question }: { question: Question }) {
  const { updateScale } = useFormActions();
  const { min, max, minLabel, maxLabel } = question.scale;
  const { colors } = useTheme();
  const steps = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);

  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[2] }}>
        <View style={{ width: 96 }}><Select label="From" value={String(min)} options={MIN_OPTIONS} onChange={(v) => updateScale(question.id, { min: Number(v) })} /></View>
        <Text style={{ paddingBottom: 8 }}>to</Text>
        <View style={{ width: 96 }}><Select label="To" value={String(max)} options={MAX_OPTIONS} onChange={(v) => updateScale(question.id, { max: Number(v) })} /></View>
      </View>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <View style={{ flex: 1 }}><TextField label={`Label for ${min} (optional)`} value={minLabel} onChangeText={(v) => updateScale(question.id, { minLabel: v })} /></View>
        <View style={{ flex: 1 }}><TextField label={`Label for ${max} (optional)`} value={maxLabel} onChangeText={(v) => updateScale(question.id, { maxLabel: v })} /></View>
      </View>
      <View style={{ flexDirection: "row", gap: space[3], flexWrap: "wrap" }}>
        {steps.map((n) => (
          <View key={n} style={{ alignItems: "center", gap: 4 }}>
            <View style={{ width: 20, height: 20, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.borderStrong }} />
            <Text variant="caption" tone="secondary">{n}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

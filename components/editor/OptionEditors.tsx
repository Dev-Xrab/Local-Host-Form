import { Pressable, View } from "react-native";
import { ArrowDown, ArrowUp, Check, Plus, X } from "lucide-react-native";
import { Select, useLayout } from "../../ui";
import { GButton, GIconButton, GLineInput, GMark, GText, useGF } from "../../ui/gforms";
import { MATRIX_SCALE_PRESETS } from "../../src/lib/matrixQuestions";
import { useFormActions, useFormStore, type MatrixColumn, type Question } from "../../lib/formStore";
import { TargetSelect } from "./SectionLink";
import { isQuiz } from "../../src/lib/quiz";

type Variant = "radio" | "checkbox" | "numbered";

/** Static marker. In quiz mode it doubles as the answer-key toggle (green when correct). */
function Marker({ variant, index, correct, onToggle, ghost }: { variant: Variant; index: number; correct?: boolean; onToggle?: () => void; ghost?: boolean }) {
  const g = useGF();
  const inner = variant === "numbered"
    ? <GText size={13} color={correct ? g.success : g.textSecondary} style={{ width: 20, textAlign: "center" }}>{index + 1}.</GText>
    : <View style={{ opacity: ghost ? 0.5 : 1 }}><GMark shape={variant === "checkbox" ? "check" : "radio"} checked={!!correct} correct={correct} /></View>;
  if (!onToggle) return <View style={{ width: 28, alignItems: "center" }}>{inner}</View>;
  return (
    <Pressable accessibilityRole={variant === "checkbox" ? "checkbox" : "radio"} accessibilityLabel={correct ? `Option ${index + 1} is a correct answer` : `Mark option ${index + 1} as a correct answer`} accessibilityState={{ checked: !!correct }} hitSlop={8} onPress={onToggle} style={{ width: 28, alignItems: "center" }}>
      {variant === "numbered" && correct ? <Check size={16} color={g.success} strokeWidth={3} /> : inner}
    </Pressable>
  );
}

/** Options for multiple choice, checkboxes and dropdown. The marker doubles as the answer-key toggle. */
export function OptionList({ question, variant }: { question: Question; variant: Variant }) {
  const { updateOption, removeOption, addOption, toggleCorrectAnswer, setOptionTarget } = useFormActions();
  const g = useGF();
  const { isPhone } = useLayout();
  const hasSections = useFormStore((s) => s.questions.some((q) => q.type === "section"));
  const quiz = useFormStore((s) => isQuiz(s.formSettings, s.questions));
  const correct = Array.isArray(question.correctAnswerIndex) ? question.correctAnswerIndex : [];
  const options = question.options as string[];
  const links = question.navigation?.options;

  return (
    <View style={{ gap: 2 }}>
      {quiz ? <GText size={12} secondary style={{ paddingBottom: 4 }}>Tap a marker to set the correct answer</GText> : null}
      {links && !hasSections ? <GText size={12} secondary style={{ paddingBottom: 4 }}>Add a section to send respondents to it based on their answer.</GText> : null}
      {options.map((opt, i) => (
        <View key={i}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Marker variant={variant} index={i} correct={quiz && correct.includes(i)} onToggle={quiz ? () => toggleCorrectAnswer(question.id, i) : undefined} />
            <View style={{ flex: 1 }}>
              <GLineInput quiet fontSize={14} value={opt} placeholder={`Option ${i + 1}`} onChangeText={(v) => updateOption(question.id, i, v)} onSubmitEditing={() => addOption(question.id)} />
            </View>
            {links && !isPhone ? <View style={{ width: 250 }}><TargetSelect fromId={question.id} value={links[i]} onChange={(t) => setOptionTarget(question.id, i, t)} /></View> : null}
            {options.length > 1 ? <GIconButton label={`Remove option ${i + 1}`} size={36} onPress={() => removeOption(question.id, i)}><X size={18} color={g.textSecondary} /></GIconButton> : <View style={{ width: 36 }} />}
          </View>
          {links && isPhone ? <View style={{ paddingLeft: 36, paddingBottom: 8 }}><TargetSelect fromId={question.id} value={links[i]} onChange={(t) => setOptionTarget(question.id, i, t)} /></View> : null}
        </View>
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Marker variant={variant} index={options.length} ghost />
        <GButton label="Add option" icon={<Plus size={16} color={g.accent} />} onPress={() => addOption(question.id)} />
      </View>
    </View>
  );
}

function Check2({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}><GMark shape="check" checked={checked} /><GText size={14}>{label}</GText></Pressable>;
}

/** One question, many rows, one shared column scale: editing a column updates every row at once. */
export function MatrixEditor({ question }: { question: Question }) {
  const a = useFormActions();
  const g = useGF();
  const variant: Variant = question.type === "matrix_checkbox" ? "checkbox" : "radio";
  const columns = question.options as MatrixColumn[];
  const requireAll = question.scale?.requireAllRows !== false;

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 2 }}>
        <GText size={13} weight="500" secondary>Rows</GText>
        {question.rows.map((row, i) => (
          <View key={row.id} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <GText size={13} secondary style={{ width: 24 }}>{i + 1}.</GText>
            <View style={{ flex: 1 }}><GLineInput quiet value={row.label} placeholder={`Row ${i + 1}`} onChangeText={(v) => a.updateMatrixRow(question.id, row.id, v)} /></View>
            <GIconButton label="Move row up" size={32} disabled={i === 0} onPress={() => a.moveMatrixRow(question.id, row.id, -1)}><ArrowUp size={16} color={g.textSecondary} /></GIconButton>
            <GIconButton label="Move row down" size={32} disabled={i === question.rows.length - 1} onPress={() => a.moveMatrixRow(question.id, row.id, 1)}><ArrowDown size={16} color={g.textSecondary} /></GIconButton>
            {question.rows.length > 1 ? <GIconButton label="Remove row" size={32} onPress={() => a.removeMatrixRow(question.id, row.id)}><X size={16} color={g.textSecondary} /></GIconButton> : <View style={{ width: 32 }} />}
          </View>
        ))}
        <GButton label="Add row" icon={<Plus size={16} color={g.accent} />} onPress={() => a.addMatrixRow(question.id)} />
      </View>

      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <GText size={13} weight="500" secondary>Columns</GText>
            <GText size={12} secondary>Shared scale: applies to every row. The number is used for row averages.</GText>
          </View>
          <View style={{ width: 170 }}>
            <Select label={undefined} value={null} placeholder="Use a preset…" options={MATRIX_SCALE_PRESETS.map((p: { id: string; label: string }) => ({ value: p.id, label: p.label }))} onChange={(id) => a.applyMatrixColumnPreset(question.id, id)} />
          </View>
        </View>
        {columns.map((col, i) => (
          <View key={col.id} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Marker variant={variant} index={i} />
            <View style={{ flex: 1 }}><GLineInput quiet value={col.label} placeholder={`Column ${i + 1}`} onChangeText={(v) => a.updateMatrixColumn(question.id, col.id, { label: v })} /></View>
            <View style={{ width: 52 }}><GLineInput quiet keyboardType="numeric" value={String(col.value ?? "")} accessibilityLabel={`Numeric value of column ${i + 1}, used for row averages`} onChangeText={(v) => a.updateMatrixColumn(question.id, col.id, { value: Number(v) || 0 })} /></View>
            <GIconButton label="Move column earlier" size={32} disabled={i === 0} onPress={() => a.moveMatrixColumn(question.id, col.id, -1)}><ArrowUp size={16} color={g.textSecondary} /></GIconButton>
            <GIconButton label="Move column later" size={32} disabled={i === columns.length - 1} onPress={() => a.moveMatrixColumn(question.id, col.id, 1)}><ArrowDown size={16} color={g.textSecondary} /></GIconButton>
            {columns.length > 1 ? <GIconButton label="Remove column" size={32} onPress={() => a.removeMatrixColumn(question.id, col.id)}><X size={16} color={g.textSecondary} /></GIconButton> : <View style={{ width: 32 }} />}
          </View>
        ))}
        <GButton label="Add column" icon={<Plus size={16} color={g.accent} />} onPress={() => a.addMatrixColumn(question.id)} />
      </View>

      <Check2 label="Require a response in each row" checked={requireAll} onChange={(v) => a.updateMatrixSettings(question.id, { requireAllRows: v })} />
    </View>
  );
}

const MIN_OPTIONS = ["0", "1"].map((n) => ({ value: n, label: n }));
const MAX_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: String(n), label: String(n) }));

export function ScaleEditor({ question }: { question: Question }) {
  const { updateScale } = useFormActions();
  const { min, max, minLabel, maxLabel } = question.scale;
  const g = useGF();
  const steps = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
        <View style={{ width: 90 }}><Select value={String(min)} options={MIN_OPTIONS} onChange={(v) => updateScale(question.id, { min: Number(v) })} /></View>
        <GText style={{ paddingBottom: 12 }}>to</GText>
        <View style={{ width: 90 }}><Select value={String(max)} options={MAX_OPTIONS} onChange={(v) => updateScale(question.id, { max: Number(v) })} /></View>
      </View>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><GText style={{ width: 20 }} secondary>{min}</GText><View style={{ flex: 1 }}><GLineInput quiet value={minLabel} placeholder="Label (optional)" onChangeText={(v) => updateScale(question.id, { minLabel: v })} /></View></View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><GText style={{ width: 20 }} secondary>{max}</GText><View style={{ flex: 1 }}><GLineInput quiet value={maxLabel} placeholder="Label (optional)" onChangeText={(v) => updateScale(question.id, { maxLabel: v })} /></View></View>
      </View>
      <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
        {steps.map((n) => (
          <View key={n} style={{ alignItems: "center", gap: 4 }}>
            <GText size={12} secondary>{n}</GText>
            <GMark shape="radio" />
          </View>
        ))}
      </View>
    </View>
  );
}

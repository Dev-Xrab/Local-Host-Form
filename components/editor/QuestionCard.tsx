import { memo, useMemo, useState, type ReactNode } from "react";
import { Image, Platform, Pressable, View } from "react-native";
import { AlignLeft, ArrowDown, ArrowUp, Check, ChevronDown, Copy, GripHorizontal, ImagePlus, MoreVertical, Split, Trash2, X } from "lucide-react-native";
import { ConfirmDialog, Notice, useLayout } from "../../ui";
import { GButton, GIconButton, GLineInput, GMark, GText, useGF, type GF } from "../../ui/gforms";
import { QUESTION_TYPES, getQuestionType, useFormActions, useFormStore, type Question } from "../../lib/formStore";
import { QUESTION_ICONS, SectionIcon } from "../../lib/questionIcons";
import { pickImageDataUri } from "../../lib/platform";
import { hasAnswerNavigation, supportsAnswerNavigation } from "../../src/lib/sectionFlow";
import { isQuiz } from "../../src/lib/quiz";
import { MatrixEditor, OptionList, ScaleEditor } from "./OptionEditors";
import { TargetSelect, useTargetLabel } from "./SectionLink";
import { useEditorSelection } from "./EditorSelection";
import { DragHandle } from "./DragHandle";

const SIMPLE_PREVIEWS: Record<string, string> = {
  short_answer: "Short-answer text",
  paragraph: "Long-answer text",
  date: "Month, day, year",
  time: "Time",
  file_upload: "Respondents can attach a file",
};

const fixed = (Platform.OS === "web" ? { position: "fixed" } : { position: "absolute" }) as object;

/** Anchored popover: a transparent backdrop closes it, the panel sits under its parent. */
function PopMenu({ open, onClose, children, align = "left", width = 220 }: { open: boolean; onClose: () => void; children: ReactNode; align?: "left" | "right"; width?: number }) {
  const g = useGF();
  if (!open) return null;
  return (
    <>
      <Pressable accessibilityLabel="Close menu" onPress={onClose} style={[fixed, { top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }]} />
      <View style={{ position: "absolute", top: "100%", [align]: 0, width, zIndex: 50, backgroundColor: g.card, borderRadius: 4, paddingVertical: 8, marginTop: 4, borderWidth: 1, borderColor: g.border, boxShadow: g.shadow } as object}>{children}</View>
    </>
  );
}

function MenuItem({ icon, label, onPress, active, danger, disabled }: { icon?: ReactNode; label: string; onPress: () => void; active?: boolean; danger?: boolean; disabled?: boolean }) {
  const g = useGF();
  return (
    <Pressable accessibilityRole="menuitem" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={(s) => [{ minHeight: 40, flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, opacity: disabled ? 0.4 : 1, backgroundColor: active ? g.accentSoft : (s as { hovered?: boolean }).hovered ? g.hover : "transparent" }]}>
      <View style={{ width: 20, alignItems: "center" }}>{icon}</View>
      <GText size={14} color={danger ? g.error : undefined} style={{ flex: 1 }}>{label}</GText>
      {active ? <Check size={16} color={g.accent} /> : null}
    </Pressable>
  );
}

function TypeMenu({ question }: { question: Question }) {
  const g = useGF();
  const a = useFormActions();
  const [open, setOpen] = useState(false);
  const def = getQuestionType(question.type);
  const Cur = def ? QUESTION_ICONS[def.icon] : null;
  const rows: { type: string; label: string; icon: string; divider?: boolean }[] = [];
  const order = ["short_answer", "paragraph", "multiple_choice", "checkboxes", "dropdown", "file_upload", "linear_scale", "matrix", "matrix_checkbox", "date", "time"];
  for (const id of order) { const t = QUESTION_TYPES.find((x) => x.id === id); if (t) rows.push({ type: t.id, label: t.label, icon: t.icon, divider: id === "paragraph" || id === "dropdown" || id === "file_upload" || id === "matrix_checkbox" }); }
  return (
    <View style={{ zIndex: open ? 60 : 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Question type: ${def?.label}`} onPress={() => setOpen((v) => !v)}
        style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: open ? g.accent : g.border, borderRadius: 4, backgroundColor: g.card }}>
        {Cur ? <Cur size={20} color={g.textSecondary} /> : null}
        <GText size={14} style={{ flex: 1 }} numberOfLines={1}>{def?.label}</GText>
        <ChevronDown size={18} color={g.textSecondary} />
      </Pressable>
      <PopMenu open={open} onClose={() => setOpen(false)} align="right" width={260}>
        {rows.map((r) => {
          const I = QUESTION_ICONS[r.icon];
          return (
            <View key={r.type}>
              <MenuItem icon={I ? <I size={18} color={g.textSecondary} /> : null} label={r.label} active={r.type === question.type} onPress={() => { a.changeQuestionType(question.id, r.type); setOpen(false); }} />
              {r.divider ? <View style={{ height: 1, backgroundColor: g.border, marginVertical: 6 }} /> : null}
            </View>
          );
        })}
      </PopMenu>
    </View>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const g = useGF();
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked }} accessibilityLabel={label} onPress={() => onChange(!checked)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, minHeight: 40 }}>
      <GText size={14} secondary>{label}</GText>
      <View style={{ width: 36, height: 14, borderRadius: 7, backgroundColor: checked ? g.accentSoft : g.border, justifyContent: "center" }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: checked ? g.accent : g.cardAlt, borderWidth: checked ? 0 : 1, borderColor: g.borderStrong, marginLeft: checked ? 16 : 0, boxShadow: "0 1px 3px rgba(0,0,0,.35)" } as object} />
      </View>
    </Pressable>
  );
}

/** Read-only look of the question while it isn't selected. */
function Collapsed({ question }: { question: Question }) {
  const g = useGF();
  const t = question.type;
  const opts = Array.isArray(question.options) ? (question.options as (string | { label: string })[]) : [];
  const label = (o: string | { label: string }) => (typeof o === "string" ? o : o.label);
  const targetLabel = useTargetLabel();
  const linked = Array.isArray(question.navigation?.options);
  const row = (key: string | number, text: string, shape?: "radio" | "check" | "n", n?: number, target?: string | null) => (
    <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 32 }}>
      {shape === "n" ? <GText size={13} secondary style={{ width: 20 }}>{(n ?? 0) + 1}.</GText> : shape ? <GMark shape={shape} /> : null}
      <GText size={14} secondary style={{ flex: 1 }}>{text}</GText>
      {linked && target ? <GText size={12} color={g.accent}>→ {targetLabel(target)}</GText> : null}
    </View>
  );
  if (t === "multiple_choice") return <View>{opts.map((o, i) => row(i, label(o) || `Option ${i + 1}`, "radio", i, question.navigation?.options?.[i]))}</View>;
  if (t === "checkboxes") return <View>{opts.map((o, i) => row(i, label(o) || `Option ${i + 1}`, "check"))}</View>;
  if (t === "dropdown") return <View>{opts.map((o, i) => row(i, label(o) || `Option ${i + 1}`, "n", i, question.navigation?.options?.[i]))}</View>;
  if (t === "linear_scale") return <GText size={14} secondary>{question.scale.min} ({question.scale.minLabel || "–"}) → {question.scale.max} ({question.scale.maxLabel || "–"})</GText>;
  if (t === "matrix" || t === "matrix_checkbox") return <GText size={14} secondary>{question.rows.length} rows × {opts.length} columns</GText>;
  return <View style={{ borderBottomWidth: 1, borderBottomColor: g.border, borderStyle: "dotted", paddingVertical: 6, width: t === "short_answer" ? "50%" : "75%" }}><GText size={14} secondary>{SIMPLE_PREVIEWS[t]}</GText></View>;
}

function QuestionBody({ question }: { question: Question }) {
  switch (question.type) {
    case "multiple_choice": return <OptionList question={question} variant="radio" />;
    case "checkboxes": return <OptionList question={question} variant="checkbox" />;
    case "dropdown": return <OptionList question={question} variant="numbered" />;
    case "linear_scale": return <ScaleEditor question={question} />;
    case "matrix":
    case "matrix_checkbox": return <MatrixEditor question={question} />;
    default: return <View style={{ width: question.type === "short_answer" ? "60%" : "90%", borderBottomWidth: 1, borderBottomColor: "#DADCE0", borderStyle: "dotted", paddingVertical: 8 }}><GText size={14} secondary>{SIMPLE_PREVIEWS[question.type] ?? ""}</GText></View>;
  }
}

/** Acceptable free-text answers for auto-grading short answer and paragraph questions. */
function AnswerKey({ question }: { question: Question }) {
  const { addCorrectAnswerVariation, removeCorrectAnswerVariation } = useFormActions();
  const [draft, setDraft] = useState("");
  const g = useGF();
  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    addCorrectAnswerVariation(question.id, v);
    setDraft("");
  };
  return (
    <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: g.border, paddingTop: 16 }}>
      <GText size={14} weight="500">Answer key</GText>
      <GText size={12} secondary>Add accepted responses for automatic scoring. Other text answers can still be reviewed later.</GText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {question.correctAnswers.map((ans, i) => (
          <View key={`${ans}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: g.successSoft, borderRadius: 16, paddingLeft: 12 }}>
            <GText size={13} color={g.success}>{ans}</GText>
            <GIconButton label={`Remove answer ${ans}`} size={28} onPress={() => removeCorrectAnswerVariation(question.id, i)}><X size={14} color={g.success} /></GIconButton>
          </View>
        ))}
      </View>
      <GLineInput value={draft} onChangeText={setDraft} onSubmitEditing={commit} onBlur={commit} placeholder="Type an accepted answer and press Enter" />
    </View>
  );
}

function QuestionImage({ question }: { question: Question }) {
  const { updateQuestion } = useFormActions();
  const [error, setError] = useState<string | null>(null);
  const choose = async () => {
    setError(null);
    try {
      const uri = await pickImageDataUri();
      if (uri) updateQuestion(question.id, { imageUrl: uri });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      {question.imageUrl ? <Image source={{ uri: question.imageUrl }} accessibilityLabel={question.title || "Question image"} resizeMode="contain" onError={() => setError("The question image could not be displayed. Replace it or remove it.")} style={{ width: "100%", height: 200 }} /> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <GButton label={question.imageUrl ? "Replace image" : "Upload an image"} variant="outlined" onPress={choose} />
        <GButton label={question.imageUrl ? "Remove" : "Cancel"} onPress={() => updateQuestion(question.id, { imageUrl: null, showImage: false })} />
      </View>
    </View>
  );
}

interface QuestionCardProps { question: Question; index: number; isFirst: boolean; isLast: boolean }

/** After a card opens for editing, put the cursor in its title so typing can start straight away. */
function focusTitle(id: string) {
  if (Platform.OS !== "web") return;
  setTimeout(() => document.getElementById(`question-${id}`)?.querySelector<HTMLElement>("input, textarea")?.focus({ preventScroll: true }), 60);
}

function CardFrame({ selected, onSelect, children, id }: { selected: boolean; onSelect: () => void; children: ReactNode; id: string }) {
  const g: GF = useGF();
  return (
    <View nativeID={`question-${id}`} style={{ zIndex: selected ? 5 : 1 }}>
      <Pressable accessible={false} onPress={selected ? undefined : () => { onSelect(); focusTitle(id); }} {...(Platform.OS === "web" ? { onFocusCapture: onSelect } : {})}
        style={{ backgroundColor: g.card, borderRadius: 8, borderWidth: 1, borderColor: g.border, paddingLeft: selected ? 5 : 0, ...(selected ? { boxShadow: g.shadow } : null) } as object}>
        {selected ? <View pointerEvents="none" style={{ position: "absolute", left: -1, top: -1, bottom: -1, width: 6, backgroundColor: g.bar, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }} /> : null}
        {children}
      </Pressable>
    </View>
  );
}

function QuestionCardImpl({ question, index, isFirst, isLast }: QuestionCardProps) {
  const g = useGF();
  const { isPhone } = useLayout();
  const { selectedId, setSelectedId } = useEditorSelection();
  const selected = selectedId === question.id;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [more, setMore] = useState(false);
  const a = useFormActions();
  // Points and answer keys only exist in quizzes (Settings > Make this a quiz).
  const quiz = useFormStore((s) => isQuiz(s.formSettings, s.questions));
  const def = getQuestionType(question.type);
  const hasContent = !!question.title.trim() || !!question.description.trim() || !!question.imageUrl || question.correctAnswers.length > 0 || (Array.isArray(question.options) && question.options.some((option) => typeof option === "string" && option.trim() && option !== "Option 1"));
  const remove = () => hasContent ? setConfirmDelete(true) : a.deleteQuestion(question.id);

  if (!selected) {
    return (
      <CardFrame id={question.id} selected={false} onSelect={() => setSelectedId(question.id)}>
        <View style={{ padding: 24, gap: 12 }}>
          <GText size={16} weight="400">{question.title || "Untitled question"}{question.required ? <GText size={16} color={g.error}> *</GText> : null}</GText>
          {question.description ? <GText size={12} secondary>{question.description}</GText> : null}
          {question.imageUrl ? <Image source={{ uri: question.imageUrl }} accessibilityLabel="" resizeMode="contain" style={{ width: "100%", height: 120 }} /> : null}
          <Collapsed question={question} />
          {quiz && def?.isGradable && (question.points ?? 0) > 0 ? <GText size={12} secondary>{question.points} {question.points === 1 ? "point" : "points"}</GText> : null}
        </View>
      </CardFrame>
    );
  }

  return (
    <CardFrame id={question.id} selected onSelect={() => setSelectedId(question.id)}>
      {Platform.OS === "web" ? <DragHandle id={question.id} /> : <View style={{ alignItems: "center", paddingTop: 4, opacity: 0.5 }}><GripHorizontal size={18} color={g.textSecondary} /></View>}
      <View style={{ paddingHorizontal: isPhone ? 16 : 24, paddingBottom: 8, gap: 16 }}>
        <View style={{ flexDirection: isPhone ? "column" : "row", gap: 16, alignItems: isPhone ? "stretch" : "flex-start", zIndex: 20 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <GLineInput boxed autoGrow fontSize={16} placeholder={`Question ${index + 1}`} value={question.title} onChangeText={(v) => a.updateQuestion(question.id, { title: v })} />
          </View>
          <View style={{ width: isPhone ? undefined : 240, zIndex: 20 }}><TypeMenu question={question} /></View>
        </View>
        {question.showDescription ? <GLineInput quiet autoGrow fontSize={13} placeholder="Description" value={question.description} onChangeText={(v) => a.updateQuestion(question.id, { description: v })} /> : null}
        {question.showImage ? <QuestionImage question={question} /> : null}
        <QuestionBody question={question} />
        {quiz && def?.usesTextAnswerKey ? <AnswerKey question={question} /> : null}

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 4, borderTopWidth: 1, borderTopColor: g.border, paddingTop: 8, zIndex: more ? 60 : 1 }}>
          {quiz && def?.isGradable ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginRight: 8 }}><GText size={13} secondary>Points</GText><View style={{ width: 52 }}><GLineInput keyboardType="numeric" accessibilityLabel="Points" value={String(question.points ?? 1)} onChangeText={(v) => a.updateQuestion(question.id, { points: Math.max(0, Number(v.replace(/\D/g, "")) || 0) })} /></View></View> : null}
          <GIconButton label="Duplicate" onPress={() => a.duplicateQuestion(question.id)}><Copy size={20} color={g.textSecondary} /></GIconButton>
          <GIconButton label="Delete" onPress={remove}><Trash2 size={20} color={g.textSecondary} /></GIconButton>
          <View style={{ width: 1, height: 32, backgroundColor: g.border, marginHorizontal: 8 }} />
          <Toggle label="Required" checked={question.required} onChange={(v) => a.updateQuestion(question.id, { required: v })} />
          <View>
            <GIconButton label="More options" onPress={() => setMore((v) => !v)}><MoreVertical size={20} color={g.textSecondary} /></GIconButton>
            <PopMenu open={more} onClose={() => setMore(false)} align="right" width={290}>
              <GText size={12} secondary style={{ paddingHorizontal: 16, paddingBottom: 4 }}>Show</GText>
              <MenuItem icon={<AlignLeft size={18} color={g.textSecondary} />} label="Description" active={question.showDescription} onPress={() => { a.updateQuestion(question.id, { showDescription: !question.showDescription }); setMore(false); }} />
              <MenuItem icon={<ImagePlus size={18} color={g.textSecondary} />} label="Image" active={question.showImage} onPress={() => { a.updateQuestion(question.id, { showImage: !question.showImage }); setMore(false); }} />
              {supportsAnswerNavigation(question.type) ? <MenuItem icon={<Split size={18} color={g.textSecondary} />} label="Go to section based on answer" active={Array.isArray(question.navigation?.options)} onPress={() => { a.setAnswerNavigation(question.id, !Array.isArray(question.navigation?.options)); setMore(false); }} /> : null}
              {Platform.OS !== "web" ? <>
                <View style={{ height: 1, backgroundColor: g.border, marginVertical: 6 }} />
                <MenuItem icon={<ArrowUp size={18} color={g.textSecondary} />} label="Move up" disabled={isFirst} onPress={() => { a.moveQuestion(question.id, -1); setMore(false); }} />
                <MenuItem icon={<ArrowDown size={18} color={g.textSecondary} />} label="Move down" disabled={isLast} onPress={() => { a.moveQuestion(question.id, 1); setMore(false); }} />
              </> : null}
            </PopMenu>
          </View>
        </View>
      </View>
      <ConfirmDialog visible={confirmDelete} title="Delete this question?" message="This question and its answer settings will be removed from the form." confirmLabel="Delete question" destructive onCancel={() => setConfirmDelete(false)} onConfirm={() => { setConfirmDelete(false); a.deleteQuestion(question.id); }} />
    </CardFrame>
  );
}

export const QuestionCard = memo(QuestionCardImpl);

function SectionCardImpl({ section, number, total, isFirst, isLast }: { section: Question; number: number; total: number; isFirst: boolean; isLast: boolean }) {
  const g = useGF();
  const { selectedId, setSelectedId } = useEditorSelection();
  const selected = selectedId === section.id;
  const a = useFormActions();
  const questions = useFormStore((s) => s.questions);
  const targetLabel = useTargetLabel();
  // A section holding an answer-based question is steered by that answer, so "After section" is moot.
  const answerDriven = useMemo(() => {
    for (let j = questions.findIndex((q) => q.id === section.id) + 1; j < questions.length && questions[j].type !== "section"; j++) if (hasAnswerNavigation(questions[j])) return true;
    return false;
  }, [questions, section.id]);
  const next = section.navigation?.next;
  return (
    <CardFrame id={section.id} selected={selected} onSelect={() => setSelectedId(section.id)}>
      <View style={{ position: "absolute", top: -1, left: -1, zIndex: 2, backgroundColor: g.accent, borderTopLeftRadius: 8, borderBottomRightRadius: 8, paddingHorizontal: 12, paddingVertical: 4, flexDirection: "row", gap: 6, alignItems: "center" }}>
        <SectionIcon size={14} color={g.accentText} /><GText size={12} weight="500" color={g.accentText}>Section {number} of {total}</GText>
      </View>
      <View style={{ height: 10, backgroundColor: g.accent, borderTopLeftRadius: 7, borderTopRightRadius: 7 }} />
      {selected && Platform.OS === "web" ? <View style={{ position: "absolute", top: 10, left: 0, right: 0, zIndex: 3 }}><DragHandle id={section.id} top={2} /></View> : null}
      <View style={{ padding: 24, paddingTop: 32, gap: 8 }}>
        <GLineInput quiet={!selected} fontSize={22} placeholder="Untitled section" value={section.title} onFocus={() => setSelectedId(section.id)} onChangeText={(v) => a.updateQuestion(section.id, { title: v })} />
        <GLineInput quiet={!selected} autoGrow fontSize={14} placeholder="Description (optional)" value={section.description} onFocus={() => setSelectedId(section.id)} onChangeText={(v) => a.updateQuestion(section.id, { description: v })} />
        {selected ? (
          <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: g.border, paddingTop: 12, marginTop: 8 }}>
            <GText size={13} weight="500">After section {number}</GText>
            {answerDriven
              ? <GText size={12} secondary>This section has a question that goes to a section based on the answer, so that answer decides where respondents go next.</GText>
              : <View style={{ maxWidth: 320 }}><TargetSelect fromId={section.id} value={next} onChange={(t) => a.setSectionNext(section.id, t)} /></View>}
          </View>
        ) : !answerDriven && next ? <GText size={12} color={g.accent}>After section {number}: {targetLabel(next)}</GText> : null}
        {selected ? (
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 4, borderTopWidth: 1, borderTopColor: g.border, paddingTop: 8, marginTop: 8 }}>
            {Platform.OS !== "web" ? <>
              <GIconButton label="Move section up" disabled={isFirst} onPress={() => a.moveQuestion(section.id, -1)}><ArrowUp size={20} color={g.textSecondary} /></GIconButton>
              <GIconButton label="Move section down" disabled={isLast} onPress={() => a.moveQuestion(section.id, 1)}><ArrowDown size={20} color={g.textSecondary} /></GIconButton>
            </> : null}
            <GIconButton label="Duplicate section" onPress={() => a.duplicateQuestion(section.id)}><Copy size={20} color={g.textSecondary} /></GIconButton>
            <GIconButton label="Delete section" onPress={() => a.deleteQuestion(section.id)}><Trash2 size={20} color={g.textSecondary} /></GIconButton>
          </View>
        ) : null}
      </View>
    </CardFrame>
  );
}

export const SectionCard = memo(SectionCardImpl);

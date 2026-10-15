import { memo, useState } from "react";
import { Image, View } from "react-native";
import { ArrowDown, ArrowUp, Copy, ImagePlus, Trash2, X } from "lucide-react-native";
import { Button, IconButton, InlineInput, Notice, Select, Surface, Switch, Text, TextField, space, useLayout, useTheme } from "../../ui";
import { Icon } from "../../ui";
import { QUESTION_TYPES, getQuestionType, useFormActions, type Question } from "../../lib/formStore";
import { SectionIcon } from "../../lib/questionIcons";
import { pickImageDataUri } from "../../lib/platform";
import { MatrixEditor, OptionList, ScaleEditor } from "./OptionEditors";

const SIMPLE_PREVIEWS: Record<string, string> = {
  short_answer: "Short answer text",
  paragraph: "Long answer text",
  date: "Month, day, year",
  time: "Time",
  file_upload: "Respondents will be able to attach a file here",
};

function QuestionBody({ question }: { question: Question }) {
  const { colors } = useTheme();
  switch (question.type) {
    case "multiple_choice": return <OptionList question={question} variant="radio" />;
    case "checkboxes": return <OptionList question={question} variant="checkbox" />;
    case "dropdown": return <OptionList question={question} variant="numbered" />;
    case "linear_scale": return <ScaleEditor question={question} />;
    case "matrix":
    case "matrix_checkbox": return <MatrixEditor question={question} />;
    default:
      return (
        <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, borderStyle: "dashed", paddingVertical: space[2] }}>
          <Text tone="tertiary">{SIMPLE_PREVIEWS[question.type] ?? ""}</Text>
        </View>
      );
  }
}

/** Acceptable free-text answers for auto-grading short answer and paragraph questions. */
function AnswerKey({ question }: { question: Question }) {
  const { addCorrectAnswerVariation, removeCorrectAnswerVariation } = useFormActions();
  const [draft, setDraft] = useState("");
  const { colors } = useTheme();
  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    addCorrectAnswerVariation(question.id, v);
    setDraft("");
  };
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="label">Acceptable answers</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {question.correctAnswers.map((ans, i) => (
          <View key={`${ans}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: colors.successSoft, borderRadius: 999, paddingLeft: space[3] }}>
            <Text variant="small" tone="success">{ans}</Text>
            <IconButton icon={X} label={`Remove answer ${ans}`} onPress={() => removeCorrectAnswerVariation(question.id, i)} />
          </View>
        ))}
      </View>
      <TextField value={draft} onChangeText={setDraft} onSubmitEditing={commit} onBlur={commit} placeholder={question.correctAnswers.length ? "Add another…" : "e.g. Paris, paris, PARIS (press Enter)"} />
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
    <View style={{ gap: space[2] }}>
      {question.imageUrl ? <Image source={{ uri: question.imageUrl }} accessibilityLabel={question.title || "Question image"} resizeMode="contain" style={{ width: "100%", height: 200 }} /> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <Button label={question.imageUrl ? "Replace image" : "Upload an image"} icon={ImagePlus} compact onPress={choose} />
        {question.imageUrl ? <Button label="Remove" variant="ghost" compact onPress={() => updateQuestion(question.id, { imageUrl: null })} /> : null}
      </View>
    </View>
  );
}

interface QuestionCardProps { question: Question; index: number; isFirst: boolean; isLast: boolean }

function QuestionCardImpl({ question, index, isFirst, isLast }: QuestionCardProps) {
  const { colors } = useTheme();
  const { isPhone } = useLayout();
  const a = useFormActions();
  const def = getQuestionType(question.type);
  const typeOptions = QUESTION_TYPES.map((t) => ({ value: t.id, label: t.label }));

  return (
    <View nativeID={`question-${question.id}`}>
      <Surface style={{ gap: space[3] }}>
        <View style={{ flexDirection: isPhone ? "column" : "row", alignItems: isPhone ? "stretch" : "flex-start", gap: space[3] }}>
          <View style={{ flex: 1, flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
            <View style={{ minWidth: 24, height: 24, borderRadius: 6, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center", marginTop: 4 }}>
              <Text variant="caption" tone="secondary">{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <InlineInput variant="title" placeholder="Question" value={question.title} onChangeText={(v) => a.updateQuestion(question.id, { title: v })} autoGrow />
            </View>
          </View>
          <View style={{ width: isPhone ? undefined : 200 }}>
            <Select value={question.type} options={typeOptions} onChange={(t) => a.changeQuestionType(question.id, t)} label={isPhone ? "Question type" : undefined} />
          </View>
        </View>

        {question.showDescription ? (
          <InlineInput placeholder="Description" value={question.description} onChangeText={(v) => a.updateQuestion(question.id, { description: v })} autoGrow />
        ) : null}
        {question.showImage ? <QuestionImage question={question} /> : null}

        <QuestionBody question={question} />

        {def?.usesTextAnswerKey ? <AnswerKey question={question} /> : null}

        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space[1], borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space[2] }}>
          <IconButton icon={ArrowUp} label="Move question up" disabled={isFirst} onPress={() => a.moveQuestion(question.id, -1)} />
          <IconButton icon={ArrowDown} label="Move question down" disabled={isLast} onPress={() => a.moveQuestion(question.id, 1)} />
          <IconButton icon={ImagePlus} label={question.showImage ? "Remove image" : "Add image"} onPress={() => a.updateQuestion(question.id, { showImage: !question.showImage })} />
          <IconButton icon={Copy} label="Duplicate question" onPress={() => a.duplicateQuestion(question.id)} />
          <IconButton icon={Trash2} label="Delete question" tone="danger" onPress={() => a.deleteQuestion(question.id)} />
          <Button label={question.showDescription ? "Remove description" : "Add description"} variant="ghost" compact onPress={() => a.updateQuestion(question.id, { showDescription: !question.showDescription })} />
          <View style={{ flex: 1 }} />
          {def?.isGradable ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], width: 110 }}>
              <Text variant="small" tone="secondary">Points</Text>
              <View style={{ width: 52 }}>
                <TextField value={String(question.points ?? 1)} keyboardType="numeric" accessibilityLabel="Points" onChangeText={(v) => a.updateQuestion(question.id, { points: Math.max(0, Number(v.replace(/\D/g, "")) || 0) })} />
              </View>
            </View>
          ) : null}
          <Switch label="Required" checked={question.required} onChange={(v) => a.updateQuestion(question.id, { required: v })} />
        </View>
      </Surface>
    </View>
  );
}

export const QuestionCard = memo(QuestionCardImpl);

function SectionCardImpl({ section, isFirst, isLast }: { section: Question; isFirst: boolean; isLast: boolean }) {
  const { colors } = useTheme();
  const a = useFormActions();
  return (
    <View nativeID={`question-${section.id}`}>
      <Surface style={{ gap: space[2], borderLeftWidth: 3, borderLeftColor: colors.accent }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Icon icon={SectionIcon} size={16} color={colors.accent} />
          <Text variant="label" tone="accent">Section</Text>
        </View>
        <InlineInput variant="title" placeholder="Section title" value={section.title} onChangeText={(v) => a.updateQuestion(section.id, { title: v })} />
        <InlineInput placeholder="Description (optional)" value={section.description} onChangeText={(v) => a.updateQuestion(section.id, { description: v })} autoGrow />
        <View style={{ flexDirection: "row", gap: space[1] }}>
          <IconButton icon={ArrowUp} label="Move section up" disabled={isFirst} onPress={() => a.moveQuestion(section.id, -1)} />
          <IconButton icon={ArrowDown} label="Move section down" disabled={isLast} onPress={() => a.moveQuestion(section.id, 1)} />
          <IconButton icon={Copy} label="Duplicate section" onPress={() => a.duplicateQuestion(section.id)} />
          <IconButton icon={Trash2} label="Delete section" tone="danger" onPress={() => a.deleteQuestion(section.id)} />
        </View>
      </Surface>
    </View>
  );
}

export const SectionCard = memo(SectionCardImpl);

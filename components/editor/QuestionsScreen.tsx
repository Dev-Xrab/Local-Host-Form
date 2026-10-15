import { useState } from "react";
import { View } from "react-native";
import { Plus } from "lucide-react-native";
import { Button, Dialog, Page, Text, space } from "../../ui";
import { useFormStore } from "../../lib/formStore";
import { FormHeader } from "./FormHeader";
import { QuestionCard, SectionCard } from "./QuestionCard";
import { AddQuestionPalette } from "./FormShell";
import { PreviewPager } from "../respond/PreviewPager";

export function QuestionsScreen() {
  const questions = useFormStore((s) => s.questions);
  const mode = useFormStore((s) => s.mode);
  const [adding, setAdding] = useState(false);

  if (mode === "view") return <PreviewPager />;

  // Numbering skips sections, so it's computed once up front rather than mutated during render.
  let n = 0;
  const numbers = questions.map((q) => (q.type === "section" ? 0 : ++n));

  return (
    <Page maxWidth={760}>
      <FormHeader />
      <View style={{ gap: space[3] }}>
        {questions.map((q, i) =>
          q.type === "section" ? (
            <SectionCard key={q.id} section={q} isFirst={i === 0} isLast={i === questions.length - 1} />
          ) : (
            <QuestionCard key={q.id} question={q} index={numbers[i] - 1} isFirst={i === 0} isLast={i === questions.length - 1} />
          )
        )}
      </View>
      <Button label="Add question" icon={Plus} onPress={() => setAdding(true)} fullWidth />
      <Dialog visible={adding} title="Add question" onClose={() => setAdding(false)}>
        <AddQuestionPalette columns={2} onAdded={() => setAdding(false)} />
      </Dialog>
      {questions.length === 0 ? <Text tone="secondary" align="center">Add your first question with the button above.</Text> : null}
    </Page>
  );
}

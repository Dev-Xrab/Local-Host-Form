import { useCallback } from "react";
import { Platform, View } from "react-native";
import { ImagePlus, PlusCircle, Rows3 } from "lucide-react-native";
import { GIconButton, useGF } from "../../ui/gforms";
import { useFormActions, useFormStore } from "../../lib/formStore";
import { useEditorSelection } from "./EditorSelection";

// Brings a freshly added card into view and puts the cursor in its title, so typing can start at once.
function scrollToItem(id: string) {
  if (Platform.OS !== "web") return;
  setTimeout(() => {
    const card = document.getElementById(`question-${id}`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.querySelector<HTMLElement>("input, textarea")?.focus({ preventScroll: true });
  }, 80);
}

/** Google Forms' floating toolbar: rides beside the active card on wide screens, docks to the bottom on narrow ones. */
export function FloatingToolbar({ horizontal, targetId }: { horizontal?: boolean; targetId?: string | null }) {
  const g = useGF();
  const { selectedId, setSelectedId } = useEditorSelection();
  const questions = useFormStore((s) => s.questions);
  const { addQuestion, addSection, updateQuestion } = useFormActions();
  // `targetId` is the card the toolbar is currently beside (it follows the scroll); otherwise the selected one.
  const anchorId = targetId ?? selectedId;
  const target = questions.find((q) => q.id === anchorId);
  const after = anchorId === "form-header" ? "form-header" : target?.id ?? null;
  const add = useCallback(() => { const id = addQuestion("multiple_choice", after); if (id) { setSelectedId(id); scrollToItem(id); } }, [addQuestion, after, setSelectedId]);
  const section = useCallback(() => { const id = addSection(after); if (id) { setSelectedId(id); scrollToItem(id); } }, [addSection, after, setSelectedId]);
  const image = useCallback(() => {
    if (target && target.type !== "section") updateQuestion(target.id, { showImage: true });
    else setSelectedId("form-header");
  }, [target, updateQuestion, setSelectedId]);
  const items = [
    { label: "Add question", icon: PlusCircle, onPress: add },
    { label: target && target.type !== "section" ? "Add image to question" : "Add image", icon: ImagePlus, onPress: image },
    { label: "Add section", icon: Rows3, onPress: section },
  ];
  return (
    <View accessibilityRole="toolbar" style={{ flexDirection: horizontal ? "row" : "column", alignItems: "center", gap: 0, padding: 4, backgroundColor: g.card, borderRadius: horizontal ? 28 : 8, borderWidth: 1, borderColor: g.border, boxShadow: g.shadow } as object}>
      {items.map((it) => <GIconButton key={it.label} label={it.label} onPress={it.onPress}><it.icon size={22} color={g.textSecondary} /></GIconButton>)}
    </View>
  );
}


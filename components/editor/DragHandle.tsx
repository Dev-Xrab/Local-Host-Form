import { useEffect, useRef } from "react";
import { Platform, View } from "react-native";
import { GripHorizontal } from "lucide-react-native";
import { useGF } from "../../ui/gforms";
import { useFormActions, useFormStore } from "../../lib/formStore";
import { startDrag } from "./dragReorder";

/** The grip at the top of a selected card: press and drag it to move the card (or a whole section). Web only. */
export function DragHandle({ id, top = 4 }: { id: string; top?: number }) {
  const g = useGF();
  const ref = useRef<View>(null);
  const { moveItem } = useFormActions();

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const el = ref.current as unknown as HTMLElement | null;
    if (!el) return;
    const down = (e: PointerEvent) => {
      const items = useFormStore.getState().questions.map((q) => ({ id: q.id, isSection: q.type === "section" }));
      startDrag(e, items, id, moveItem);
    };
    el.addEventListener("pointerdown", down);
    return () => el.removeEventListener("pointerdown", down);
  }, [id, moveItem]);

  if (Platform.OS !== "web") return null;
  return (
    <View ref={ref} accessibilityRole="button" accessibilityLabel="Drag to reorder" accessibilityHint="Press and drag to move this item"
      style={{ alignItems: "center", alignSelf: "stretch", paddingTop: top, paddingBottom: 2, cursor: "grab", touchAction: "none", userSelect: "none" } as object}>
      <View style={{ opacity: 0.55 }}><GripHorizontal size={18} color={g.textSecondary} /></View>
    </View>
  );
}

import { useEffect, useRef, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { useLayout } from "../../ui";
import { GText, useGF } from "../../ui/gforms";
import { useFormActions, useFormStore } from "../../lib/formStore";
import { FormHeader } from "./FormHeader";
import { QuestionCard, SectionCard } from "./QuestionCard";
import { FloatingToolbar } from "./FloatingToolbar";
import { PreviewPager } from "../respond/PreviewPager";
import { useEditorSelection } from "./EditorSelection";

const TOOLBAR_HEIGHT = 140;
const TOP_GAP = 12;

function scrollParentOf(el: HTMLElement): HTMLElement {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
  }
  return document.scrollingElement as HTMLElement;
}

/**
 * Where the side toolbar sits: beside whichever card is in focus. Selecting a card pins the toolbar to
 * it; as soon as the page scrolls, it moves on to the card at the middle of the screen, so the
 * "add" buttons are always next to what you are looking at. Measured from the DOM on web.
 */
function useToolbarDock(columnRef: React.RefObject<View | null>, enabled: boolean, selectedId: string | null, itemCount: number) {
  const [dock, setDock] = useState<{ id: string | null; top: number }>({ id: null, top: 0 });
  const pinned = useRef<string | null>(null);
  const compute = useRef<() => void>(() => {});

  // Selecting a card (or the form header) pins the toolbar to it until the next scroll.
  useEffect(() => { pinned.current = selectedId; compute.current(); }, [selectedId]);

  useEffect(() => {
    const col = columnRef.current as unknown as HTMLElement | null;
    if (Platform.OS !== "web" || !enabled || !col) return;
    const scroller = scrollParentOf(col);
    const target: EventTarget = scroller === document.scrollingElement ? window : scroller;
    let raf = 0;
    let lastScroll = scroller.scrollTop;

    const run = () => {
      raf = 0;
      const view = scroller === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
      const colTop = col.getBoundingClientRect().top;
      const cards = Array.from(col.querySelectorAll<HTMLElement>("[id^=\"question-\"]"));
      if (!cards.length) return;
      const mid = (view.top + view.bottom) / 2;
      const byId = (id: string | null) => cards.find((c) => c.id === `question-${id}`);
      let card = pinned.current ? byId(pinned.current) : undefined;
      if (!card) {
        card = cards.find((c) => { const r = c.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid; });
        if (!card) card = cards.reduce((best, c) => { const r = c.getBoundingClientRect(); const b = best.getBoundingClientRect(); return Math.abs((r.top + r.bottom) / 2 - mid) < Math.abs((b.top + b.bottom) / 2 - mid) ? c : best; });
      }
      const r = card.getBoundingClientRect();
      // Level with the card, but never above the visible area or below the card's own bottom edge.
      const wanted = Math.min(Math.max(r.top, view.top + TOP_GAP), Math.max(r.top, r.bottom - TOOLBAR_HEIGHT));
      const next = { id: card.id.replace("question-", ""), top: Math.round(wanted - colTop) };
      setDock((d) => (d.id === next.id && d.top === next.top ? d : next));
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(run); };
    const onScroll = () => {
      if (Math.abs(scroller.scrollTop - lastScroll) > 2) pinned.current = null; // scrolling hands control back to the screen
      lastScroll = scroller.scrollTop;
      schedule();
    };
    compute.current = schedule;
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule);
    // Cards change height as they open and close, so re-measure on any layout change inside the column.
    const observer = new ResizeObserver(schedule);
    observer.observe(col);
    schedule();
    return () => {
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      cancelAnimationFrame(raf);
      compute.current = () => {};
    };
  }, [columnRef, enabled, itemCount]);

  return dock;
}

export function QuestionsScreen() {
  const g = useGF();
  const { width } = useLayout();
  const side = width >= 940;
  const questions = useFormStore((s) => s.questions);
  const mode = useFormStore((s) => s.mode);
  const { selectedId } = useEditorSelection();
  const columnRef = useRef<View>(null);
  const dock = useToolbarDock(columnRef, side && mode !== "view", selectedId, questions.length);

  if (mode === "view") return <PreviewPager />;

  // Numbering skips sections, so it's computed once up front rather than mutated during render.
  let n = 0;
  const numbers = questions.map((q) => (q.type === "section" ? 0 : ++n));
  const sectionIdx = questions.map((q, i) => questions.slice(0, i).filter((x) => x.type === "section").length);
  const sectionTotal = questions.filter((q) => q.type === "section").length + (questions[0]?.type === "section" ? 0 : 1);
  const firstIsSection = questions[0]?.type === "section";

  return (
    <View style={{ flex: 1, backgroundColor: g.canvas }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ alignItems: "center", paddingTop: 12, paddingBottom: side ? 120 : 140, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
        <View ref={columnRef} style={{ width: "100%", maxWidth: 770, gap: 12, position: "relative" }}>
          {side ? (
            // Follows the scroll: see useToolbarDock. Pointer events pass through everywhere but the buttons.
            <View pointerEvents="box-none" style={{ position: "absolute", right: -68, top: dock.top, zIndex: 6, ...(Platform.OS === "web" ? { transition: "top 140ms ease-out" } : null) } as object}>
              <FloatingToolbar targetId={dock.id} />
            </View>
          ) : null}
          <FormHeader />
          {questions.map((q, i) =>
            q.type === "section" ? (
              <SectionCard key={q.id} section={q} number={sectionIdx[i] + (firstIsSection ? 1 : 2)} total={sectionTotal} isFirst={i === 0} isLast={i === questions.length - 1} />
            ) : (
              <QuestionCard key={q.id} question={q} index={numbers[i] - 1} isFirst={i === 0} isLast={i === questions.length - 1} />
            )
          )}
          {questions.length === 0 ? <GText secondary style={{ textAlign: "center", padding: 24 }}>No questions yet. Use the + button to add your first question.</GText> : null}
        </View>
      </ScrollView>
      {!side ? <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 16, alignItems: "center" }}><FloatingToolbar horizontal /></View> : null}
    </View>
  );
}

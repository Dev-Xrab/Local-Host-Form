import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { createPortal } from "react-dom";
import { getQuestionType } from "../../src/lib/questionTypes";
import { QUESTION_ICONS } from "../../lib/questionIcons";
import { Icon, Text, radius, space, useTheme } from "../../ui";

export interface PreviewTemplate { title: string; description?: string; accent: string; questions: unknown[] }
interface PreviewQuestion { type: string; title?: string; required?: boolean; options?: string[]; scale?: { min: number; max: number; minLabel?: string; maxLabel?: string } }
interface Rect { x: number; y: number; w: number; h: number }
export interface HoverHandlers { ref: RefObject<View | null>; onHoverIn: () => void; onHoverOut: () => void }

const WIDTH = 320;
const MAX_OPTIONS = 4;
const SHOW_DELAY_MS = 220;
const HIDE_DELAY_MS = 220; // grace period to cross the gap from the tile onto the popup

function MiniQuestion({ q, n }: { q: PreviewQuestion; n: number }) {
  const { colors } = useTheme();
  const meta = getQuestionType(q.type);
  const optionBased = !!meta?.isOptionBased;
  const round = q.type === "multiple_choice" || q.type === "dropdown";
  const options = q.options || [];
  return (
    <View style={{ gap: 6, paddingVertical: space[2], borderTopWidth: n === 1 ? 0 : 1, borderTopColor: colors.border }}>
      <View style={{ flexDirection: "row", gap: space[2], alignItems: "flex-start" }}>
        <Text variant="caption" tone="tertiary" style={{ width: 14 }}>{n}</Text>
        <Text variant="small" style={{ flex: 1, fontWeight: "500" }} numberOfLines={2}>{q.title || "Untitled question"}{q.required ? <Text variant="small" tone="danger"> *</Text> : null}</Text>
        {meta ? <Icon icon={QUESTION_ICONS[meta.icon]} size={13} color={colors.textTertiary} /> : null}
      </View>
      <View style={{ paddingLeft: 22, gap: 4 }}>
        {optionBased ? (
          <>
            {options.slice(0, MAX_OPTIONS).map((o, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 10, height: 10, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: round ? 5 : 2 }} />
                <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1, fontWeight: "400" }}>{o}</Text>
              </View>
            ))}
            {options.length > MAX_OPTIONS ? <Text variant="caption" tone="tertiary" style={{ fontWeight: "400" }}>+{options.length - MAX_OPTIONS} more</Text> : null}
          </>
        ) : q.type === "linear_scale" ? (
          <Text variant="caption" tone="secondary" style={{ fontWeight: "400" }}>{q.scale?.min ?? 1}{q.scale?.minLabel ? ` (${q.scale.minLabel})` : ""} to {q.scale?.max ?? 5}{q.scale?.maxLabel ? ` (${q.scale.maxLabel})` : ""}</Text>
        ) : (
          <View style={{ height: q.type === "paragraph" ? 26 : 14, borderBottomWidth: 1, borderBottomColor: colors.borderStrong, opacity: 0.7 }} />
        )}
      </View>
    </View>
  );
}

function Card({ t, rect, onHoverIn, onHoverOut }: { t: PreviewTemplate; rect: Rect; onHoverIn: () => void; onHoverOut: () => void }) {
  const { colors } = useTheme();
  const questions = t.questions as PreviewQuestion[];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(8, Math.min(rect.x, vw - WIDTH - 8));
  // Opens below the tile; flips above when the lower half of the window is the roomier side.
  const below = rect.y + rect.h + 12 + 380 < vh || rect.y < vh / 2;
  const pos = below ? { top: rect.y + rect.h + 8 } : { bottom: vh - rect.y + 8 };
  return (
    <Pressable
      accessible={false}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[
        { position: "fixed", left, width: WIDTH, zIndex: 100000, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg, overflow: "hidden", maxHeight: 420, cursor: "default", boxShadow: "0 18px 48px rgba(0,0,0,0.35)" } as object,
        pos,
      ]}
    >
      <View style={{ height: 6, backgroundColor: t.accent }} />
      <ScrollView style={{ maxHeight: 414 }} contentContainerStyle={{ padding: space[3], gap: space[2] }} showsVerticalScrollIndicator>
        <View style={{ gap: 2 }}>
          <Text variant="title" numberOfLines={1}>{t.title}</Text>
          {t.description ? <Text variant="small" tone="secondary" numberOfLines={2}>{t.description}</Text> : null}
          <Text variant="caption" tone="tertiary">{questions.length} question{questions.length === 1 ? "" : "s"} · preview</Text>
        </View>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space[3], backgroundColor: colors.bg }}>
          {questions.map((q, i) => <MiniQuestion key={i} q={q} n={i + 1} />)}
        </View>
      </ScrollView>
    </Pressable>
  );
}

/**
 * Wraps a template tile: hovering it for a moment pops up a miniature of the form (every question
 * with its answer shape). The popup stays open while the pointer is over it and scrolls when the
 * form is long. Web only, since hover needs a pointer; it is drawn in a portal so the gallery's
 * scroll areas and dialogs can't clip it.
 */
export function TemplatePreview({ template, children }: { template: PreviewTemplate; children: (h: HoverHandlers) => ReactNode }) {
  const ref = useRef<View>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => clear, []);

  const onHoverIn = () => {
    if (Platform.OS !== "web") return;
    clear();
    // Already open (pointer came back from the popup): just keep it.
    if (rect) return;
    timer.current = setTimeout(() => ref.current?.measureInWindow((x, y, w, h) => setRect({ x, y, w, h })), SHOW_DELAY_MS);
  };
  const onHoverOut = () => { clear(); timer.current = setTimeout(() => setRect(null), HIDE_DELAY_MS); };

  return (
    <>
      {children({ ref, onHoverIn, onHoverOut })}
      {rect && Platform.OS === "web" ? createPortal(<Card t={template} rect={rect} onHoverIn={clear} onHoverOut={onHoverOut} />, document.body) : null}
    </>
  );
}

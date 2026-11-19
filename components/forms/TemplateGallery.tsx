import { useState } from "react";
import { Pressable, View } from "react-native";
import { LayoutTemplate, Plus } from "lucide-react-native";
import { TEMPLATE_CATEGORIES } from "../../src/features/forms/data/templates";
import { TemplatePreview, type HoverHandlers } from "./TemplatePreview";
import { Dialog, Notice, Text, space } from "../../ui";
import { GButton, GText, useGF } from "../../ui/gforms";

interface Template { id: string; title: string; description?: string; accent: string; questions: unknown[] }
interface Category { id: string; name: string; templates: Template[] }
const CATEGORIES = TEMPLATE_CATEGORIES as Category[];
const FEATURED = CATEGORIES[0];

function Tile({ title, blank, busy, onPress, template }: { title: string; description?: string; accent?: string; blank?: boolean; busy?: boolean; onPress: () => void; template?: Template }) {
  const g = useGF();
  const description = template?.description;
  const tile = (hover?: HoverHandlers) => (
    <Pressable
      ref={hover?.ref as never}
      onHoverIn={hover?.onHoverIn}
      onHoverOut={hover?.onHoverOut}
      accessibilityRole="button"
      accessibilityLabel={description ? `${title}. ${description}` : title}
      disabled={busy}
      onPress={onPress}
      style={{ gap: 8, opacity: busy ? 0.6 : 1 }}
    >
      {(s) => (
        <>
          <View style={{ height: 104, borderRadius: 6, borderWidth: 1, borderColor: (s as { hovered?: boolean }).hovered ? g.accent : g.border, backgroundColor: g.card, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            {blank ? <Plus size={44} color={g.accent} strokeWidth={1.5} /> : (
              <View style={{ width: "100%", height: "100%" }}>
                <View style={{ height: 6, backgroundColor: g.accent }} />
                <View style={{ padding: 10, gap: 6 }}>
                  <View style={{ height: 8, width: "70%", borderRadius: 2, backgroundColor: g.border }} />
                  <View style={{ height: 5, width: "90%", borderRadius: 2, backgroundColor: g.cardAlt }} />
                  <View style={{ marginTop: 4, height: 24, borderRadius: 3, borderWidth: 1, borderColor: g.border }} />
                  <View style={{ height: 24, borderRadius: 3, borderWidth: 1, borderColor: g.border }} />
                </View>
              </View>
            )}
          </View>
          <GText size={14} weight="500" numberOfLines={1}>{busy ? "Creating…" : title}</GText>
        </>
      )}
    </Pressable>
  );
  return template ? <TemplatePreview template={template}>{(h) => tile(h)}</TemplatePreview> : tile();
}

/**
 * Two tiers, like Google Forms' own "Start a new form": one always-visible row (Blank plus a
 * handful of templates) and a dialog with the full set grouped by category. Picking a template
 * creates a real form through the existing import path (`onPick`).
 */
export function TemplateGallery({ onBlank, onPick }: { onBlank: () => void; onPick: (t: Template) => Promise<void> }) {
  const g = useGF();
  const [open, setOpen] = useState(false);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (t: Template) => {
    setCreatingId(t.id);
    setError(null);
    try {
      await onPick(t);
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreatingId(null);
    }
  };

  const tile = (t: Template) => <Tile key={t.id} template={t} title={t.title} description={t.description} accent={t.accent} busy={creatingId === t.id} onPress={() => pick(t)} />;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <GText size={16} weight="500" accessibilityRole="header">Start a new form</GText>
        <GButton label="Template gallery" icon={<LayoutTemplate size={16} color={g.accent} />} onPress={() => setOpen(true)} />
      </View>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <View style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16 } as object}>
        <Tile title="Blank form" blank onPress={onBlank} />
        {FEATURED.templates.slice(0, 5).map(tile)}
      </View>

      <Dialog visible={open} title="Template gallery" onClose={() => setOpen(false)} width={680}>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {CATEGORIES.map((c) => (
          <View key={c.id} style={{ gap: space[2] }}>
            <Text variant="label" tone="secondary">{c.name}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>{c.templates.map(tile)}</View>
          </View>
        ))}
      </Dialog>
    </View>
  );
}

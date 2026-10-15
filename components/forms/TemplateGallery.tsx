import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { LayoutTemplate, Plus } from "lucide-react-native";
import { TEMPLATE_CATEGORIES } from "../../src/features/forms/data/templates";
import { TemplatePreview, type HoverHandlers } from "./TemplatePreview";
import { Button, Dialog, Icon, Notice, Section, Text, radius, space, useTheme } from "../../ui";

interface Template { id: string; title: string; description?: string; accent: string; questions: unknown[] }
interface Category { id: string; name: string; templates: Template[] }
const CATEGORIES = TEMPLATE_CATEGORIES as Category[];
const FEATURED = CATEGORIES[0];

function Tile({ title, description, accent, blank, busy, onPress, template }: { title: string; description?: string; accent?: string; blank?: boolean; busy?: boolean; onPress: () => void; template?: Template }) {
  const { colors } = useTheme();
  const tile = (hover?: HoverHandlers) => (
    <Pressable
      ref={hover?.ref as never}
      onHoverIn={hover?.onHoverIn}
      onHoverOut={hover?.onHoverOut}
      accessibilityRole="button"
      accessibilityLabel={description ? `${title}. ${description}` : title}
      disabled={busy}
      onPress={onPress}
      style={(s) => ({
        width: 132, minHeight: 72, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
        backgroundColor: (s as { hovered?: boolean }).hovered ? colors.surfaceMuted : colors.surface, overflow: "hidden", opacity: busy ? 0.6 : 1,
      })}
    >
      {/* The accent band is the only decoration: it's the template's identity color, not ornament. */}
      <View style={{ height: 6, backgroundColor: blank ? colors.borderStrong : accent }} />
      <View style={{ padding: space[3], gap: 2, flex: 1, justifyContent: "center" }}>
        {blank ? <Icon icon={Plus} size={16} color={colors.text} /> : null}
        <Text variant="label" numberOfLines={2}>{busy ? "Creating…" : title}</Text>
      </View>
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
    <Section title="Start a new form">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2], paddingBottom: 2 }}>
        <Tile title="Blank form" blank onPress={onBlank} />
        {FEATURED.templates.map(tile)}
        <Button label="All templates" icon={LayoutTemplate} variant="ghost" onPress={() => setOpen(true)} style={{ alignSelf: "center" }} />
      </ScrollView>

      <Dialog visible={open} title="Template gallery" onClose={() => setOpen(false)} width={680}>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {CATEGORIES.map((c) => (
          <View key={c.id} style={{ gap: space[2] }}>
            <Text variant="label" tone="secondary">{c.name}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>{c.templates.map(tile)}</View>
          </View>
        ))}
      </Dialog>
    </Section>
  );
}

import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Check, ChevronDown } from "lucide-react-native";
import { radius, size, space } from "./tokens";
import { useTheme } from "./theme";
import { Text } from "./Text";
import { Icon } from "./Icon";
import { Dialog } from "./Dialog";
import { SearchField } from "./SearchField";
import { useFocusRing } from "./interactive";

export interface SearchOption { value: string; label: string; meta?: string }

/** Select with a search box, for long lists (forms, students). Opens a dialog, a bottom sheet on phones. */
export function SearchSelect({ label, value, options, onChange, placeholder = "Select…", searchPlaceholder = "Search", emptyText = "Nothing found." }: {
  label?: string; value: string | null; options: SearchOption[]; onChange: (v: string) => void; placeholder?: string; searchPlaceholder?: string; emptyText?: string;
}) {
  const { colors } = useTheme();
  const { ring, onFocus, onBlur } = useFocusRing(colors);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <View style={{ gap: space[1] + 2, alignSelf: "stretch" }}>
      {label ? <Text variant="label">{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${current?.label ?? placeholder}` : undefined}
        onPress={() => { setQuery(""); setOpen(true); }}
        onFocus={onFocus}
        onBlur={onBlur}
        style={[{ minHeight: size.control, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space[3], flexDirection: "row", alignItems: "center", gap: space[2], backgroundColor: colors.surface, borderColor: colors.borderStrong }, ring]}
      >
        <Text style={{ flex: 1 }} tone={current ? "default" : "tertiary"} numberOfLines={1}>{current?.label ?? placeholder}</Text>
        <Icon icon={ChevronDown} size={16} />
      </Pressable>
      <Dialog visible={open} title={label ?? "Select"} onClose={() => setOpen(false)} width={420}>
        <SearchField value={query} onChangeText={setQuery} placeholder={searchPlaceholder} />
        <View style={{ marginHorizontal: -space[2] }}>
          {shown.length === 0 ? <Text tone="secondary" align="center" style={{ padding: space[3] }}>{emptyText}</Text> : null}
          {shown.map((o) => (
            <Pressable key={o.value} accessibilityRole="menuitem" onPress={() => { onChange(o.value); setOpen(false); }} style={(s) => [{ minHeight: size.touch, flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[3], borderRadius: radius.sm }, (s as { hovered?: boolean }).hovered && { backgroundColor: colors.hover }]}>
              <Text style={{ flex: 1 }} numberOfLines={1}>{o.label}</Text>
              {o.meta ? <Text variant="small" tone="tertiary">{o.meta}</Text> : null}
              {o.value === value ? <Icon icon={Check} size={16} color={colors.text} /> : null}
            </Pressable>
          ))}
        </View>
      </Dialog>
    </View>
  );
}

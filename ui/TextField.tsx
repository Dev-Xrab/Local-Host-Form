import { forwardRef, useState, type ReactNode } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { fontFamily, radius, size, space } from "./tokens";
import { useTheme } from "./theme";
import { Text } from "./Text";

interface TextFieldProps extends Omit<TextInputProps, "style"> {
  label?: string;
  hint?: string;
  error?: string | null;
  rows?: number;
  /** Rendered inside the field's right edge (e.g. a show/hide toggle). */
  trailing?: ReactNode;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, trailing, multiline, rows = 3, onFocus, onBlur, editable = true, ...rest },
  ref
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.focus : colors.borderStrong;

  return (
    <View style={styles.wrap}>
      {label ? <Text variant="small" tone="secondary" style={{ fontWeight: "500" }}>{label}</Text> : null}
      <View>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.textTertiary}
        editable={editable}
        multiline={multiline}
        numberOfLines={multiline ? rows : 1}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        {...rest}
        style={[
          styles.input,
          { fontFamily, color: colors.text, backgroundColor: editable ? colors.surface : colors.surfaceMuted, borderColor, minHeight: multiline ? rows * 20 + 16 : size.control },
          multiline && { textAlignVertical: "top", paddingTop: 8 },
          trailing ? { paddingRight: 64 } : null,
          focused && ({ outlineStyle: "none", outlineWidth: 0, boxShadow: `0 0 0 3px ${colors.accentSoft}` } as object),
        ]}
      />
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {error ? <Text variant="small" tone="danger" accessibilityRole="alert">{error}</Text> : hint ? <Text variant="small" tone="tertiary">{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space[1] + 2, alignSelf: "stretch" },
  trailing: { position: "absolute", right: 4, top: 0, bottom: 0, justifyContent: "center" },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space[3], fontSize: 13, lineHeight: 18 },
});

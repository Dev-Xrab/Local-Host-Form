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
  autoGrow?: boolean;
  /** Rendered inside the field's right edge (e.g. a show/hide toggle). */
  trailing?: ReactNode;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, trailing, multiline, rows = 3, autoGrow = false, onFocus, onBlur, onContentSizeChange, editable = true, ...rest },
  ref
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const borderColor = error ? colors.danger : focused ? colors.focus : colors.borderStrong;

  return (
    <View style={styles.wrap}>
      {label ? <Text variant="label" tone="secondary">{label}</Text> : null}
      <View>
      <TextInput
        ref={ref}
        accessibilityLabel={rest.accessibilityLabel ?? label}
        placeholderTextColor={colors.textTertiary}
        editable={editable}
        multiline={multiline}
        numberOfLines={multiline ? rows : 1}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        onContentSizeChange={(event) => { if (autoGrow) setContentHeight(event.nativeEvent.contentSize.height); onContentSizeChange?.(event); }}
        {...rest}
        style={[
          styles.input,
          { fontFamily, color: colors.text, backgroundColor: editable ? colors.surface : colors.surfaceMuted, borderColor, minHeight: multiline ? rows * 20 + 16 : size.control, height: autoGrow && contentHeight ? Math.max(rows * 20 + 16, contentHeight + 16) : undefined },
          multiline && { textAlignVertical: "top", paddingTop: 8 },
          trailing ? { paddingRight: 64 } : null,
          focused && ({ outlineWidth: 2, outlineStyle: "solid", outlineColor: colors.focus, outlineOffset: 1 } as object),
        ]}
      />
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {error ? <Text variant="small" tone="danger" accessibilityRole="alert">{error}</Text> : hint ? <Text variant="small" tone="tertiary">{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space[2], alignSelf: "stretch" },
  trailing: { position: "absolute", right: 4, top: 0, bottom: 0, justifyContent: "center" },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space[3], fontSize: 15, lineHeight: 23 },
});

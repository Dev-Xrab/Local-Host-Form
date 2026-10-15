import { forwardRef, useState } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { fontFamily, type TypeVariant, type as scale } from "./tokens";
import { useTheme } from "./theme";

interface InlineInputProps extends Omit<TextInputProps, "style"> {
  variant?: TypeVariant;
  /** Grow with content instead of scrolling (for titles and descriptions). */
  autoGrow?: boolean;
}

/**
 * Borderless text that reads as plain content until focused, then shows an underline. Used for
 * titles and descriptions edited in place, where a boxed input would be heavy.
 */
export const InlineInput = forwardRef<TextInput, InlineInputProps>(function InlineInput(
  { variant = "body", autoGrow, multiline, editable = true, onFocus, onBlur, ...rest },
  ref
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const v = scale[variant];
  const grow = autoGrow || multiline;

  return (
    <TextInput
      ref={ref}
      accessibilityLabel={rest.placeholder}
      placeholderTextColor={colors.textTertiary}
      multiline={grow}
      scrollEnabled={grow ? false : undefined}
      numberOfLines={grow ? 1 : undefined}
      editable={editable}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      onContentSizeChange={grow ? (e) => setHeight(e.nativeEvent.contentSize.height) : undefined}
      {...rest}
      style={[
        {
          fontFamily, fontSize: v.fontSize, lineHeight: v.lineHeight, fontWeight: v.fontWeight as "400",
          color: colors.text, paddingVertical: 6, paddingHorizontal: 0,
          borderBottomWidth: 1, borderBottomColor: focused ? colors.focus : editable ? colors.border : "transparent",
          outlineStyle: "none", ...(grow ? { overflow: "hidden", resize: "none" } : null), ...(grow && height ? { height: Math.max(height, v.lineHeight + 12) } : null),
        } as object,
      ]}
    />
  );
});

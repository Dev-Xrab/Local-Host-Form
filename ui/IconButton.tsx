import { Pressable, type PressableProps } from "react-native";
import { radius, size } from "./tokens";
import { useTheme } from "./theme";
import { Icon, type IconComponent } from "./Icon";
import { useFocusRing } from "./interactive";

interface IconButtonProps extends Omit<PressableProps, "children" | "style"> {
  icon: IconComponent;
  /** Required: icon-only controls need an accessible name. */
  label: string;
  tone?: "default" | "danger";
}

export function IconButton({ icon, label, tone = "default", disabled, ...rest }: IconButtonProps) {
  const { colors } = useTheme();
  const { ring, onFocus, onBlur } = useFocusRing(colors);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={4}
      onFocus={onFocus}
      onBlur={onBlur}
      {...rest}
      style={(state) => [
        {
          width: size.touch - 4,
          height: size.touch - 4,
          borderRadius: radius.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: (state as { hovered?: boolean }).hovered || state.pressed ? colors.hover : "transparent",
          opacity: disabled ? 0.4 : 1,
        },
        ring,
      ]}
    >
      <Icon icon={icon} color={tone === "danger" ? colors.danger : colors.textSecondary} />
    </Pressable>
  );
}

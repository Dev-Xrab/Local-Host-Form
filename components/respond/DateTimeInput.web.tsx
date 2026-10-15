import { useTheme, size, radius } from "../../ui";

/** Browser-native date/time picker, styled to match TextField. */
export function DateTimeInput({ kind, value, onChange, disabled }: { kind: "date" | "time"; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <input
      type={kind}
      value={value}
      disabled={disabled}
      aria-label={kind === "date" ? "Date" : "Time"}
      onChange={(e) => onChange(e.target.value)}
      style={{
        height: size.control, boxSizing: "border-box", padding: "0 12px", font: "inherit", fontSize: 14, color: colors.text,
        background: colors.surface, border: `1px solid ${colors.borderStrong}`, borderRadius: radius.md, alignSelf: "flex-start", minWidth: 180, colorScheme: "light dark",
      }}
    />
  );
}

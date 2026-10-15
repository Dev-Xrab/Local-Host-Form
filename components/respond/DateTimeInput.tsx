import { TextField } from "../../ui";

/** Native fallback: a plain text field with a format hint. The web build uses the browser's date/time picker (DateTimeInput.web.tsx). */
export function DateTimeInput({ kind, value, onChange, disabled }: { kind: "date" | "time"; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <TextField
      value={value}
      onChangeText={onChange}
      editable={!disabled}
      placeholder={kind === "date" ? "YYYY-MM-DD" : "HH:MM"}
      keyboardType="numbers-and-punctuation"
      accessibilityLabel={kind === "date" ? "Date" : "Time"}
    />
  );
}

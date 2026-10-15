import { useState } from "react";
import { Pressable, View } from "react-native";
import { Download, FileText, Table2 } from "lucide-react-native";
import { Button, Checkbox, Dialog, Icon, Notice, Text, radius, space, useTheme } from "../../ui";
import { canExport } from "../../lib/exportSessions";

type Format = "excel" | "pdf";
const FORMATS: { id: Format; name: string; ext: string; icon: typeof Table2; desc: string }[] = [
  { id: "excel", name: "Excel workbook", ext: ".xlsx", icon: Table2, desc: "Editable spreadsheet: a results summary plus one answers sheet per session. Best for grading and analysis." },
  { id: "pdf", name: "PDF report", ext: ".pdf", icon: FileText, desc: "Print-ready report: overview, results tables and each respondent's answers. Best for sharing and records." },
];

/**
 * Asks Excel or PDF, then hands the choice to `onExport`. The caller does the actual fetching and
 * exporting; a thrown error is shown here and keeps the dialog open.
 */
export function ExportDialog({ visible, title = "Export results", summary, onClose, onExport }: {
  visible: boolean; title?: string; summary?: string; onClose: () => void; onExport: (format: Format, opts: { includeAnswers: boolean }) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [format, setFormat] = useState<Format>("excel");
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onExport(format, { includeAnswers });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      title={title}
      onClose={busy ? () => {} : onClose}
      footer={<><Button label="Cancel" variant="ghost" disabled={busy} onPress={onClose} /><Button label={`Export ${format === "pdf" ? "PDF" : "Excel"}`} icon={Download} variant="primary" disabled={!canExport} loading={busy} onPress={run} /></>}
    >
      {summary ? <Text tone="secondary">{summary}</Text> : null}
      {!canExport ? <Notice tone="warning">Exporting is available in the web and desktop apps.</Notice> : null}
      <View accessibilityRole="radiogroup" style={{ gap: space[2] }}>
        {FORMATS.map((f) => {
          const active = f.id === format;
          return (
            <Pressable key={f.id} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={() => setFormat(f.id)} style={{ flexDirection: "row", gap: space[3], padding: space[3], borderRadius: radius.md, borderWidth: 1.5, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.surfaceMuted : colors.surface }}>
              <Icon icon={f.icon} color={colors.text} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{f.name} <Text variant="small" tone="tertiary">{f.ext}</Text></Text>
                <Text variant="small" tone="secondary">{f.desc}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {format === "pdf" ? <Checkbox label="Include every respondent's answers (longer report)" checked={includeAnswers} onChange={setIncludeAnswers} /> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Dialog>
  );
}

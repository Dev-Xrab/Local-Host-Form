import { useEffect } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { ClipboardList, FileText, Folder } from "lucide-react-native";
import { Button, EmptyState, ListRow, Notice, Page, PageHeader, Section, Surface, Text, space, useLayout, useTheme } from "../../../ui";
import { useForms, useSessions, useSubjects } from "../../../lib/data";
import { ServerPanel } from "../../../components/ServerPanel";

// Fixed height so a long list scrolls inside its card instead of pushing the page down.
const LIST_HEIGHT = 300;

function Stat({ label, value, hint, onPress, last }: { label: string; value: number; hint?: string; onPress: () => void; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={(s) => [{ flexGrow: 1, flexBasis: 160, gap: 2, padding: space[4], borderRightWidth: last ? 0 : 1, borderRightColor: colors.border, backgroundColor: (s as { hovered?: boolean }).hovered ? colors.surfaceMuted : "transparent" }]}>
      <Text variant="caption" tone="tertiary" style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Text>
      <Text variant="display">{value}</Text>
      {hint ? <Text variant="small" tone="secondary">{hint}</Text> : null}
    </Pressable>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function DashboardHome() {
  const router = useRouter();
  const { isDesktop } = useLayout();
  const { forms, error: formsError } = useForms();
  const { subjects } = useSubjects();
  const { sessions, refresh } = useSessions();

  useEffect(() => {
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const active = sessions.filter((s) => s.status === "active");
  const connected = active.reduce((sum, s) => sum + s.inProgressCount, 0);
  const go = (href: string) => router.push(href as never);

  return (
    <Page>
      <PageHeader title="Dashboard" subtitle="Manage sessions, folders, and forms from one place." />
      {formsError ? <Notice tone="danger">{`Couldn't reach the local server: ${formsError}`}</Notice> : null}

      <Surface padded={false} style={{ flexDirection: "row", flexWrap: "wrap" }}>
        <Stat label="Live sessions" value={active.length} hint={`${connected} connected`} onPress={() => go("/dashboard/sessions")} />
        <Stat label="Forms" value={forms.length} onPress={() => go("/dashboard/forms")} />
        <Stat last label="Folders" value={subjects.length} onPress={() => go("/dashboard/subjects")} />
      </Surface>

      <ServerPanel />

      <View>
          <Section title="Live sessions" description={active.length === 0 ? "Nothing running right now" : `${plural(active.length, "session")} currently running`}>
            <Surface padded={false} style={{ height: LIST_HEIGHT }}>
              {active.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No live sessions" body="Start a session from a form to see it here while it's running." />
              ) : (
                <ScrollView showsVerticalScrollIndicator>
                {active.map((s, i) => (
                  <ListRow
                    key={s.id}
                    last={i === active.length - 1}
                    icon={ClipboardList}
                    title={s.name || "Untitled session"}
                    subtitle={`${s.code} · ${s.durationMinutes ? `${s.durationMinutes} min limit` : "No time limit"}`}
                    meta={`${s.submittedCount + s.inProgressCount} joined`}
                    onPress={() => go(`/dashboard/sessions/${s.id}`)}
                  />
                ))}
                </ScrollView>
              )}
            </Surface>
            <Button label="View all sessions" variant="ghost" compact style={{ marginLeft: -space[3] }} onPress={() => go("/dashboard/sessions")} />
          </Section>
      </View>

      <View style={{ flexDirection: isDesktop ? "row" : "column", gap: space[5], alignItems: "flex-start" }}>
        <View style={{ flex: 1, alignSelf: "stretch" }}>
          <Section title={`Recent forms · ${forms.length}`}>
            <Surface padded={false}>
              {forms.length === 0 ? (
                <EmptyState icon={FileText} title="No forms yet" body="Start one from a template or a blank form." actionLabel="Go to forms" onAction={() => go("/dashboard/forms")} />
              ) : (
                forms.slice(0, 6).map((f, i, arr) => (
                  <ListRow key={f.id} last={i === arr.length - 1} icon={FileText} title={f.title || "Untitled form"} meta={plural(f.questionCount, "question")} onPress={() => go(`/forms/${f.id}`)} />
                ))
              )}
            </Surface>
            {forms.length > 0 ? <Button label="All forms" variant="ghost" compact onPress={() => go("/dashboard/forms")} /> : null}
          </Section>
        </View>

        <View style={{ flex: 1, alignSelf: "stretch" }}>
          <Section title={`Folders · ${subjects.length}`}>
            <Surface padded={false}>
              {subjects.length === 0 ? (
                <EmptyState icon={Folder} title="No folders yet" body="Create one to start organizing your forms." actionLabel="Go to folders" onAction={() => go("/dashboard/subjects")} />
              ) : (
                subjects.slice(0, 5).map((s, i, arr) => (
                  <ListRow key={s.id} last={i === arr.length - 1} icon={Folder} title={s.name} subtitle={s.code || undefined} meta={plural(s.formCount, "form")} onPress={() => go(`/dashboard/subjects/${s.id}`)} />
                ))
              )}
            </Surface>
            {subjects.length > 0 ? <Button label="All folders" variant="ghost" compact onPress={() => go("/dashboard/subjects")} /> : null}
          </Section>
        </View>
      </View>
    </Page>
  );
}

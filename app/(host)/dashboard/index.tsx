import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { ClipboardList, FileText, Folder, History } from "lucide-react-native";
import { Button, EmptyState, ListRow, Notice, Page, PageHeader, Section, Surface, Text, space, useTheme } from "../../../ui";
import { useForms, useSessions, useSubjects } from "../../../lib/data";
import { sessionCodeLabel } from "../../../lib/text";
import { apiFetch } from "../../../lib/http";

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

type Activity = { type: string; targetId: string; label: string; occurredAt: string };

const activityLabels: Record<string, string> = {
  form_created: "Form created", form_updated: "Form updated",
  folder_created: "Folder created", folder_updated: "Folder updated",
  session_created: "Session created", session_started: "Session started",
  session_ended: "Session ended", response_submitted: "Response submitted",
};

function activityPath(item: Activity) {
  if (item.type.startsWith("form_")) return `/forms/${item.targetId}`;
  if (item.type.startsWith("folder_")) return `/dashboard/subjects/${item.targetId}`;
  return `/dashboard/sessions/${item.targetId}`;
}

export default function DashboardHome() {
  const router = useRouter();
  const { forms, error: formsError } = useForms();
  const { subjects } = useSubjects();
  const { sessions, refresh } = useSessions();
  const [activity, setActivity] = useState<Activity[]>([]);
  const [activityError, setActivityError] = useState(false);

  useEffect(() => {
    const loadActivity = async () => {
      try {
        const response = await apiFetch("/api/activity");
        if (!response.ok) throw new Error("Activity unavailable");
        setActivity(await response.json());
        setActivityError(false);
      } catch { setActivityError(true); }
    };
    void loadActivity();
    const t = setInterval(() => { void refresh(); void loadActivity(); }, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const active = sessions.filter((s) => s.status === "active");
  const connected = active.reduce((sum, s) => sum + s.inProgressCount, 0);
  const go = (href: string) => router.push(href as never);

  return (
    <Page>
      <PageHeader title="Dashboard" subtitle="Manage forms and sessions, and see recent activity." />
      {formsError ? <Notice tone="danger">{`Couldn't reach the local server: ${formsError}`}</Notice> : null}

      <Surface padded={false} style={{ flexDirection: "row", flexWrap: "wrap" }}>
        <Stat label="Live sessions" value={active.length} hint={`${connected} connected`} onPress={() => go("/dashboard/sessions")} />
        <Stat label="Forms" value={forms.length} onPress={() => go("/dashboard/forms")} />
        <Stat last label="Folders" value={subjects.length} onPress={() => go("/dashboard/subjects")} />
      </Surface>

      <Section title={`All forms · ${forms.length}`} description="Open a form to edit it or start a session.">
        <Surface padded={false}>
          {forms.length === 0 ? (
            <EmptyState icon={FileText} title="No forms yet" body="Start one from a template or a blank form." actionLabel="Go to forms" onAction={() => go("/dashboard/forms")} />
          ) : (
            forms.map((f, i) => (
              <ListRow key={f.id} last={i === forms.length - 1} icon={FileText} title={f.title || "Untitled form"} meta={plural(f.questionCount, "question")} onPress={() => go(`/forms/${f.id}`)} />
            ))
          )}
        </Surface>
        {forms.length > 0 ? <Button label="Manage forms" variant="ghost" compact style={{ marginLeft: -space[3] }} onPress={() => go("/dashboard/forms")} /> : null}
      </Section>

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
                    subtitle={`${sessionCodeLabel(s)} · ${s.durationMinutes ? `${s.durationMinutes} min limit` : "No time limit"}`}
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

      <View>
          <Section title="Recent activity" description="Latest form, folder, session, and response events.">
            <Surface padded={false}>
              {activity.length === 0 ? (
                <EmptyState icon={History} title={activityError ? "Activity unavailable" : "No activity yet"} body={activityError ? "Check your connection to the local server." : "New forms, sessions, and responses will appear here."} />
              ) : (
                <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator>
                  {activity.map((item, index) => (
                    <ListRow key={`${item.type}-${item.targetId}-${item.occurredAt}`} last={index === activity.length - 1} icon={item.type.startsWith("form_") ? FileText : item.type.startsWith("folder_") ? Folder : ClipboardList} title={activityLabels[item.type] || "Activity"} subtitle={item.label || "Untitled"} meta={new Date(item.occurredAt).toLocaleString()} onPress={() => go(activityPath(item))} />
                  ))}
                </ScrollView>
              )}
            </Surface>
          </Section>
      </View>
    </Page>
  );
}

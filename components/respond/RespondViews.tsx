import { Image, ScrollView, View } from "react-native";
import { Check, Download, X } from "lucide-react-native";
import { canDownloadAnswers } from "../../lib/downloadAnswers";
import { Button, Icon, Notice, Surface, Text, TextField, space, useLayout, useTheme } from "../../ui";

export interface SessionInfo {
  status: "draft" | "active" | "ended";
  formTitle: string;
  name: string;
  responsesEditable?: boolean;
  fullscreenEnabled?: boolean;
  blurOnDisconnect?: boolean;
  restrictCopying?: boolean;
}

export interface ReviewItem {
  questionId: string; title?: string; gradable?: boolean; correct?: boolean; submittedAnswer?: string; correctAnswer?: string;
  questionImageUrl?: string | null; fileUrl?: string | null;
}

export interface DoneResult {
  score?: number | null; maxScore?: number | null; review?: ReviewItem[]; answers?: unknown[]; editCode?: string; formTitle?: string;
  session?: { name?: string; responsesEditable?: boolean; status?: string; fullscreenEnabled?: boolean };
}

const isImage = (uri?: string | null) => /^data:image\//.test(uri || "");

function Centered({ children }: { children: React.ReactNode }) {
  const { isPhone } = useLayout();
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: isPhone ? "flex-start" : "center", padding: isPhone ? space[4] : space[5] }} keyboardShouldPersistTaps="handled">
      <View style={{ width: "100%", maxWidth: 520 }}>{children}</View>
    </ScrollView>
  );
}

export function Message({ text, tone }: { text: string; tone?: "danger" }) {
  return <Centered><Text align="center" tone={tone === "danger" ? "danger" : "secondary"}>{text}</Text></Centered>;
}

export function JoinView(p: {
  info: SessionInfo; name: string; onName: (v: string) => void; joining: boolean; error: string | null; onJoin: () => void; onLeave: () => void;
  showEdit: boolean; onShowEdit: () => void; editCode: string; onEditCode: (v: string) => void; editError: string | null; submittingEdit: boolean; onSubmitEdit: () => void;
}) {
  const draft = p.info.status === "draft";
  const ended = p.info.status === "ended";
  return (
    <Centered>
      <Surface style={{ gap: space[3] }}>
        <Button label="Leave" variant="ghost" compact onPress={p.onLeave} />
        <View style={{ gap: 2 }}>
          <Text variant="heading" accessibilityRole="header">{p.info.formTitle || "Untitled form"}</Text>
          {p.info.name ? <Text tone="secondary">{p.info.name}</Text> : null}
        </View>
        {draft ? <Notice tone="info">This session hasn't started yet. Waiting for the host…</Notice> : null}
        {ended ? <Notice tone="warning">This session has ended.</Notice> : null}
        <TextField label="Your name" value={p.name} onChangeText={p.onName} placeholder="Your name" editable={!draft} autoFocus onSubmitEditing={p.onJoin} />
        {p.error ? <Notice tone="danger">{p.error}</Notice> : null}
        <Button label="Continue" variant="primary" fullWidth loading={p.joining} disabled={draft || !p.name.trim()} onPress={p.onJoin} />

        {p.info.responsesEditable && p.info.status === "active" ? (
          p.showEdit ? (
            <View style={{ gap: space[2] }}>
              <TextField label="Your edit code" value={p.editCode} onChangeText={p.onEditCode} placeholder="Your edit code" onSubmitEditing={p.onSubmitEdit} />
              {p.editError ? <Text variant="small" tone="danger">{p.editError}</Text> : null}
              <Button label="Edit my response" fullWidth loading={p.submittingEdit} disabled={!p.editCode.trim()} onPress={p.onSubmitEdit} />
            </View>
          ) : (
            <Button label="Already submitted? Edit your response" variant="ghost" compact onPress={p.onShowEdit} />
          )
        ) : null}
      </Surface>
    </Centered>
  );
}

export function DoneView(p: {
  result: DoneResult | null; autoSubmitted: boolean; titles: Record<string, string>; onDone: () => void;
  onDownload: () => void; downloading: boolean; onEdit: () => void; reopening: boolean; reopenError: string | null;
}) {
  const { colors } = useTheme();
  const r = p.result;
  const hasScore = r?.score !== null && r?.score !== undefined;
  return (
    <Centered>
      <Surface style={{ gap: space[4] }}>
        <View style={{ gap: 2 }}>
          <Text variant="heading" accessibilityRole="header">Response recorded</Text>
          <Text tone="secondary">{p.autoSubmitted ? "Time was up, so your response was submitted automatically." : "Thanks, your response has been submitted."}</Text>
        </View>
        {hasScore ? <Text variant="display">{r!.score} / {r!.maxScore}</Text> : null}

        {Array.isArray(r?.review) && r!.review!.length > 0 ? (
          <View style={{ gap: space[2] }}>
            {r!.review!.map((item) => (
              <View key={item.questionId} style={{ flexDirection: "row", gap: space[3], padding: space[3], borderRadius: 8, backgroundColor: item.gradable ? (item.correct ? colors.successSoft : colors.dangerSoft) : colors.surfaceMuted }}>
                {item.gradable ? <Icon icon={item.correct ? Check : X} size={18} color={item.correct ? colors.success : colors.danger} /> : null}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong">{item.title || p.titles[item.questionId] || "Question"}</Text>
                  {item.questionImageUrl ? <Image source={{ uri: item.questionImageUrl }} accessibilityLabel="" resizeMode="contain" style={{ width: "100%", height: 140 }} /> : null}
                  <Text variant="small" tone="secondary">Your answer: {item.submittedAnswer || "No answer"}</Text>
                  {isImage(item.fileUrl) ? <Image source={{ uri: item.fileUrl! }} accessibilityLabel="" resizeMode="contain" style={{ width: "100%", height: 140 }} /> : null}
                  {item.gradable && !item.correct ? <Text variant="small" tone="secondary">Correct answer: {item.correctAnswer}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {canDownloadAnswers && Array.isArray(r?.answers) && r!.answers!.length > 0 ? (
          <Button label={p.downloading ? "Preparing PDF…" : "Download my answers (PDF)"} icon={Download} loading={p.downloading} onPress={p.onDownload} />
        ) : null}

        {r?.editCode ? (
          <View style={{ gap: space[2] }}>
            {r.session?.responsesEditable && r.session?.status === "active" ? <Button label="Edit my response" loading={p.reopening} onPress={p.onEdit} /> : null}
            <Text variant="small" tone="secondary">Your edit code: <Text variant="small" style={{ fontWeight: "700" }} selectable>{r.editCode}</Text>. Save it in case you want to edit your response later from a different device (you'll also need this session's code).</Text>
            {p.reopenError ? <Text variant="small" tone="danger">{p.reopenError}</Text> : null}
          </View>
        ) : null}

        <Button label="Done" variant="primary" fullWidth onPress={p.onDone} />
      </Surface>
    </Centered>
  );
}

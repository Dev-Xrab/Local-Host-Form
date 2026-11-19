import { Image, View } from "react-native";
import { Check, Download, X } from "lucide-react-native";
import { canDownloadAnswers } from "../../lib/downloadAnswers";
import { Notice } from "../../ui";
import { GButton, GCard, GLineInput, GText, useGF } from "../../ui/gforms";
import { RespondentFrame } from "./RespondentFrame";

export interface SessionInfo {
  status: "draft" | "active" | "ended";
  formTitle: string;
  name: string;
  responsesEditable?: boolean;
  fullscreenEnabled?: boolean;
  blurOnDisconnect?: boolean;
  restrictCopying?: boolean;
  collectEmail?: boolean;
}

export interface ReviewItem {
  questionId: string; title?: string; gradable?: boolean; correct?: boolean; submittedAnswer?: string; correctAnswer?: string;
  questionImageUrl?: string | null; fileUrl?: string | null; points?: number | null; pointsEarned?: number | null;
}

export interface DoneResult {
  score?: number | null; maxScore?: number | null; review?: ReviewItem[]; answers?: unknown[]; editCode?: string; formTitle?: string;
  session?: { name?: string; responsesEditable?: boolean; status?: string; fullscreenEnabled?: boolean };
  confirmationMessage?: string; showSubmitAnother?: boolean; allowDownloadCopy?: boolean;
}

const isImage = (uri?: string | null) => /^data:image\//.test(uri || "");

export function Message({ text, tone }: { text: string; tone?: "danger" }) {
  const g = useGF();
  return <RespondentFrame><GCard accent><View style={{ padding: 24 }}><GText style={{ textAlign: "center" }} color={tone === "danger" ? g.error : g.textSecondary}>{text}</GText></View></GCard></RespondentFrame>;
}

export function JoinView(p: {
  info: SessionInfo; name: string; onName: (v: string) => void; email: string; onEmail: (v: string) => void; joining: boolean; error: string | null; onJoin: () => void; onLeave: () => void;
  showEdit: boolean; onShowEdit: () => void; editCode: string; onEditCode: (v: string) => void; editError: string | null; submittingEdit: boolean; onSubmitEdit: () => void;
}) {
  const draft = p.info.status === "draft";
  const ended = p.info.status === "ended";
  const g = useGF();
  return (
    <RespondentFrame onLeave={p.onLeave}>
      <View style={{ gap: 12 }}>
        <GCard accent>
          <View style={{ padding: 24, gap: 12 }}>
            <GText size={32} accessibilityRole="header" style={{ lineHeight: 40 }}>{p.info.formTitle || "Untitled form"}</GText>
            <GText secondary>{p.info.name || "Enter your name to begin."}</GText>
            <View style={{ borderTopWidth: 1, borderTopColor: g.border, paddingTop: 12 }}><GText size={14} color={g.error}>* Indicates required question</GText></View>
          </View>
        </GCard>
        {draft ? <Notice tone="info">The host has not started this session. Keep this page open; it will be ready when they start.</Notice> : null}
        {ended ? <Notice tone="warning">This session has ended. New responses are closed.</Notice> : null}
        <View style={{ backgroundColor: g.card, borderWidth: 1, borderColor: p.error ? g.error : g.border, borderRadius: 8, padding: 24, gap: 16 }}>
          <GText size={16}>Your name or identifier<GText size={16} color={g.error}> *</GText></GText>
          <GLineInput width="70%" value={p.name} onChangeText={p.onName} placeholder="Your answer" editable={!draft && !ended} autoFocus onSubmitEditing={p.onJoin} invalid={!!p.error} accessibilityLabel="Your name or identifier" />
          {p.error ? <GText size={12} color={g.error} accessibilityRole="alert">{p.error}</GText> : null}
        </View>
        {p.info.collectEmail ? (
          <View style={{ backgroundColor: g.card, borderWidth: 1, borderColor: g.border, borderRadius: 8, padding: 24, gap: 16 }}>
            <GText size={16}>Email<GText size={16} color={g.error}> *</GText></GText>
            <GLineInput width="70%" value={p.email} onChangeText={p.onEmail} placeholder="Your email address" editable={!draft && !ended} keyboardType="email-address" autoCapitalize="none" onSubmitEditing={p.onJoin} accessibilityLabel="Your email address" />
          </View>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <GButton variant="filled" label="Start answering" loading={p.joining} disabled={draft || ended || !p.name.trim() || (!!p.info.collectEmail && !p.email.trim())} onPress={p.onJoin} />
          {p.info.responsesEditable && p.info.status === "active" && !p.showEdit ? <GButton label="Already submitted? Edit your response" onPress={p.onShowEdit} /> : null}
        </View>
        {p.info.responsesEditable && p.info.status === "active" && p.showEdit ? (
          <View style={{ backgroundColor: g.card, borderWidth: 1, borderColor: g.border, borderRadius: 8, padding: 24, gap: 12 }}>
            <GText size={16}>Your edit code</GText>
            <GLineInput width="70%" value={p.editCode} onChangeText={p.onEditCode} placeholder="Your answer" onSubmitEditing={p.onSubmitEdit} accessibilityLabel="Your edit code" />
            {p.editError ? <GText size={12} color={g.error}>{p.editError}</GText> : null}
            <GButton variant="outlined" label="Edit my response" loading={p.submittingEdit} disabled={!p.editCode.trim()} onPress={p.onSubmitEdit} />
          </View>
        ) : null}
      </View>
    </RespondentFrame>
  );
}

export function DoneView(p: {
  result: DoneResult | null; autoSubmitted: boolean; titles: Record<string, string>; onDone: () => void;
  onDownload: () => void; downloading: boolean; onEdit: () => void; reopening: boolean; reopenError: string | null;
  onAnother?: () => void; anotherBusy?: boolean;
}) {
  const g = useGF();
  const r = p.result;
  const hasScore = r?.score !== null && r?.score !== undefined;
  return (
    <RespondentFrame>
      <View style={{ gap: 12 }}>
        <GCard accent>
          <View style={{ padding: 24, gap: 12 }}>
            <GText size={32} accessibilityRole="header" style={{ lineHeight: 40 }}>{r?.formTitle || "Response recorded"}</GText>
            <GText>{p.autoSubmitted ? "Time was up, so your response was submitted automatically." : r?.confirmationMessage?.trim() || "Your response has been recorded."}</GText>
            {hasScore ? <View style={{ borderTopWidth: 1, borderTopColor: g.border, paddingTop: 12, gap: 2 }}><GText size={12} secondary>Total points</GText><GText size={28}>{r!.score} / {r!.maxScore}</GText></View> : null}
            {r?.editCode && r.session?.responsesEditable && r.session?.status === "active" ? <View style={{ flexDirection: "row" }}><GButton label="Edit your response" loading={p.reopening} onPress={p.onEdit} /></View> : null}
            {p.reopenError ? <GText size={12} color={g.error}>{p.reopenError}</GText> : null}
          </View>
        </GCard>

        {Array.isArray(r?.review) && r!.review!.length > 0 ? r!.review!.map((item) => (
          <View key={item.questionId} style={{ backgroundColor: g.card, borderWidth: 1, borderColor: g.border, borderRadius: 8, padding: 24, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <GText size={16} style={{ flex: 1 }}>{item.title || p.titles[item.questionId] || "Question"}</GText>
              {item.gradable && item.correct != null ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>{item.correct ? <Check size={18} color={g.success} /> : <X size={18} color={g.error} />}<GText size={12} color={item.correct ? g.success : g.error}>{item.correct ? "Correct" : "Incorrect"}</GText></View> : null}
            </View>
            {item.questionImageUrl ? <Image source={{ uri: item.questionImageUrl }} accessibilityLabel="" resizeMode="contain" style={{ width: "100%", height: 140 }} /> : null}
            <View style={{ backgroundColor: item.gradable && item.correct != null ? (item.correct ? g.successSoft : g.errorSoft) : g.cardAlt, borderRadius: 4, padding: 12 }}><GText size={14}>{item.submittedAnswer || "No answer"}</GText></View>
            {isImage(item.fileUrl) ? <Image source={{ uri: item.fileUrl! }} accessibilityLabel="" resizeMode="contain" style={{ width: "100%", height: 140 }} /> : null}
            {item.gradable && item.correct === false && item.correctAnswer ? <GText size={13} secondary>Correct answer: <GText size={13} color={g.success}>{item.correctAnswer}</GText></GText> : null}
            {item.points != null ? <GText size={12} secondary>{item.pointsEarned ?? 0} / {item.points} {item.points === 1 ? "point" : "points"}</GText> : null}
          </View>
        )) : null}

        {r?.editCode ? <View style={{ backgroundColor: g.card, borderWidth: 1, borderColor: g.border, borderRadius: 8, padding: 24, gap: 6 }}>
          <GText size={13} secondary>Your edit code</GText>
          <GText size={20} weight="500" selectable>{r.editCode}</GText>
          <GText size={12} secondary>Save it to edit your response later from a different device (you'll also need this session's code).</GText>
        </View> : null}

        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", paddingBottom: 24 }}>
          {canDownloadAnswers && r?.allowDownloadCopy !== false && Array.isArray(r?.answers) && r!.answers!.length > 0 ? <GButton variant="outlined" label={p.downloading ? "Preparing PDF…" : "Download my answers (PDF)"} loading={p.downloading} icon={<Download size={16} color={g.accent} />} onPress={p.onDownload} /> : null}
          {r?.showSubmitAnother && p.onAnother ? <GButton variant="outlined" label="Submit another response" loading={p.anotherBusy} onPress={p.onAnother} /> : null}
          <GButton variant="filled" label="Done" onPress={p.onDone} />
        </View>
      </View>
    </RespondentFrame>
  );
}

import { useState } from "react";
import { Pressable, View } from "react-native";
import { Check, Copy } from "lucide-react-native";
import { Button, Dialog, Surface, Text, radius, space, useTheme } from "../../ui";
import { QrCode } from "../QrCode";
import { copyText } from "../../lib/platform";

function LinkBlock({ label, url, onQrPress, compact }: { label: string; url: string; onQrPress: () => void; compact?: boolean }) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  return (
    <View style={compact ? { flexDirection: "row", alignItems: "center", gap: space[3] } : { gap: space[2] }}>
      <View style={compact ? { flex: 1, minWidth: 0, gap: space[1] } : { gap: space[2] }}>
      <Text variant="caption" tone="tertiary">{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <View style={{ flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, paddingHorizontal: space[3], paddingVertical: 8 }}>
          <Text variant="small" numberOfLines={1} selectable style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>{url}</Text>
        </View>
        <Button label={copied ? "Copied" : "Copy"} icon={copied ? Check : Copy} compact onPress={async () => { if (await copyText(url)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }} />
      </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="View session QR codes" onPress={onQrPress} style={{ alignSelf: "flex-start", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: "hidden" }}>
        <QrCode value={url} size={compact ? 64 : 104} />
      </Pressable>
    </View>
  );
}

/** How people join this session: the code, the LAN link and, when the tunnel is up, a public link. Both come with a scannable QR. */
export function JoinPanel({ code, shareUrl, publicUrl, inline }: { code: string; shareUrl: string; publicUrl: string | null; inline?: boolean }) {
  const [qrOpen, setQrOpen] = useState(false);
  const qrDialog = (
    <Dialog visible={qrOpen} title="Scan to join this session" onClose={() => setQrOpen(false)} width={620}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[4], justifyContent: "center" }}>
        <View style={{ width: 250, alignItems: "center", gap: space[2] }}>
          <Text style={{ fontWeight: "600" }}>Local network</Text>
          <Text variant="small" tone="secondary" style={{ textAlign: "center" }}>Use when the student is connected to the same Wi-Fi or network as this server.</Text>
          <QrCode value={shareUrl} size={190} />
          <Text variant="small" selectable style={{ textAlign: "center" }}>{shareUrl}</Text>
        </View>
        {publicUrl ? <View style={{ width: 250, alignItems: "center", gap: space[2] }}>
          <Text style={{ fontWeight: "600" }}>Online</Text>
          <Text variant="small" tone="secondary" style={{ textAlign: "center" }}>Use from any network while remote access is running on the host computer.</Text>
          <QrCode value={publicUrl} size={190} />
          <Text variant="small" selectable style={{ textAlign: "center" }}>{publicUrl}</Text>
        </View> : null}
      </View>
    </Dialog>
  );
  const codeBlock = (
    <View style={{ gap: 2 }}>
      <Text variant="caption" tone="tertiary">Join code</Text>
      <Text variant="display" selectable style={{ letterSpacing: 4, fontVariant: ["tabular-nums"] }}>{code}</Text>
    </View>
  );
  if (inline) {
    // Keep both destinations visible so the host can share the right link for each student.
    return (
      <>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[4], flexWrap: "wrap" }}>
        {codeBlock}
        <View style={{ flex: 1, minWidth: 240, gap: space[3] }}>
          <LinkBlock compact label="Local link · same network" url={shareUrl} onQrPress={() => setQrOpen(true)} />
          {publicUrl ? <LinkBlock compact label="Online link · any network" url={publicUrl} onQrPress={() => setQrOpen(true)} /> : null}
        </View>
      </View>
      {qrDialog}
      </>
    );
  }
  return (
    <Surface style={{ gap: space[4] }}>
      {codeBlock}
      <LinkBlock label="Link on this network" url={shareUrl} onQrPress={() => setQrOpen(true)} />
      {publicUrl ? <LinkBlock label="Public link (works outside this network)" url={publicUrl} onQrPress={() => setQrOpen(true)} /> : null}
      {qrDialog}
    </Surface>
  );
}

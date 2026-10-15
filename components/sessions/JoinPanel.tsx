import { useState } from "react";
import { Pressable, View } from "react-native";
import { Check, Copy } from "lucide-react-native";
import { Button, Dialog, Surface, Text, radius, space, useTheme } from "../../ui";
import { QrCode } from "../QrCode";
import { copyText } from "../../lib/platform";

function LinkBlock({ label, url, qrTitle, compact }: { label: string; url: string; qrTitle: string; compact?: boolean }) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
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
      <Pressable accessibilityRole="button" accessibilityLabel="Enlarge QR code" onPress={() => setOpen(true)} style={{ alignSelf: "flex-start", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: "hidden" }}>
        <QrCode value={url} size={compact ? 64 : 104} />
      </Pressable>
      <Dialog visible={open} title={qrTitle} onClose={() => setOpen(false)} width={360}>
        <View style={{ alignItems: "center", gap: space[3] }}>
          <QrCode value={url} size={240} />
          <Text variant="small" tone="secondary" selectable>{url}</Text>
        </View>
      </Dialog>
    </View>
  );
}

/** How people join this session: the code, the LAN link and, when the tunnel is up, a public link. Both come with a scannable QR. */
export function JoinPanel({ code, shareUrl, publicUrl, inline }: { code: string; shareUrl: string; publicUrl: string | null; inline?: boolean }) {
  const codeBlock = (
    <View style={{ gap: 2 }}>
      <Text variant="caption" tone="tertiary">Join code</Text>
      <Text variant="display" selectable style={{ letterSpacing: 4, fontVariant: ["tabular-nums"] }}>{code}</Text>
    </View>
  );
  if (inline) {
    // Single horizontal strip: code, then link + copy + QR.
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[4], flexWrap: "wrap" }}>
        {codeBlock}
        <View style={{ flex: 1, minWidth: 240 }}>
          <LinkBlock compact label={publicUrl ? "Public link" : "Link on this network"} url={publicUrl ?? shareUrl} qrTitle="Scan to join this session" />
        </View>
      </View>
    );
  }
  return (
    <Surface style={{ gap: space[4] }}>
      {codeBlock}
      <LinkBlock label="Link on this network" url={shareUrl} qrTitle="Scan to join this session" />
      {publicUrl ? <LinkBlock label="Public link (works outside this network)" url={publicUrl} qrTitle="Scan to join (public link)" /> : null}
    </Surface>
  );
}

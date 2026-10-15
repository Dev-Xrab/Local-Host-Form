import { useState } from "react";
import { Pressable, View } from "react-native";
import { Check, Copy } from "lucide-react-native";
import { Dialog, IconButton, Section, Surface, Text, radius, space, useLayout, useTheme } from "../ui";
import { QrCode } from "./QrCode";
import { copyText } from "../lib/platform";
import { useServerOrigin } from "../lib/useServerOrigin";
import { useTunnel } from "../lib/data";

function AddressRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyText(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <View style={{ gap: 2 }}>
      <Text variant="caption" tone="tertiary">{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], backgroundColor: colors.surfaceMuted, borderRadius: radius.md, paddingLeft: space[3] }}>
        <Text variant="small" style={{ flex: 1, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }} numberOfLines={1} selectable>{value}</Text>
        <IconButton icon={copied ? Check : Copy} label={copied ? "Copied" : `Copy ${label.toLowerCase()}`} onPress={copy} />
      </View>
    </View>
  );
}

/** Where students connect, as one horizontal strip: status + addresses, QR, live counts. */
export function ServerPanel(_: { running?: number; connected?: number }) {
  const { colors } = useTheme();
  const { isDesktop } = useLayout();
  const origin = useServerOrigin();
  const tunnel = useTunnel();
  const [qrOpen, setQrOpen] = useState(false);

  return (
    <Section title="Local server" description="Online. Share this address with students on your network.">
      <Surface style={{ flexDirection: isDesktop ? "row" : "column", alignItems: isDesktop ? "center" : "stretch", justifyContent: "space-between", gap: space[5] }}>
        <View style={{ flex: 1, minWidth: 0, maxWidth: 480, gap: space[3] }}>
          <AddressRow label="Local address" value={origin} />
          {tunnel.status === "connected" && tunnel.url ? <AddressRow label="Public link" value={tunnel.url} /> : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[4] }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Enlarge QR code" onPress={() => setQrOpen(true)} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: "hidden" }}>
            <QrCode value={origin} size={70} />
          </Pressable>
        </View>

        <Dialog visible={qrOpen} title="Scan to join this server" onClose={() => setQrOpen(false)} width={360}>
          <View style={{ alignItems: "center", gap: space[3] }}>
            <QrCode value={origin} size={240} />
            <Text variant="small" tone="secondary" selectable>{origin}</Text>
          </View>
        </Dialog>
      </Surface>
    </Section>
  );
}

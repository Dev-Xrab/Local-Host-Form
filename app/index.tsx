import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { FileText, Users } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Dialog, Text, useLayout } from "../ui";
import { GButton, GText, useGF } from "../ui/gforms";
import { EntryBar } from "../components/AuthCard";

function RoleButton({ label, caption, icon, onPress }: { label: string; caption: string; icon: typeof Users; onPress: () => void }) {
  const g = useGF();
  const I = icon;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}. ${caption}`} onPress={onPress}
      style={(s) => [{ flex: 1, minWidth: 0, minHeight: 148, borderRadius: 8, borderWidth: 1, borderColor: g.text, backgroundColor: (s as { hovered?: boolean }).hovered ? g.accentSoft : g.card, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 }]}>
      <I size={28} color={g.text} />
      <GText size={20} weight="600" style={{ letterSpacing: 1 }}>{label}</GText>
      <GText size={13} secondary style={{ textAlign: "center" }}>{caption}</GText>
    </Pressable>
  );
}

export default function Landing() {
  const router = useRouter();
  const g = useGF();
  const { width } = useLayout();
  const [helpOpen, setHelpOpen] = useState(false);
  const row = width >= 560;
  const version = Constants.expoConfig?.version ?? "1.2.1";
  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: g.page }}>
      <EntryBar right={<GButton label="Help" onPress={() => setHelpOpen(true)} />} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, alignItems: "center", paddingHorizontal: 16, paddingBottom: 32 }}>
        <View style={{ width: "100%", maxWidth: 640, flexGrow: 1, justifyContent: "center", gap: 32, paddingVertical: 24 }}>
          <View style={{ alignItems: "center", gap: 12 }}>
            <GText size={width >= 700 ? 40 : 30} accessibilityRole="header" style={{ textAlign: "center", lineHeight: width >= 700 ? 48 : 38 }}>Forms and sessions, on your terms.</GText>
            <GText size={16} secondary style={{ textAlign: "center", maxWidth: 480 }}>Choose how you're using Self-Host Form.</GText>
          </View>
          <View style={{ flexDirection: row ? "row" : "column", gap: 16 }}>
            <RoleButton label="HOST" caption="Create forms and run sessions" icon={FileText} onPress={() => router.push("/host/login")} />
            <RoleButton label="RESPONDENT" caption="Join a session with a code" icon={Users} onPress={() => router.push("/respondent/login")} />
          </View>
          <GText size={12} secondary style={{ textAlign: "center" }}>Runs on your device · Local first · v{version}</GText>
        </View>
      </ScrollView>

      <Dialog visible={helpOpen} title="Help" onClose={() => setHelpOpen(false)}>
        <Text variant="bodyStrong">Respondent</Text><Text tone="secondary">Enter the code your host shared, or open their link. You do not need an account to answer.</Text>
        <Text variant="bodyStrong">Host</Text><Text tone="secondary">Sign in on the server that stores your forms. Create a form, then start a session to share its code or link.</Text>
      </Dialog>
    </SafeAreaView>
  );
}

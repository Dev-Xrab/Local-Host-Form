import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowRight, ClipboardList, PenSquare } from "lucide-react-native";
import { AuthCard } from "../components/AuthCard";
import { Icon, Text, radius, space, useTheme } from "../ui";
import type { IconComponent } from "../ui/Icon";
import { useFocusRing } from "../ui/interactive";

function Choice({ icon, title, body, onPress }: { icon: IconComponent; title: string; body: string; onPress: () => void }) {
  const { colors } = useTheme();
  const { ring, onFocus, onBlur } = useFocusRing(colors);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${title}. ${body}`}
      onPress={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      style={(s) => [
        { flexDirection: "row", alignItems: "center", gap: space[3], padding: space[3], minHeight: 64, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: (s as { hovered?: boolean }).hovered ? colors.surfaceMuted : colors.surface },
        ring,
      ]}
    >
      <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" }}>
        <Icon icon={icon} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="small" tone="secondary">{body}</Text>
      </View>
      <Icon icon={ArrowRight} size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

export default function RolePicker() {
  const router = useRouter();
  return (
    <AuthCard title="Self Host Form" subtitle="Build forms your way, host them yourself, and keep your data local.">
      <View style={{ gap: space[2] }}>
        <Choice icon={ClipboardList} title="Host" body="Create forms and run sessions" onPress={() => router.push("/host/login")} />
        <Choice icon={PenSquare} title="Respondent" body="Answer a form you were sent" onPress={() => router.push("/respondent/login")} />
      </View>
    </AuthCard>
  );
}

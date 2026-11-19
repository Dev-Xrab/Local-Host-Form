import { useState, type ReactNode } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, View, type TextInputProps } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button as UIButton, Text, TextField, ThemeToggle, space, useLayout, useTheme } from "../ui";

type EntryKind = "host" | "respondent" | "welcome";

/** Top bar used by the landing page. */
export function EntryBar({ right }: { right?: ReactNode }) {
  const { colors } = useTheme();
  const { width } = useLayout();
  return (
    <View style={{ minHeight: 64, paddingHorizontal: width >= 700 ? 32 : 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Image source={require("../assets/logo.png")} accessibilityLabel="" style={{ width: 28, height: 28, tintColor: colors.text }} />
        <Text variant="bodyStrong">Self-Host Form</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>{right}<ThemeToggle /></View>
    </View>
  );
}

/** Split-screen entry frame shared by host sign-in, host setup, recovery and joining a session. */
export function AuthCard({ title, subtitle, children, footer, eyebrow, kind = "welcome" }: {
  title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; eyebrow?: string; kind?: EntryKind;
}) {
  const { width } = useLayout();
  const { colors, dark } = useTheme();
  const split = width >= 900;
  const gutter = width >= 1200 ? space[7] : width >= 900 ? space[6] : space[4];
  const heroTitle = kind === "respondent" ? "Your response.\nOn your terms." : "Forms, sessions,\nand results. Yours.";
  const heroCopy = kind === "respondent" ? "Join a session with a code or link. Your answers go directly to the host running it." : "Build forms, run live sessions and review responses from a server you control.";
  const trust = "Local first. Your data stays on your server.";
  const rightTrust = kind === "respondent" ? "No account is needed to respond." : kind === "host" ? "Forms and responses stay on this server by default." : "No account is needed to join a session.";
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flex: 1, flexDirection: split ? "row" : "column" }}>
          {split ? (
            <View style={{ width: "45%", backgroundColor: dark ? colors.surface : colors.surfaceMuted, overflow: "hidden", borderRightWidth: 1, borderRightColor: colors.border }}>
              <View pointerEvents="none" style={{ position: "absolute", right: -112, bottom: 28, width: 390, height: 390, borderRadius: 195, borderWidth: 1, borderColor: dark ? "#FFFFFF2A" : "#17171726" }} />
              <View pointerEvents="none" style={{ position: "absolute", right: -52, bottom: 88, width: 270, height: 270, borderRadius: 135, borderWidth: 1, borderColor: dark ? "#FFFFFF35" : "#17171735" }} />
              <View style={{ flex: 1, paddingHorizontal: gutter, paddingTop: space[6], paddingBottom: space[6] }}>
              <View style={{ height: 44, flexDirection: "row", alignItems: "center", gap: space[3] }}>
                <Image source={require("../assets/logo.png")} accessibilityLabel="" style={{ width: 30, height: 30, tintColor: colors.text }} />
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", letterSpacing: -0.2 }}>Self-Host Form</Text>
              </View>
              <View style={{ paddingTop: space[7] + space[6] + (eyebrow ? space[6] : 0), gap: space[5], maxWidth: 520 }}>
                <Text accessibilityRole="header" style={{ color: colors.text, fontSize: width >= 1200 ? 50 : 42, lineHeight: width >= 1200 ? 55 : 48, fontWeight: "700", letterSpacing: -2 }}>{heroTitle}</Text>
                <Text style={{ color: colors.textBody, fontSize: 17, lineHeight: 27, maxWidth: 430 }}>{heroCopy}</Text>
              </View>
              <View style={{ marginTop: "auto", borderTopWidth: 1, borderTopColor: dark ? "#FFFFFF55" : colors.borderStrong, paddingTop: space[4] }}>
                <Text variant="small" style={{ color: colors.textSecondary }}>{trust}</Text>
              </View>
              </View>
            </View>
          ) : null}
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={{ height: split ? 108 : 72, paddingHorizontal: gutter, paddingTop: split ? space[6] : 0, flexDirection: "row", alignItems: split ? "flex-start" : "center", justifyContent: "space-between" }}>
              {split ? <View /> : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                  <Image source={require("../assets/logo.png")} accessibilityLabel="" style={{ width: 23, height: 23, tintColor: colors.accent }} />
                  <Text variant="bodyStrong">Self-Host Form</Text>
                </View>
              )}
              <ThemeToggle />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: !split && width >= 600 ? "center" : "flex-start", paddingHorizontal: gutter, paddingTop: split ? space[7] : space[5], paddingBottom: !split && width >= 600 ? space[7] + space[7] : space[7] }}>
              <View style={{ width: "100%", maxWidth: 440, gap: space[6] }}>
                <View style={{ gap: space[3] }}>
                  {eyebrow ? <Text variant="small" tone="accent" style={{ fontWeight: "600" }}>{eyebrow}</Text> : null}
                  <Text accessibilityRole="header" style={{ color: colors.text, fontSize: split ? 38 : 32, lineHeight: split ? 43 : 38, fontWeight: "700", letterSpacing: -1.5 }}>{title}</Text>
                  {subtitle ? <Text tone="secondary" style={{ fontSize: 16, lineHeight: 25 }}>{subtitle}</Text> : null}
                </View>
                <View style={{ gap: space[4] }}>{children}</View>
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space[4], gap: space[3] }}>{footer}<Text variant="small" tone="secondary">{rightTrust}</Text></View>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AuthLink({ href, children }: { href: string; children: string }) {
  const { colors } = useTheme();
  return <Link href={href as never} style={{ color: colors.accent, fontSize: 14, lineHeight: 22, fontWeight: "600", textDecorationLine: "underline" }} accessibilityRole="link">{children}</Link>;
}

/** Entry screens use the standard controls, full width by default. */
export function Button({ fullWidth = true, ...rest }: React.ComponentProps<typeof UIButton>) {
  return <UIButton fullWidth={fullWidth} {...rest} />;
}

export function AuthField(props: Omit<TextInputProps, "style"> & { label: string; error?: string | null }) {
  return <TextField {...props} />;
}

export function PasswordField({ label, value, onChangeText, show, onToggle, autoComplete, placeholder, error, onSubmitEditing, autoFocus }: {
  label: string; value: string; onChangeText: (v: string) => void; show: boolean; onToggle?: () => void;
  autoComplete: "current-password" | "new-password"; placeholder?: string; error?: string | null; onSubmitEditing?: () => void; autoFocus?: boolean;
}) {
  return <TextField label={label} value={value} onChangeText={onChangeText} secureTextEntry={!show} autoComplete={autoComplete} placeholder={placeholder} error={error} onSubmitEditing={onSubmitEditing} autoFocus={autoFocus} autoCapitalize="none" trailing={onToggle ? <UIButton label={show ? "Hide" : "Show"} accessibilityLabel={show ? "Hide password" : "Show password"} variant="ghost" compact onPress={onToggle} /> : undefined} />;
}

export function useReveal() {
  const [show, setShow] = useState(false);
  return { show, toggle: () => setShow((v) => !v) };
}

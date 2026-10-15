import { useState, type ReactNode } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Link } from "expo-router";
import { Button, Surface, Text, TextField, FadeIn, ThemeToggle, space, useLayout, useTheme } from "../ui";

/**
 * Shared frame for every pre-login screen, laid out like a dashboard sign-in page: logo, centered
 * heading, the form in a bordered card, then the secondary links centered underneath. On phones the
 * card border drops so the form sits flat on the page.
 */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  const { isPhone } = useLayout();
  const { colors } = useTheme();
  const head = (
    <View style={{ alignItems: "center", gap: space[2] }}>
      <Image source={require("../assets/logo.png")} accessibilityLabel="Self Host Form" style={{ width: 32, height: 32, tintColor: colors.text, marginBottom: space[2] }} />
      <Text variant="heading" align="center" accessibilityRole="header">{title}</Text>
      {subtitle ? <Text tone="secondary" align="center">{subtitle}</Text> : null}
    </View>
  );
  const form = <View style={{ gap: space[3] }}>{children}</View>;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ position: "absolute", top: space[3], right: space[3], zIndex: 1 }}><ThemeToggle /></View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", padding: isPhone ? space[4] : space[5] }} keyboardShouldPersistTaps="handled">
        <FadeIn distance={14} duration={640} style={{ width: "100%", maxWidth: 380 }}>
        <View style={{ gap: space[5] }}>
          {head}
          {isPhone ? form : <Surface style={{ padding: space[5] }} padded={false}>{form}</Surface>}
          {footer ? <View style={{ gap: space[1], alignItems: "center" }}>{footer}</View> : null}
        </View>
        </FadeIn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthLink({ href, children }: { href: string; children: string }) {
  const { colors } = useTheme();
  return (
    <Link href={href as never} style={{ color: colors.accent, fontSize: 13, lineHeight: 18, fontWeight: "500" }} accessibilityRole="link">
      {children}
    </Link>
  );
}

export function PasswordField({ label, value, onChangeText, show, onToggle, autoComplete, placeholder, error, onSubmitEditing, autoFocus }: {
  label: string; value: string; onChangeText: (v: string) => void; show: boolean; onToggle?: () => void;
  autoComplete: "current-password" | "new-password"; placeholder?: string; error?: string | null; onSubmitEditing?: () => void; autoFocus?: boolean;
}) {
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={!show}
      autoComplete={autoComplete}
      placeholder={placeholder}
      error={error}
      onSubmitEditing={onSubmitEditing}
      autoFocus={autoFocus}
      autoCapitalize="none"
      trailing={onToggle ? <Button label={show ? "Hide" : "Show"} variant="ghost" compact onPress={onToggle} /> : undefined}
    />
  );
}

/** Small hook for the repeated "show password" toggle. */
export function useReveal() {
  const [show, setShow] = useState(false);
  return { show, toggle: () => setShow((v) => !v) };
}

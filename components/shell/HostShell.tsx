import { useState, type ReactNode } from "react";
import { Image, Pressable, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Table2, FileText, Folder, House, LogOut, MoreHorizontal, ClipboardList, Settings } from "lucide-react-native";
import { useSync } from "../../src/features/cloud/hooks/useSync";
import useAuthStore, { useAuthActions } from "../../store/useAuthStore";
import { Dialog, Divider, ThemeToggle, space, useLayout } from "../../ui";
import { GIconButton, GText, useGF } from "../../ui/gforms";
import type { IconComponent } from "../../ui/Icon";
import { SyncStatus, type SyncState } from "./SyncStatus";

interface NavItem { href: string; label: string; icon: IconComponent; exact?: boolean; primary?: boolean }
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: House, exact: true, primary: true },
  { href: "/dashboard/forms", label: "Forms", icon: FileText, primary: true },
  { href: "/dashboard/sessions", label: "Sessions", icon: ClipboardList, primary: true },
  { href: "/dashboard/export", label: "Results matrix", icon: Table2, primary: true },
  { href: "/dashboard/subjects", label: "Folders", icon: Folder },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const activeAt = (item: NavItem, path: string) => item.exact ? path === item.href : path === item.href || path.startsWith(`${item.href}/`);

function ProductMark({ compact = false }: { compact?: boolean }) {
  const g = useGF();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Image source={require("../../assets/logo.png")} accessibilityLabel="" style={{ width: 28, height: 28, tintColor: g.accent }} />
      {!compact ? <GText size={20} style={{ letterSpacing: -0.2 }}>Self-Host Form</GText> : null}
    </View>
  );
}

/** Google-style nav item: full-width pill on the right edge, tinted when active. */
function NavLink({ item, active, compact = false, onPress }: { item: NavItem; active: boolean; compact?: boolean; onPress: () => void }) {
  const g = useGF();
  const I = item.icon;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={item.label} accessibilityState={{ selected: active }} onPress={onPress}
      style={(state) => [{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: compact ? 0 : 20, justifyContent: compact ? "center" : "flex-start", borderTopRightRadius: compact ? 22 : 22, borderBottomRightRadius: 22, borderTopLeftRadius: compact ? 22 : 0, borderBottomLeftRadius: compact ? 22 : 0, backgroundColor: active ? g.accentSoft : (state as { hovered?: boolean }).hovered ? g.hover : "transparent" }]}>
      <I size={20} color={active ? g.accent : g.textSecondary} />
      {!compact ? <GText size={14} weight={active ? "600" : "500"} color={active ? g.accent : g.text} style={{ flex: 1 }}>{item.label}</GText> : null}
    </Pressable>
  );
}

function PhoneTab({ item, active, onPress }: { item: NavItem; active: boolean; onPress: () => void }) {
  const g = useGF();
  const I = item.icon;
  const label = item.href === "/dashboard/export" ? "Results" : item.label;
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: active }} onPress={onPress} style={{ flex: 1, minHeight: 60, alignItems: "center", justifyContent: "center", gap: 3 }}>
      <View style={{ width: 52, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: active ? g.accentSoft : "transparent" }}><I size={19} color={active ? g.accent : g.textSecondary} /></View>
      <GText size={11} weight="500" color={active ? g.text : g.textSecondary}>{label}</GText>
    </Pressable>
  );
}

export function HostShell({ children }: { children: ReactNode }) {
  const g = useGF();
  const { layout, width } = useLayout();
  const phone = layout === "phone";
  const compact = layout === "tablet" && width < 900;
  const router = useRouter();
  const path = usePathname();
  const { logout } = useAuthActions();
  const hasRecoveryQuestion = useAuthStore((s) => s.hasRecoveryQuestion);
  const sync = useSync() as unknown as SyncState;
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = NAV_ITEMS.filter((item) => item.primary);
  const secondary = NAV_ITEMS.filter((item) => !item.primary);
  const current = NAV_ITEMS.find((item) => activeAt(item, path));
  const go = (href: string) => { setMoreOpen(false); router.push(href as never); };
  const onLogout = async () => { setMoreOpen(false); await logout(); router.replace("/host/login"); };
  const recovery = !hasRecoveryQuestion && path !== "/dashboard/settings" ? (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 40, paddingHorizontal: phone ? space[4] : 24, paddingVertical: 6, backgroundColor: g.accentSoft, borderBottomWidth: 1, borderBottomColor: g.border }}>
      <GText size={13} style={{ flex: 1 }}>Add a recovery question so you can reset your host password if needed.</GText>
      <Pressable accessibilityRole="button" onPress={() => go("/dashboard/settings")}><GText size={13} weight="600" color={g.accent}>Set recovery</GText></Pressable>
    </View>
  ) : null;

  if (phone) return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: g.page }}>
      <View style={{ minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space[4], backgroundColor: g.topbar, borderBottomWidth: 1, borderBottomColor: g.border }}>
        <ProductMark />
        <View style={{ flexDirection: "row", alignItems: "center" }}><SyncStatus sync={sync} compact /><ThemeToggle /></View>
      </View>
      <View style={{ flex: 1 }}>{recovery}{children}</View>
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: g.topbar, borderTopWidth: 1, borderTopColor: g.border }}>
        <View accessibilityRole="tablist" style={{ flexDirection: "row" }}>
          {primary.map((item) => <PhoneTab key={item.href} item={item} active={activeAt(item, path)} onPress={() => go(item.href)} />)}
          <PhoneTab item={{ href: "", label: "More", icon: MoreHorizontal }} active={secondary.some((item) => activeAt(item, path))} onPress={() => setMoreOpen(true)} />
        </View>
      </SafeAreaView>
      <Dialog visible={moreOpen} title="Workspace" onClose={() => setMoreOpen(false)}>
        {secondary.map((item) => <NavLink key={item.href} item={item} active={activeAt(item, path)} onPress={() => go(item.href)} />)}
        <Divider />
        <SyncStatus sync={sync} />
        <Divider />
        <NavLink item={{ href: "", label: "Sign out", icon: LogOut }} active={false} onPress={onLogout} />
      </Dialog>
    </SafeAreaView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: g.page }}>
      <View style={{ zIndex: 30, minHeight: 64, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: g.topbar, borderBottomWidth: 1, borderBottomColor: g.border }}>
        <Pressable accessibilityRole="link" accessibilityLabel="Home" onPress={() => go("/dashboard")} style={{ width: compact ? 56 : 224 - 16, paddingLeft: 4 }}><ProductMark compact={compact} /></Pressable>
        <GText size={16} weight="500" secondary style={{ flex: 1 }}>{current?.label ?? "Home"}</GText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {compact ? <SyncStatus sync={sync} compact /> : <GText size={13} secondary>Hosted on this device</GText>}
          <ThemeToggle />
          <GIconButton label="Sign out" onPress={onLogout}><LogOut size={20} color={g.textSecondary} /></GIconButton>
        </View>
      </View>
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View role="navigation" style={{ width: compact ? 72 : 224, paddingTop: 12, paddingRight: compact ? 8 : 12, paddingLeft: compact ? 8 : 0, backgroundColor: g.topbar }}>
          <View style={{ gap: 2 }}>{primary.map((item) => <NavLink key={item.href} item={item} active={activeAt(item, path)} compact={compact} onPress={() => go(item.href)} />)}</View>
          <View style={{ height: 1, backgroundColor: g.border, marginVertical: 12, marginLeft: compact ? 0 : 20 }} />
          <View style={{ gap: 2 }}>{secondary.map((item) => <NavLink key={item.href} item={item} active={activeAt(item, path)} compact={compact} onPress={() => go(item.href)} />)}</View>
          <View style={{ flex: 1 }} />
          {!compact ? <View style={{ padding: 12, paddingLeft: 20 }}><SyncStatus sync={sync} /></View> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0, borderTopLeftRadius: 0 }}>
          {recovery}
          <View style={{ flex: 1 }}>{children}</View>
        </View>
      </View>
    </View>
  );
}

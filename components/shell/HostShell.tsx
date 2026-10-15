import { useState, type ReactNode } from "react";
import { Image, Pressable, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Download, FileText, Folder, LayoutGrid, LogOut, MoreHorizontal, ClipboardList, Settings } from "lucide-react-native";
import { useSync } from "../../src/features/cloud/hooks/useSync";
import useAuthStore, { useAuthActions } from "../../store/useAuthStore";
import { Dialog, Divider, Icon, IconButton, Notice, Text, ThemeToggle, radius, size, space, useLayout, useTheme } from "../../ui";
import type { IconComponent } from "../../ui/Icon";
import { useFocusRing } from "../../ui/interactive";
import { SyncStatus, type SyncState } from "./SyncStatus";

interface NavItem { href: string; label: string; icon: IconComponent; exact?: boolean; primary?: boolean }

// Same information architecture as before: six destinations. On phones the four most-used sit in
// the tab bar and the rest live under "More".
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, exact: true, primary: true },
  { href: "/dashboard/sessions", label: "Sessions", icon: ClipboardList, primary: true },
  { href: "/dashboard/forms", label: "Forms", icon: FileText, primary: true },
  { href: "/dashboard/subjects", label: "Folders", icon: Folder, primary: true },
  { href: "/dashboard/export", label: "Bulk export", icon: Download },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const isActive = (item: NavItem, path: string) => (item.exact ? path === item.href : path === item.href || path.startsWith(`${item.href}/`));

function Logo({ withName }: { withName?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
      <Image source={require("../../assets/logo.png")} accessibilityLabel="" style={{ width: 24, height: 24, tintColor: colors.text }} />
      {withName ? <Text variant="bodyStrong">Self Host Form</Text> : null}
    </View>
  );
}

function SidebarItem({ item, active, collapsed, onPress }: { item: NavItem; active: boolean; collapsed?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const { ring, onFocus, onBlur } = useFocusRing(colors);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onFocus={onFocus}
      onBlur={onBlur}
      style={(s) => [
        { flexDirection: "row", alignItems: "center", gap: space[3], height: 28, paddingHorizontal: collapsed ? 0 : space[3], justifyContent: collapsed ? "center" : "flex-start", borderRadius: radius.md },
        { backgroundColor: active ? colors.pressed : (s as { hovered?: boolean }).hovered ? colors.hover : "transparent" },
        ring,
      ]}
    >
      <Icon icon={item.icon} color={active ? colors.text : colors.textSecondary} />
      {collapsed ? null : <Text variant="small" tone={active ? "default" : "secondary"} style={{ fontWeight: "500" }}>{item.label}</Text>}
    </Pressable>
  );
}

function TabItem({ item, active, onPress }: { item: NavItem; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: active }} onPress={onPress} style={{ flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 2 }}>
      <Icon icon={item.icon} size={20} color={active ? colors.text : colors.textTertiary} />
      <Text variant="caption" tone={active ? "default" : "tertiary"}>{item.label}</Text>
    </Pressable>
  );
}

export function HostShell({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const { layout, width } = useLayout();
  const phone = layout === "phone";
  const router = useRouter();
  const path = usePathname();
  const { logout } = useAuthActions();
  const hasRecoveryQuestion = useAuthStore((s) => s.hasRecoveryQuestion);
  const sync = useSync() as unknown as SyncState;
  const [moreOpen, setMoreOpen] = useState(false);

  const go = (href: string) => { setMoreOpen(false); router.push(href as never); };
  const onLogout = async () => { setMoreOpen(false); await logout(); router.replace("/host/login"); };

  const banner =
    !hasRecoveryQuestion && path !== "/dashboard/settings" ? (
      <View style={{ padding: space[3], paddingBottom: 0 }}>
        <Notice tone="warning" actionLabel="Set it up" onAction={() => go("/dashboard/settings")}>
          {phone ? "No recovery question set. A forgotten password can't be reset." : "You haven't set a recovery question yet. Without one, a forgotten password can't be reset."}
        </Notice>
      </View>
    ) : null;

  if (layout === "phone") {
    const tabs = NAV_ITEMS.filter((i) => i.primary);
    const moreActive = NAV_ITEMS.some((i) => !i.primary && isActive(i, path));
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space[4], height: 48, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
          <Logo withName />
          <View style={{ flexDirection: "row", alignItems: "center" }}><ThemeToggle /><SyncStatus sync={sync} compact /></View>
        </View>
        <View style={{ flex: 1 }}>
          {banner}
          {children}
        </View>
        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View accessibilityRole="tablist" style={{ flexDirection: "row" }}>
            {tabs.map((i) => <TabItem key={i.href} item={i} active={isActive(i, path)} onPress={() => go(i.href)} />)}
            <TabItem item={{ href: "", label: "More", icon: MoreHorizontal }} active={moreActive} onPress={() => setMoreOpen(true)} />
          </View>
        </SafeAreaView>
        <Dialog visible={moreOpen} title="More" onClose={() => setMoreOpen(false)}>
          {NAV_ITEMS.filter((i) => !i.primary).map((i) => <SidebarItem key={i.href} item={i} active={isActive(i, path)} onPress={() => go(i.href)} />)}
          <Divider />
          <SyncStatus sync={sync} />
          <Divider />
          <SidebarItem item={{ href: "", label: "Log out", icon: LogOut }} active={false} onPress={onLogout} />
        </Dialog>
      </SafeAreaView>
    );
  }

  // Icon-only rail just for narrow tablets; a half-screen desktop window (about 960px) still has room for labels.
  const collapsed = layout === "tablet" && width < 840;
  const pad = collapsed ? space[2] : space[3];
  const current = NAV_ITEMS.find((i) => isActive(i, path));
  const manage = NAV_ITEMS.filter((i) => i.primary);
  const tools = NAV_ITEMS.filter((i) => !i.primary);
  const group = (label: string, items: NavItem[]) => (
    <View style={{ gap: 2 }}>
      {collapsed ? <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space[1] }} /> : <Text variant="caption" tone="tertiary" style={{ textTransform: "uppercase", letterSpacing: 0.6, paddingHorizontal: space[3], paddingBottom: space[1] }}>{label}</Text>}
      {items.map((i) => <SidebarItem key={i.href} item={i} active={isActive(i, path)} collapsed={collapsed} onPress={() => go(i.href)} />)}
    </View>
  );
  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space[4], backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Logo withName />
          {current ? (
            <>
              <Text tone="tertiary">/</Text>
              <Text variant="bodyStrong" tone="secondary">{current.label}</Text>
            </>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
          <SyncStatus sync={sync} compact />
          <ThemeToggle />
          <IconButton icon={LogOut} label="Log out" onPress={onLogout} />
        </View>
      </View>
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View role="navigation" style={{ width: collapsed ? 56 : size.sidebar, padding: pad, paddingTop: space[4], gap: space[4], backgroundColor: colors.bg, borderRightWidth: 1, borderRightColor: colors.border }}>
          {group("Manage", manage)}
          {group("Tools", tools)}
        </View>
        <View style={{ flex: 1 }}>
          {banner}
          {children}
        </View>
      </View>
    </View>
  );
}

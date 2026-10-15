import { Slot } from "expo-router";
import { HostShell } from "../../../components/shell/HostShell";

export default function DashboardLayout() {
  return (
    <HostShell>
      <Slot />
    </HostShell>
  );
}

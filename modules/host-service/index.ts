import { requireOptionalNativeModule } from "expo-modules-core";

// Android only. On iOS (and the web) there is no equivalent: iOS suspends apps in the background,
// so the teacher keeps the app open while hosting.
const Native = requireOptionalNativeModule<{ start(text: string): void; stop(): void }>("HostService");

export const isHostServiceAvailable = !!Native;

/** Shows the "hosting" notification and keeps the app alive in the background. */
export function startHostService(text: string): void {
  Native?.start(text);
}

export function stopHostService(): void {
  Native?.stop();
}

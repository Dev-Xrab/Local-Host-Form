import { Linking } from "react-native";

/** Opens a link in the device's own browser (needed for Google sign-in, which refuses embedded webviews). */
export async function openExternal(url: string): Promise<void> {
  await Linking.openURL(url);
}

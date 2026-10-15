import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";

export async function copyText(value: string): Promise<boolean> {
  try {
    return await Clipboard.setStringAsync(value);
  } catch {
    return false;
  }
}

/** Opens the system file picker for a JSON file and returns its text, or null if cancelled. */
export async function pickJsonText(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  if (asset.file) return asset.file.text(); // web
  return (await fetch(asset.uri)).text(); // native file:// uri
}

/** Opens the image picker and returns the chosen image as a data: URI (how images are stored on questions and banners), or null if cancelled. */
export async function pickImageDataUri(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: "image/*", copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  const blob: Blob = asset.file ?? (await (await fetch(asset.uri)).blob());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that image."));
    reader.readAsDataURL(blob);
  });
}

export interface PickedFile { name: string; size: number; mime: string; dataUri: string }

/** Opens the file picker for any file and returns it as a data: URI (how uploads are sent to the server), or null if cancelled. */
export async function pickFileDataUri(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  const blob: Blob = asset.file ?? (await (await fetch(asset.uri)).blob());
  const dataUri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(blob);
  });
  return { name: asset.name, size: asset.size ?? blob.size, mime: asset.mimeType || blob.type, dataUri };
}

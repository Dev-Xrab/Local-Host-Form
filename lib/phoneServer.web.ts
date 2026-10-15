// Browser and Electron already have a real server next to them; hosting on a phone doesn't apply.
export const canHostOnPhone = false;

export async function startPhoneHost(): Promise<string> {
  throw new Error("Hosting on a phone is only available in the mobile app.");
}

export async function stopPhoneHost(): Promise<void> {}

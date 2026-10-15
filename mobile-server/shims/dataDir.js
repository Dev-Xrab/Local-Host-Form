// Replaces server/db/dataDir.js on the phone: expo-sqlite chooses the actual storage location.
export const dataDir = process.env.DATA_DIR || "/shf-data";

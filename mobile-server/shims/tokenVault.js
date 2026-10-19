// Replaces server/oauth/tokenVault.js on the phone. The desktop vault encrypts tokens with AES-GCM
// using node:crypto and a key file, neither of which exist in the phone runtime. On Android the
// database lives in the app's private storage, which the OS encrypts at rest and no other app can
// read, so tokens are stored as-is here.
export const isEncrypted = () => false;
export const encryptToken = (plain) => String(plain);
export const decryptToken = (stored) => stored;

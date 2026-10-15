// Globals the server code expects from Node that React Native's JS runtime doesn't provide.
// Safe to import more than once.
import { Buffer } from "buffer";
import "react-native-url-polyfill/auto";
import * as ExpoCrypto from "expo-crypto";

if (typeof globalThis.Buffer === "undefined") globalThis.Buffer = Buffer;

// The `buffer` package predates Node's "base64url" encoding, which the server uses for session
// tokens and the OAuth PKCE challenge. Map it onto plain base64.
const toBase64Url = (b64) => b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (s) => s.replace(/-/g, "+").replace(/_/g, "/");
const isUrlEncoding = (enc) => typeof enc === "string" && enc.toLowerCase() === "base64url";
if (!Buffer.__shfBase64Url) {
  const toString = Buffer.prototype.toString;
  Buffer.prototype.toString = function (encoding, start, end) {
    if (isUrlEncoding(encoding)) return toBase64Url(toString.call(this, "base64", start, end));
    return toString.call(this, encoding, start, end);
  };
  const from = Buffer.from;
  Buffer.from = function (value, encodingOrOffset, length) {
    if (typeof value === "string" && isUrlEncoding(encodingOrOffset)) return from.call(this, fromBase64Url(value), "base64");
    return from.call(this, value, encodingOrOffset, length);
  };
  Buffer.__shfBase64Url = true;
}

// Secure randomness for session tokens, device ids and passwords' salts (see shims/node-crypto.js).
if (typeof globalThis.crypto?.getRandomValues !== "function") {
  const cryptoShim = {
    getRandomValues: (array) => ExpoCrypto.getRandomValues(array),
    randomUUID: () => ExpoCrypto.randomUUID(),
  };
  try {
    globalThis.crypto = cryptoShim;
  } catch {
    Object.defineProperty(globalThis, "crypto", { value: cryptoShim, configurable: true });
  }
}

// Used by the cloud sync health check and a few fetches; not present on every runtime.
if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout !== "function") {
  AbortSignal.timeout = (ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error("The operation timed out.")), ms);
    return controller.signal;
  };
}

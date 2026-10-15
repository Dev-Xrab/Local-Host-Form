// Byte/text helpers that behave the same on Node and in the phone's JS runtime (Hermes), which
// does not always ship TextEncoder/TextDecoder.

const hasTextCodec = typeof TextEncoder !== "undefined" && typeof TextDecoder !== "undefined";
const encoder = hasTextCodec ? new TextEncoder() : null;
const decoder = hasTextCodec ? new TextDecoder("utf-8") : null;

export function utf8Encode(str) {
  if (encoder) return encoder.encode(str);
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const d = str.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

export function utf8Decode(bytes) {
  if (decoder) return decoder.decode(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++];
    let cp;
    if (b < 0x80) cp = b;
    else if (b >= 0xc0 && b < 0xe0) cp = ((b & 31) << 6) | (bytes[i++] & 63);
    else if (b >= 0xe0 && b < 0xf0) cp = ((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
    else cp = ((b & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
    if (cp > 0xffff) {
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023));
    } else out += String.fromCharCode(cp);
  }
  return out;
}

/** Header text is ASCII/latin1; decoding byte-for-byte avoids any codec surprises. */
export function latin1Decode(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

export function concatBytes(chunks, total) {
  if (chunks.length === 1) return chunks[0];
  const size = total ?? chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** Index of the first occurrence of the 4-byte \r\n\r\n sequence, or -1. */
export function indexOfCrlfCrlf(bytes, from = 0) {
  for (let i = Math.max(0, from); i + 3 < bytes.length; i++) {
    if (bytes[i] === 13 && bytes[i + 1] === 10 && bytes[i + 2] === 13 && bytes[i + 3] === 10) return i;
  }
  return -1;
}

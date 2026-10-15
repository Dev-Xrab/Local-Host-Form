// Hermes (the phone's JS engine) ships a TextDecoder that only understands UTF-8, but the Excel and
// PDF libraries ask for latin1/ascii/utf-16 when they load. This wraps it so those labels work and
// anything else falls through to the built-in decoder. Web has the full TextDecoder already.
const NativeDecoder: typeof TextDecoder | undefined = (globalThis as { TextDecoder?: typeof TextDecoder }).TextDecoder;

const SINGLE_BYTE = new Set(["latin1", "iso-8859-1", "iso8859-1", "l1", "ascii", "us-ascii", "windows-1252", "cp1252", "binary"]);
const UTF16 = new Set(["utf-16le", "utf16le", "ucs-2", "ucs2", "utf-16"]);

const toBytes = (input?: ArrayBuffer | ArrayBufferView): Uint8Array =>
  !input ? new Uint8Array(0) : input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);

class CompatTextDecoder {
  readonly encoding: string;
  readonly fatal: boolean;
  readonly ignoreBOM: boolean;
  private inner: TextDecoder | null = null;
  private kind: "single" | "utf16" | "native";

  constructor(label = "utf-8", options?: TextDecoderOptions) {
    const name = String(label).trim().toLowerCase();
    this.fatal = !!options?.fatal;
    this.ignoreBOM = !!options?.ignoreBOM;
    if (SINGLE_BYTE.has(name)) {
      this.kind = "single";
      this.encoding = "windows-1252";
    } else if (UTF16.has(name)) {
      this.kind = "utf16";
      this.encoding = "utf-16le";
    } else {
      this.kind = "native";
      this.inner = new NativeDecoder!(label, options);
      this.encoding = this.inner.encoding;
    }
  }

  decode(input?: ArrayBuffer | ArrayBufferView, options?: TextDecodeOptions): string {
    if (this.kind === "native") return this.inner!.decode(input, options);
    const bytes = toBytes(input);
    const units: number[] = [];
    if (this.kind === "single") for (let i = 0; i < bytes.length; i++) units.push(bytes[i]);
    else for (let i = 0; i + 1 < bytes.length; i += 2) units.push(bytes[i] | (bytes[i + 1] << 8));
    let out = "";
    for (let i = 0; i < units.length; i += 8192) out += String.fromCharCode(...units.slice(i, i + 8192));
    return out;
  }
}

if (NativeDecoder) {
  try {
    new NativeDecoder("latin1");
  } catch {
    (globalThis as { TextDecoder: unknown }).TextDecoder = CompatTextDecoder;
  }
}

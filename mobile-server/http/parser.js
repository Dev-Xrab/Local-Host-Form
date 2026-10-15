// Incremental HTTP/1.1 request parser. Feed it byte chunks as they arrive from a socket; it hands
// back each complete request. Supports Content-Length and chunked bodies, `Expect: 100-continue`,
// and enforces size limits so a hostile client can't make the phone buffer unbounded data.
import { concatBytes, indexOfCrlfCrlf, latin1Decode } from "./bytes.js";

export class HttpParseError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const MAX_HEADER_BYTES = 32 * 1024;
const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export class HttpRequestParser {
  /**
   * @param {object} opts
   * @param {number} opts.maxBodyBytes  Hard cap on a single request body (the JSON middleware applies its own, lower, per-route limits).
   * @param {() => void} [opts.onExpectContinue]  Called when the client waits for `100 Continue` before sending the body.
   */
  constructor({ maxBodyBytes = 14 * 1024 * 1024, onExpectContinue } = {}) {
    this.maxBodyBytes = maxBodyBytes;
    this.onExpectContinue = onExpectContinue;
    this.head = new Uint8Array(0); // bytes of the header block while it is still arriving
    this.state = "head"; // head | body | chunked
    this.pending = null; // request whose body is being read
    this.chunks = [];
    this.received = 0;
    this.expected = 0;
    this.chunkBuf = new Uint8Array(0); // working buffer for chunked decoding
  }

  /** @param {Uint8Array} bytes  @returns {object[]} completed requests (usually 0 or 1) */
  feed(bytes) {
    const done = [];
    let input = bytes;
    while (input && input.length) {
      if (this.state === "head") {
        const joined = new Uint8Array(this.head.length + input.length);
        joined.set(this.head, 0);
        joined.set(input, this.head.length);
        const end = indexOfCrlfCrlf(joined, Math.max(0, this.head.length - 3));
        if (end === -1) {
          if (joined.length > MAX_HEADER_BYTES) throw new HttpParseError(431, "Request header fields too large");
          this.head = joined;
          return done;
        }
        if (end > MAX_HEADER_BYTES) throw new HttpParseError(431, "Request header fields too large");
        this.pending = this.#parseHead(latin1Decode(joined.subarray(0, end)));
        this.head = new Uint8Array(0);
        input = joined.subarray(end + 4);
        const te = (this.pending.headers["transfer-encoding"] || "").toLowerCase();
        const len = this.pending.headers["content-length"];

        if (te.includes("chunked")) {
          this.state = "chunked";
          this.chunkBuf = new Uint8Array(0);
          this.chunks = [];
          this.received = 0;
        } else if (len !== undefined) {
          if (!/^\d+$/.test(len)) throw new HttpParseError(400, "Bad Content-Length");
          this.expected = Number(len);
          if (this.expected > this.maxBodyBytes) throw new HttpParseError(413, "Payload too large");
          this.chunks = [];
          this.received = 0;
          this.state = "body";
        } else {
          this.expected = 0;
          this.state = "body";
        }

        if (this.state !== "head" && (this.expected > 0 || this.state === "chunked") && /100-continue/i.test(this.pending.headers.expect || "")) {
          this.onExpectContinue?.();
        }
      }

      if (this.state === "body") {
        const need = this.expected - this.received;
        const take = input.subarray(0, Math.min(need, input.length));
        if (take.length) {
          this.chunks.push(take);
          this.received += take.length;
        }
        input = input.subarray(take.length);
        if (this.received === this.expected) done.push(this.#finish());
      } else if (this.state === "chunked") {
        input = this.#feedChunked(input, done);
      }
    }
    // A request that had no body completes the moment its head does.
    if (this.state === "body" && this.pending && this.expected === 0) done.push(this.#finish());
    return done;
  }

  #finish() {
    const req = this.pending;
    req.body = this.chunks.length ? concatBytes(this.chunks, this.received) : new Uint8Array(0);
    this.pending = null;
    this.chunks = [];
    this.received = 0;
    this.expected = 0;
    this.state = "head";
    return req;
  }

  #feedChunked(input, done) {
    const joined = new Uint8Array(this.chunkBuf.length + input.length);
    joined.set(this.chunkBuf, 0);
    joined.set(input, this.chunkBuf.length);
    let pos = 0;
    for (;;) {
      const lineEnd = this.#indexOfCrlf(joined, pos);
      if (lineEnd === -1) break;
      const sizeLine = latin1Decode(joined.subarray(pos, lineEnd)).split(";")[0].trim();
      if (!/^[0-9a-fA-F]+$/.test(sizeLine)) throw new HttpParseError(400, "Bad chunk size");
      const size = parseInt(sizeLine, 16);
      if (size === 0) {
        // Skip optional trailers up to the final blank line.
        const trailerEnd = indexOfCrlfCrlf(joined, lineEnd);
        const finalEnd = joined.length >= lineEnd + 4 && joined[lineEnd + 2] === 13 && joined[lineEnd + 3] === 10 ? lineEnd + 4 : trailerEnd === -1 ? -1 : trailerEnd + 4;
        if (finalEnd === -1) break;
        done.push(this.#finish());
        this.chunkBuf = new Uint8Array(0);
        return joined.subarray(finalEnd);
      }
      if (this.received + size > this.maxBodyBytes) throw new HttpParseError(413, "Payload too large");
      const dataStart = lineEnd + 2;
      if (joined.length < dataStart + size + 2) break;
      this.chunks.push(joined.slice(dataStart, dataStart + size));
      this.received += size;
      pos = dataStart + size + 2;
    }
    this.chunkBuf = joined.slice(pos);
    return null;
  }

  #indexOfCrlf(bytes, from) {
    for (let i = from; i + 1 < bytes.length; i++) if (bytes[i] === 13 && bytes[i + 1] === 10) return i;
    return -1;
  }

  #parseHead(text) {
    const lines = text.split("\r\n");
    const m = /^([A-Z]+) (\S+) HTTP\/(1\.[01])$/.exec(lines[0]);
    if (!m) throw new HttpParseError(400, "Malformed request line");
    const [, method, url, httpVersion] = m;
    const headers = Object.create(null);
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const colon = line.indexOf(":");
      if (colon <= 0) throw new HttpParseError(400, "Malformed header");
      const name = line.slice(0, colon);
      if (!TOKEN.test(name)) throw new HttpParseError(400, "Malformed header name");
      const key = name.toLowerCase();
      const value = line.slice(colon + 1).trim();
      // Repeated headers fold into one comma-separated value, except Set-Cookie (never sent by clients).
      headers[key] = key in headers ? `${headers[key]}, ${value}` : value;
    }
    return { method, url, httpVersion, headers, body: null };
  }
}

const REASONS = {
  100: "Continue", 200: "OK", 201: "Created", 204: "No Content", 301: "Moved Permanently", 302: "Found", 304: "Not Modified",
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed", 408: "Request Timeout",
  409: "Conflict", 413: "Payload Too Large", 415: "Unsupported Media Type", 422: "Unprocessable Entity", 429: "Too Many Requests",
  431: "Request Header Fields Too Large", 500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable",
};
export const reasonPhrase = (status) => REASONS[status] || "Status";

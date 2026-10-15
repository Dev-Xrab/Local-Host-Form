// Serves HTTP on one TCP connection. Works with any socket shaped like Node's net.Socket
// (on the phone: react-native-tcp-socket; in tests: Node's `net`).
//
// Deliberately simple: one request per connection, then `Connection: close`. Browsers and fetch
// handle that fine, and it removes every keep-alive / pipelining edge case from a server that
// runs inside a phone app.
import { handleRequest, serializeResponse } from "./miniExpress.js";
import { HttpParseError, HttpRequestParser } from "./parser.js";
import { utf8Encode } from "./bytes.js";

const IDLE_MS = 30_000;

function errorBytes(status, message) {
  const body = utf8Encode(JSON.stringify({ error: message }));
  return serializeResponse(status, { "content-type": "application/json; charset=utf-8" }, body, body.length);
}

export function attachConnection(app, socket, { maxBodyBytes, log = () => {} } = {}) {
  let closed = false;
  let handled = false;
  let idle = null;

  const close = () => {
    if (closed) return;
    closed = true;
    if (idle) clearTimeout(idle);
    try {
      socket.destroy();
    } catch {
      // already gone
    }
  };

  const respond = (bytes) => {
    if (closed) return;
    closed = true;
    if (idle) clearTimeout(idle);
    try {
      socket.end(bytes);
    } catch (err) {
      log("write failed", err);
    }
  };

  const resetIdle = () => {
    if (idle) clearTimeout(idle);
    idle = setTimeout(() => {
      if (!handled) respond(errorBytes(408, "Request timeout"));
      else close();
    }, IDLE_MS);
  };

  const parser = new HttpRequestParser({
    maxBodyBytes,
    onExpectContinue: () => {
      try {
        socket.write(utf8Encode("HTTP/1.1 100 Continue\r\n\r\n"));
      } catch {
        // connection already closing
      }
    },
  });

  resetIdle();

  socket.on("data", (chunk) => {
    if (closed || handled) return;
    resetIdle();
    let requests;
    try {
      requests = parser.feed(typeof chunk === "string" ? utf8Encode(chunk) : chunk);
    } catch (err) {
      handled = true;
      return respond(errorBytes(err instanceof HttpParseError ? err.status : 400, err.message));
    }
    if (!requests.length) return;
    handled = true;
    handleRequest(app, requests[0], { remoteAddress: socket.remoteAddress, remotePort: socket.remotePort }, respond);
  });
  socket.on("error", (err) => {
    log("socket error", err?.message);
    close();
  });
  socket.on("close", () => {
    closed = true;
    if (idle) clearTimeout(idle);
  });
}

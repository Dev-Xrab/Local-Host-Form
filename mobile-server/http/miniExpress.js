// A small Express-compatible framework: just the parts server/ actually uses (routers with
// mergeParams, path params, middleware + error middleware, async handlers, json(), and the
// req/res helpers the routes call). It lets the real route files run unchanged inside the phone
// app, where Node's `http` module and the real Express don't exist.
//
// Not a general-purpose Express: no view engines, no streaming responses, no router.param, etc.
import { latin1Decode, utf8Decode, utf8Encode } from "./bytes.js";
import { reasonPhrase } from "./parser.js";

// ---------------------------------------------------------------- path matching

function escapeRegex(s) {
  return s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

/** Compiles an Express-style path ("/forms/:id", "/", "/files/*") or passes a RegExp through. */
function compilePath(path, { end }) {
  if (path instanceof RegExp) return { regex: path, keys: [], isRegex: true };
  const keys = [];
  let pattern = "";
  const parts = path.split("/").filter(Boolean);
  for (const part of parts) {
    if (part === "*") {
      keys.push("0");
      pattern += "/(.*)";
    } else if (part.startsWith(":")) {
      keys.push(part.slice(1).replace(/\?$/, ""));
      pattern += part.endsWith("?") ? "(?:/([^/]+))?" : "/([^/]+)";
    } else {
      pattern += "/" + escapeRegex(part);
    }
  }
  const body = pattern === "" ? "" : pattern;
  const regex = end ? new RegExp(`^${body}/?$`, "i") : new RegExp(`^${body}(?=/|$)`, "i");
  return { regex, keys, isRegex: false };
}

function matchPath(layer, pathname) {
  const m = layer.regex.exec(pathname);
  if (!m) return null;
  const params = {};
  layer.keys.forEach((k, i) => {
    if (m[i + 1] !== undefined) {
      try {
        params[k] = decodeURIComponent(m[i + 1]);
      } catch {
        params[k] = m[i + 1];
      }
    }
  });
  return { params, matched: layer.isRegex ? "" : m[0] };
}

// ---------------------------------------------------------------- routers

const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

function flatten(list) {
  return list.flat(Infinity).filter((h) => typeof h === "function");
}

function callHandler(fn, err, req, res, next) {
  try {
    const arity = fn.length;
    let result;
    if (err) {
      if (arity !== 4) return next(err); // only error middleware handles errors
      result = fn(err, req, res, next);
    } else {
      if (arity === 4) return next(); // error middleware is skipped on the happy path
      result = fn(req, res, next);
    }
    // Express 5 forwards rejected promises from async handlers to the error handler.
    if (result && typeof result.then === "function") result.then(undefined, next);
  } catch (e) {
    next(e);
  }
}

function createRouter({ mergeParams = false } = {}) {
  const stack = []; // { method, compiled, handlers, mount }

  function router(req, res, next) {
    router.handle(req, res, next);
  }

  router.handle = function handle(req, res, done) {
    const parentParams = req.params || {};
    const originalUrl = req.url;
    const originalBase = req.baseUrl || "";
    let index = 0;
    let layerHandlers = null;
    let handlerIndex = 0;

    const restore = () => {
      req.url = originalUrl;
      req.baseUrl = originalBase;
      req.params = parentParams;
    };

    const finish = (err) => {
      restore();
      done(err);
    };

    const nextLayer = (err) => {
      // Continue inside the current layer's handler list first.
      if (layerHandlers && handlerIndex < layerHandlers.length) {
        const fn = layerHandlers[handlerIndex++];
        return callHandler(fn, err, req, res, nextLayer);
      }
      layerHandlers = null;
      // Handlers may rewrite req.url (mounts); each layer is matched against the router-relative URL.
      req.url = originalUrl;
      req.baseUrl = originalBase;

      while (index < stack.length) {
        const layer = stack[index++];
        if (layer.method && layer.method !== req.method && !(layer.method === "GET" && req.method === "HEAD")) continue;
        const pathname = req.pathOf(originalUrl);
        const m = matchPath(layer.compiled, pathname);
        if (!m) continue;

        req.params = mergeParams ? { ...parentParams, ...m.params } : { ...m.params };
        if (layer.mount) {
          const rest = originalUrl.slice(m.matched.length) || "/";
          req.url = rest.startsWith("/") || rest.startsWith("?") ? (rest.startsWith("?") ? "/" + rest : rest) : "/" + rest;
          req.baseUrl = originalBase + m.matched;
        }
        layerHandlers = layer.handlers;
        handlerIndex = 0;
        return nextLayer(err);
      }
      return finish(err);
    };

    nextLayer();
  };

  router.use = function use(...args) {
    let path = "/";
    if (typeof args[0] === "string" || args[0] instanceof RegExp) path = args.shift();
    const handlers = flatten(args);
    stack.push({ method: null, compiled: compilePath(path, { end: false }), handlers, mount: true });
    return router;
  };

  for (const method of METHODS) {
    router[method] = function route(path, ...args) {
      stack.push({ method: method.toUpperCase(), compiled: compilePath(path, { end: true }), handlers: flatten(args), mount: false });
      return router;
    };
  }
  router.all = function all(path, ...args) {
    stack.push({ method: null, compiled: compilePath(path, { end: true }), handlers: flatten(args), mount: false });
    return router;
  };

  return router;
}

// ---------------------------------------------------------------- request / response

const pathOf = (url) => {
  const q = url.indexOf("?");
  const p = q === -1 ? url : url.slice(0, q);
  return p || "/";
};

function parseQuery(url) {
  const q = url.indexOf("?");
  const out = {};
  if (q === -1) return out;
  for (const pair of url.slice(q + 1).split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const dec = (s) => {
      try {
        return decodeURIComponent(s.replace(/\+/g, " "));
      } catch {
        return s;
      }
    };
    const key = dec(eq === -1 ? pair : pair.slice(0, eq));
    const value = eq === -1 ? "" : dec(pair.slice(eq + 1));
    if (key in out) out[key] = [].concat(out[key], value);
    else out[key] = value;
  }
  return out;
}

/** Wraps a parsed HTTP request into the Express-shaped `req` the routes expect. */
export function createRequest(parsed, socketInfo = {}) {
  const req = {
    method: parsed.method,
    url: parsed.url,
    originalUrl: parsed.url,
    baseUrl: "",
    headers: parsed.headers,
    rawBody: parsed.body,
    params: {},
    protocol: socketInfo.encrypted ? "https" : "http",
    socket: { remoteAddress: socketInfo.remoteAddress || "", remotePort: socketInfo.remotePort },
    pathOf,
    get(name) {
      return this.headers[String(name).toLowerCase()];
    },
  };
  req.header = req.get;
  Object.defineProperty(req, "path", { get: () => pathOf(req.url) });
  Object.defineProperty(req, "query", { get: () => parseQuery(req.originalUrl) });
  Object.defineProperty(req, "ip", { get: () => req.socket.remoteAddress });
  return req;
}

/**
 * Builds the Express-shaped `res`. Nothing is written until the handler finishes; `onSend` then
 * receives the complete status, headers and body bytes and puts them on the wire.
 */
export function createResponse(onSend, { head = false } = {}) {
  const headers = {}; // lowercase name -> string | string[]
  const listeners = {};
  const res = {
    statusCode: 200,
    headersSent: false,
    finished: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = value;
      return this;
    },
    set(name, value) {
      if (name && typeof name === "object") for (const [k, v] of Object.entries(name)) this.setHeader(k, v);
      else this.setHeader(name, value);
      return this;
    },
    getHeader(name) {
      return headers[String(name).toLowerCase()];
    },
    get(name) {
      return this.getHeader(name);
    },
    removeHeader(name) {
      delete headers[String(name).toLowerCase()];
    },
    type(t) {
      return this.setHeader("Content-Type", /\//.test(t) ? t : t === "json" ? "application/json" : t === "html" ? "text/html" : t);
    },
    json(obj) {
      if (!this.getHeader("content-type")) this.setHeader("Content-Type", "application/json; charset=utf-8");
      return this.end(utf8Encode(JSON.stringify(obj)));
    },
    send(body) {
      if (body === undefined || body === null) return this.end();
      if (typeof body === "string") {
        if (!this.getHeader("content-type")) this.setHeader("Content-Type", "text/html; charset=utf-8");
        return this.end(utf8Encode(body));
      }
      if (body instanceof Uint8Array) {
        if (!this.getHeader("content-type")) this.setHeader("Content-Type", "application/octet-stream");
        return this.end(body);
      }
      return this.json(body);
    },
    redirect(arg1, arg2) {
      const [status, url] = typeof arg1 === "number" ? [arg1, arg2] : [302, arg1];
      this.statusCode = status;
      this.setHeader("Location", url);
      return this.end();
    },
    end(chunk) {
      if (this.finished) return this;
      let body = new Uint8Array(0);
      if (typeof chunk === "string") body = utf8Encode(chunk);
      else if (chunk instanceof Uint8Array) body = chunk;
      this.finished = true;
      this.headersSent = true;
      onSend({ status: this.statusCode, headers, body: head ? new Uint8Array(0) : body, contentLength: body.length });
      for (const fn of listeners.finish || []) fn();
      return this;
    },
    on(event, fn) {
      (listeners[event] ||= []).push(fn);
      return this;
    },
    once(event, fn) {
      return this.on(event, fn);
    },
  };
  return res;
}

// ---------------------------------------------------------------- body parsing

/** Mirrors express.json({ limit }): same error shapes the app's error handler already understands. */
function json({ limit = 100 * 1024 } = {}) {
  const max = typeof limit === "number" ? limit : parseLimit(limit);
  return function jsonParser(req, res, next) {
    if (req._body) return next();
    const type = String(req.headers["content-type"] || "");
    const raw = req.rawBody;
    if (!raw || raw.length === 0 || !/json/i.test(type)) return next();
    if (raw.length > max) {
      const err = new Error("request entity too large");
      err.type = "entity.too.large";
      err.status = 413;
      return next(err);
    }
    try {
      req.body = JSON.parse(utf8Decode(raw));
      req._body = true;
      next();
    } catch (e) {
      const err = new Error("Malformed JSON");
      err.type = "entity.parse.failed";
      err.status = 400;
      err.cause = e;
      next(err);
    }
  };
}

function parseLimit(text) {
  const m = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i.exec(String(text).trim());
  if (!m) return 100 * 1024;
  const n = Number(m[1]);
  const unit = (m[2] || "b").toLowerCase();
  return Math.floor(n * { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 ** 3 }[unit]);
}

// ---------------------------------------------------------------- app + HTTP bridge

function createApp() {
  const app = createRouter();
  const settings = {};
  app.set = (k, v) => {
    settings[k] = v;
    return app;
  };
  app.getSetting = (k) => settings[k];
  return app;
}

/**
 * Connects an app to raw bytes. `handleParsed(parsedRequest, socketInfo, write)` runs the request
 * through the app and calls `write(responseBytes)` exactly once.
 */
export function handleRequest(app, parsed, socketInfo, write) {
  const req = createRequest(parsed, socketInfo);
  const res = createResponse(
    ({ status, headers, body, contentLength }) => write(serializeResponse(status, headers, body, contentLength)),
    { head: parsed.method === "HEAD" }
  );
  app(req, res, (err) => {
    if (res.finished) return;
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal server error" });
    }
    res.status(404).json({ error: "Not found" });
  });
}

export function serializeResponse(status, headers, body, contentLength) {
  const lines = [`HTTP/1.1 ${status} ${reasonPhrase(status)}`];
  const out = { ...headers };
  out["content-length"] = String(contentLength);
  out.connection = "close";
  if (!out.date) out.date = new Date().toUTCString();
  for (const [name, value] of Object.entries(out)) {
    if (Array.isArray(value)) for (const v of value) lines.push(`${name}: ${v}`);
    else lines.push(`${name}: ${value}`);
  }
  const head = utf8Encode(lines.join("\r\n") + "\r\n\r\n");
  const bytes = new Uint8Array(head.length + body.length);
  bytes.set(head, 0);
  bytes.set(body, head.length);
  return bytes;
}

// ---------------------------------------------------------------- public surface (express-compatible)

export default function express() {
  return createApp();
}
express.Router = createRouter;
express.json = json;
export const Router = createRouter;
export { json };
export { latin1Decode };

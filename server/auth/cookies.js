const COOKIE_NAME = "stonearch_session";

// Native apps (Android) have no cookie jar, so they send the same session token as a Bearer
// header. It is the same random token the cookie carries, validated the same way, and a
// cross-site page can't attach it, so it is not an ambient credential and needs no CSRF check.
export function readSessionToken(req) {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  const header = req.headers.cookie;
  if (!header) return null;
  const match = header.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.slice(COOKIE_NAME.length + 1)) : null;
}

// Only clients that ask for it (the native app, via X-Auth-Mode: bearer) get the token in the
// response body; browsers keep it in the HttpOnly cookie, out of reach of page scripts.
export function wantsBearer(req) {
  return req.headers["x-auth-mode"] === "bearer";
}

export function setSessionCookie(res, token, expiresAt) {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
  ];
  res.setHeader("Set-Cookie", attrs.join("; "));
}

export function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  );
}

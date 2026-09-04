const COOKIE_NAME = "stonearch_session";

export function readSessionToken(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  const match = header.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.slice(COOKIE_NAME.length + 1)) : null;
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

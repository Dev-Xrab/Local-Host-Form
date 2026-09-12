import { findSessionUser } from "./repository.js";

// Resolves req.user/req.deviceId from the bearer token itself — the authenticated identity is
// never taken from any client-supplied body/query field, so nothing downstream needs to (or
// should) trust a client-sent user_id.
export async function requireBearer(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token." });

  const session = await findSessionUser(token);
  if (!session) return res.status(401).json({ error: "Invalid or expired session." });

  req.userId = session.userId;
  req.deviceId = session.deviceId;
  next();
}

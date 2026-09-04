import { isValidAuthSession } from "./repository.js";
import { readSessionToken } from "./cookies.js";

export function requireAuth(req, res, next) {
  const token = readSessionToken(req);
  if (!isValidAuthSession(token)) {
    return res.status(401).json({ error: "Not signed in." });
  }
  next();
}

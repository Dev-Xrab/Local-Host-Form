import { isValidAuthSession } from "./repository.js";
import { readSessionToken } from "./cookies.js";
import { isTunnelRequest } from "../security/network.js";
import { isRemoteAdminEnabled } from "./remoteAdmin.js";

// Host sessions work on the LAN. Tunnel requests require a separately enrolled remote session.
export function requireAuth(req, res, next) {
  const token = readSessionToken(req);
  const remote = isTunnelRequest(req);
  if (remote && !isRemoteAdminEnabled()) {
    return res.status(403).json({ error: "Remote admin is not enabled on this server." });
  }
  if (!isValidAuthSession(token, { remote })) {
    return res.status(401).json({ error: "Not signed in." });
  }
  next();
}

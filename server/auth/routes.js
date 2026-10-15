import { Router } from "express";
import * as authRepo from "./repository.js";
import { readSessionToken, setSessionCookie, clearSessionCookie, wantsBearer } from "./cookies.js";
import { requireAuth } from "./middleware.js";
import { blockTunnel, requireLocalConsole } from "../security/network.js";
import {
  loginLimiter,
  globalLoginLimiter,
  recoveryLimiter,
  sensitiveAccountLimiter,
} from "../security/rateLimits.js";

export const authRouter = Router();

const tooShortMessage = (label) => `${label} must be at least ${authRepo.MIN_PASSWORD_LENGTH} characters.`;

// Public, but only from the host computer itself: only ever succeeds once, to claim a server
// nobody owns yet (see createOwnerAccount's already_exists guard). Before this was restricted,
// whoever reached a freshly-installed (or just-wiped) server first — any student already on the
// Wi-Fi — could set the owner password. Logs the new owner in immediately, the same as /login
// would, so there's no separate "now go log in with what you just set" step.
authRouter.post("/setup", requireLocalConsole, (req, res) => {
  const { password } = req.body || {};
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "A password is required." });
  }

  const result = authRepo.createOwnerAccount(password);
  if (result === "already_exists") {
    return res.status(409).json({ error: "This server already has an owner. Log in instead." });
  }
  if (result === "too_short") {
    return res.status(400).json({ error: tooShortMessage("Password") });
  }

  const { token, expiresAt } = authRepo.createAuthSession();
  setSessionCookie(res, token, expiresAt);
  res.json({ ok: true, hasRecoveryQuestion: false, ...(wantsBearer(req) && { token }) });
});

// Reachable from phones/tablets on the LAN (hosts manage sessions from them), so this is the
// endpoint password-guessing would target: limited per client and across the whole LAN.
authRouter.post("/login", blockTunnel, loginLimiter, globalLoginLimiter, (req, res) => {
  const { password } = req.body || {};
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Password is required." });
  }

  if (!authRepo.verifyHostPassword(password)) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  const { token, expiresAt } = authRepo.createAuthSession();
  setSessionCookie(res, token, expiresAt);
  res.json({
    ok: true,
    hasRecoveryQuestion: authRepo.hasRecoveryQuestion(),
    ...(wantsBearer(req) && { token }),
  });
});

authRouter.post("/logout", (req, res) => {
  authRepo.deleteAuthSession(readSessionToken(req));
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get("/me", (req, res) => {
  const authenticated = authRepo.isValidAuthSession(readSessionToken(req));
  res.json({
    authenticated,
    // Unlike isLogin/hasRecoveryQuestion, this has to be readable before anyone is logged
    // in — it's what tells the login screen to show "create your account" instead.
    needsSetup: !authRepo.hasOwner(),
    hasRecoveryQuestion: authenticated ? authRepo.hasRecoveryQuestion() : false,
  });
});

authRouter.post("/change-password", requireAuth, sensitiveAccountLimiter, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword || typeof oldPassword !== "string" || typeof newPassword !== "string") {
    return res.status(400).json({ error: "Both your current and new password are required." });
  }

  const result = authRepo.changeHostPassword(oldPassword, newPassword);
  if (result === "wrong_password") {
    return res.status(401).json({ error: "Your current password is incorrect." });
  }
  if (result === "too_short") {
    return res.status(400).json({ error: tooShortMessage("New password") });
  }

  // Changing the password signs out every device; keep the one that made the change signed in.
  const { token, expiresAt } = authRepo.createAuthSession();
  setSessionCookie(res, token, expiresAt);
  res.json({ ok: true });
});

// Only from the host computer: the question is a hint toward the recovery answer, which is
// itself a second way in, so neither is offered to other devices on the network.
authRouter.get("/recovery-question", requireLocalConsole, (req, res) => {
  res.json({ question: authRepo.getRecoveryQuestion() });
});

authRouter.post("/recovery-question", requireAuth, sensitiveAccountLimiter, (req, res) => {
  const { currentPassword, question, answer } = req.body || {};
  if (!currentPassword || typeof currentPassword !== "string") {
    return res.status(400).json({ error: "Your current password is required to set a recovery question." });
  }

  const result = authRepo.setRecoveryQuestion(currentPassword, question, answer);
  if (result === "wrong_password") {
    return res.status(401).json({ error: "Your current password is incorrect." });
  }
  if (result === "question_required") {
    return res.status(400).json({ error: "A recovery question is required." });
  }
  if (result === "answer_required") {
    return res.status(400).json({ error: "An answer is required." });
  }
  if (result === "too_long") {
    return res.status(400).json({ error: "The recovery question or answer is too long." });
  }
  res.json({ ok: true });
});

// Only from the host computer, and rate-limited: a recovery answer (a pet's name, a city) is far
// easier to guess than a password, and a correct one replaces the password outright.
authRouter.post("/recover-password", requireLocalConsole, recoveryLimiter, (req, res) => {
  const { answer, newPassword } = req.body || {};
  const result = authRepo.resetPasswordWithRecovery(answer, newPassword);
  if (result === "not_configured") {
    return res.status(400).json({ error: "No recovery question has been set up on this server." });
  }
  if (result === "wrong_answer") {
    return res.status(401).json({ error: "That answer doesn't match." });
  }
  if (result === "too_short") {
    return res.status(400).json({ error: tooShortMessage("New password") });
  }
  res.json({ ok: true });
});

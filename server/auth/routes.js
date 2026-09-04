import { Router } from "express";
import * as authRepo from "./repository.js";
import { readSessionToken, setSessionCookie, clearSessionCookie } from "./cookies.js";
import { requireAuth } from "./middleware.js";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
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
    isDefaultPassword: authRepo.isDefaultPassword(),
    hasRecoveryQuestion: authRepo.hasRecoveryQuestion(),
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
    isDefaultPassword: authenticated ? authRepo.isDefaultPassword() : false,
    hasRecoveryQuestion: authenticated ? authRepo.hasRecoveryQuestion() : false,
  });
});

authRouter.post("/change-password", requireAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "Both your current and new password are required." });
  }

  const result = authRepo.changeHostPassword(oldPassword, newPassword);
  if (result === "wrong_password") {
    return res.status(401).json({ error: "Your current password is incorrect." });
  }
  if (result === "too_short") {
    return res.status(400).json({ error: "New password must be at least 4 characters." });
  }
  res.json({ ok: true });
});

// Public: read only the question text (never the answer) so a "Forgot password?" screen
// can display it before the host proves they know the answer.
authRouter.get("/recovery-question", (req, res) => {
  res.json({ question: authRepo.getRecoveryQuestion() });
});

authRouter.post("/recovery-question", requireAuth, (req, res) => {
  const { currentPassword, question, answer } = req.body || {};
  if (!currentPassword) {
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
  res.json({ ok: true });
});

authRouter.post("/recover-password", (req, res) => {
  const { answer, newPassword } = req.body || {};
  const result = authRepo.resetPasswordWithRecovery(answer, newPassword);
  if (result === "not_configured") {
    return res.status(400).json({ error: "No recovery question has been set up on this server." });
  }
  if (result === "wrong_answer") {
    return res.status(401).json({ error: "That answer doesn't match." });
  }
  if (result === "too_short") {
    return res.status(400).json({ error: "New password must be at least 4 characters." });
  }
  res.json({ ok: true });
});

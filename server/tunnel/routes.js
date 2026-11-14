import { Router } from "express";
import { getStatus, startTunnel, stopTunnel } from "./service.js";
import { saveAllowedEmails } from "./settings.js";

export const tunnelRouter = Router();

tunnelRouter.get("/status", (req, res) => {
  res.json(getStatus());
});

tunnelRouter.put("/access", (req, res) => {
  const status = getStatus();
  if (status.status !== "idle") {
    return res.status(409).json({ error: "Stop remote access before changing its email list." });
  }
  try {
    saveAllowedEmails(req.body?.allowedEmails);
    res.json(getStatus());
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

tunnelRouter.post("/start", (req, res) => {
  res.json(startTunnel());
});

tunnelRouter.post("/stop", (req, res) => {
  res.json(stopTunnel());
});

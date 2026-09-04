import { Router } from "express";
import { clearAllData } from "./repository.js";

export const maintenanceRouter = Router();

maintenanceRouter.post("/clear-data", (req, res) => {
  clearAllData();
  res.json({ ok: true });
});

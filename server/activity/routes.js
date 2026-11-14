import { Router } from "express";
import { db } from "../db/index.js";

export const activityRouter = Router();

const recentActivity = db.prepare(`
  SELECT * FROM (
    SELECT 'form_created' AS type, f.id AS targetId, f.title AS label, f.created_at AS occurredAt
      FROM forms f
    UNION ALL
    SELECT 'form_updated', f.id, f.title, f.updated_at FROM forms f WHERE f.updated_at > f.created_at
    UNION ALL
    SELECT 'folder_created', s.id, s.name, s.created_at FROM subjects s WHERE s.is_default = 0
    UNION ALL
    SELECT 'folder_updated', s.id, s.name, s.updated_at FROM subjects s WHERE s.is_default = 0 AND s.updated_at > s.created_at
    UNION ALL
    SELECT 'session_created', s.id, COALESCE(NULLIF(s.name, ''), f.title), s.created_at
      FROM sessions s JOIN forms f ON f.id = s.form_id
      WHERE s.code NOT LIKE 'SYNCED-%' AND s.code NOT LIKE 'IMPORT-%' AND s.code NOT LIKE 'GOOGLE-%'
    UNION ALL
    SELECT 'session_started', s.id, COALESCE(NULLIF(s.name, ''), f.title), s.started_at
      FROM sessions s JOIN forms f ON f.id = s.form_id WHERE s.started_at IS NOT NULL
    UNION ALL
    SELECT 'session_ended', s.id, COALESCE(NULLIF(s.name, ''), f.title), s.ended_at
      FROM sessions s JOIN forms f ON f.id = s.form_id WHERE s.ended_at IS NOT NULL
    UNION ALL
    SELECT 'response_submitted', r.session_id, COALESCE(NULLIF(r.respondent_name, ''), 'A respondent') || ' · ' || f.title, r.submitted_at
      FROM responses r JOIN forms f ON f.id = r.form_id
      WHERE r.status = 'submitted' AND r.submitted_at IS NOT NULL AND r.session_id IS NOT NULL
  ) ORDER BY occurredAt DESC LIMIT 100
`);

activityRouter.get("/", (_req, res) => {
  res.json(recentActivity.all());
});

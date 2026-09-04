import { db } from "../db/index.js";

// The "Clear all local data" danger-zone action — wipes every form (which cascades to its
// questions, sessions, responses, and response_answers via their ON DELETE CASCADE foreign
// keys, see db/index.js) and every subject except the permanent "General" one, matching the
// same invariant subjects/repository.js already enforces for individual subject deletes.
// Deliberately scoped to content only: the host's password, auth session, and roster are
// left untouched since this isn't an account reset.
export function clearAllData() {
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM forms").run();
    db.prepare("DELETE FROM subjects WHERE is_default = 0").run();
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

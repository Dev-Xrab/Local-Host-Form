import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { getDefaultSubject } from "../subjects/repository.js";
import { countLocalOnlyResponses, countLocalOnlyResponsesByForm } from "../responses/repository.js";

// Every form gets *some* subject — the permanent "General" one when none is given — rather than
// a parallel "no subject" state. Falls back to null only in the (should-never-happen) case the
// default subject hasn't been seeded yet, so this never throws during startup ordering.
function resolveSubjectId(subjectId) {
  if (subjectId) return subjectId;
  return getDefaultSubject()?.id ?? null;
}

// Timer/session-code settings moved to the session itself (a session now owns its own
// time limit) — a form only carries grading-disclosure and retake policy.
const DEFAULT_SETTINGS = {
  allowMultipleResponses: false,
  showScoreImmediately: true,
  revealCorrectAnswers: false,
  downloadIncludesChoices: false,
  // Respondent screen blurs and locks while their device can't reach this server (see
  // features/responses/hooks/useServerConnection.js). Off unless the host turns it on per form.
  blurOnDisconnect: false,
  // Respondent page blocks right-click, copy/cut/select-all, dragging and printing, and clears the
  // clipboard on Print Screen (see features/responses/hooks/useCopyProtection.js). Deterrent only.
  restrictCopying: false,
  // Each respondent sees the questions inside every section in their own random order (see
  // features/responses/utils/shuffle.js). Order only: scoring and answers are untouched.
  shuffleQuestions: false,
};

const now = () => new Date().toISOString();

function rowToQuestion(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    showDescription: !!row.show_description,
    showImage: !!row.show_image,
    required: !!row.required,
    options: JSON.parse(row.options),
    scale: JSON.parse(row.scale),
    rows: JSON.parse(row.rows || "[]"),
    imageUrl: row.image_url,
    correctAnswerIndex: JSON.parse(row.correct_answer_index),
    correctAnswers: JSON.parse(row.correct_answers),
    points: row.points,
    removedAt: row.removed_at || null,
  };
}

function rowToFormMeta(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    settings: { ...DEFAULT_SETTINGS, ...JSON.parse(row.settings) },
    subjectId: row.subject_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    remoteFormId: row.remote_form_id,
    remoteVersion: row.remote_version,
    remoteSavedAt: row.remote_saved_at,
    // Edited here since it last matched the cloud copy — the cloud doesn't have these changes yet.
    hasUnsavedCloudChanges: !!row.remote_form_id && !!row.remote_saved_at && row.updated_at > row.remote_saved_at,
    ownerUserId: row.owner_user_id,
    googleFormId: row.google_form_id,
    bannerImage: row.banner_image,
  };
}

const selectFormStmt = db.prepare("SELECT * FROM forms WHERE id = ?");
const selectFormByRemoteIdStmt = db.prepare("SELECT id FROM forms WHERE remote_form_id = ?");

// Used while applying downloaded sync changes (see server/cloud/sync.js) to map a response's
// cloud-side formId back to this device's local form row.
export function getFormIdByRemoteId(remoteFormId) {
  return selectFormByRemoteIdStmt.get(remoteFormId)?.id || null;
}
const selectQuestionsStmt = db.prepare(
  "SELECT * FROM questions WHERE form_id = ? ORDER BY order_index ASC"
);
const selectAllFormsStmt = db.prepare("SELECT * FROM forms ORDER BY updated_at DESC");
const countResponsesStmt = db.prepare(
  "SELECT form_id, COUNT(*) AS count, MAX(submitted_at) AS last_at FROM responses WHERE status = 'submitted' GROUP BY form_id"
);
const countQuestionsStmt = db.prepare(
  "SELECT form_id, COUNT(*) as count FROM questions WHERE type != 'section' GROUP BY form_id"
);

// One-time cleanup for forms created before every entry point resolved a missing subjectId to
// General (see resolveSubjectId above) — called once at boot, after ensureDefaultSubject() has
// guaranteed a default subject exists (server/index.js). A no-op once every such form has been
// backfilled.
export function backfillFormsWithoutSubject() {
  const general = getDefaultSubject();
  if (!general) return;
  db.prepare("UPDATE forms SET subject_id = ? WHERE subject_id IS NULL").run(general.id);
}

export function listForms() {
  const forms = selectAllFormsStmt.all();
  const counts = Object.fromEntries(
    countQuestionsStmt.all().map((r) => [r.form_id, r.count])
  );
  // Responses fetched from Google that only exist on this device so far (see
  // responses/repository.js insertGoogleResponse) — drives the "unsaved to cloud" chip.
  const unsaved = countLocalOnlyResponsesByForm();
  const responseStats = Object.fromEntries(countResponsesStmt.all().map((r) => [r.form_id, r]));
  return forms.map((row) => ({
    ...rowToFormMeta(row),
    questionCount: counts[row.id] || 0,
    responseCount: responseStats[row.id]?.count || 0,
    lastResponseAt: responseStats[row.id]?.last_at || null,
    unsavedResponseCount: unsaved[row.id] || 0,
  }));
}

export function getForm(id) {
  const row = selectFormStmt.get(id);
  if (!row) return null;
  const questions = selectQuestionsStmt.all(id).map(rowToQuestion);
  return { ...rowToFormMeta(row), questions, unsavedResponseCount: countLocalOnlyResponses(id) };
}

export function createForm({ title = "", description = "", subjectId = null } = {}) {
  const id = randomUUID();
  const timestamp = now();
  db.prepare(
    `INSERT INTO forms (id, title, description, status, settings, subject_id, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`
  ).run(id, title, description, JSON.stringify(DEFAULT_SETTINGS), resolveSubjectId(subjectId), timestamp, timestamp);
  return getForm(id);
}

const deleteQuestionsStmt = db.prepare("DELETE FROM questions WHERE form_id = ?");
const insertQuestionStmt = db.prepare(`
  INSERT INTO questions (
    id, form_id, order_index, type, title, description, show_description, show_image,
    required, options, scale, rows, image_url, correct_answer_index, correct_answers, points,
    removed_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateFormMetaStmt = db.prepare(`
  UPDATE forms SET title = ?, description = ?, settings = ?, subject_id = ?, banner_image = ?, updated_at = ? WHERE id = ?
`);

export function updateForm(id, { title, description, settings, questions, subjectId, bannerImage }) {
  const existing = selectFormStmt.get(id);
  if (!existing) return null;

  const nextTitle = title ?? existing.title;
  const nextDescription = description ?? existing.description;
  const nextSubjectId = subjectId !== undefined ? resolveSubjectId(subjectId) : existing.subject_id;
  // `null` is a deliberate "remove the banner", so only an outright `undefined` (the field wasn't
  // part of this update at all) keeps whatever is already stored.
  const nextBannerImage = bannerImage !== undefined ? bannerImage : existing.banner_image;
  const nextSettings = {
    ...DEFAULT_SETTINGS,
    ...JSON.parse(existing.settings),
    ...(settings || {}),
  };
  const timestamp = now();

  db.exec("BEGIN");
  try {
    updateFormMetaStmt.run(
      nextTitle,
      nextDescription,
      JSON.stringify(nextSettings),
      nextSubjectId,
      nextBannerImage,
      timestamp,
      id
    );

    if (Array.isArray(questions)) {
      // A routine builder save only ever sends the current active question set — it doesn't know
      // about questions a Google structural sync has already marked removed (see
      // server/forms/questionDiff.js). Re-append any such row that isn't part of this update so
      // an ordinary save can never silently drop preserved history.
      const incomingIds = new Set(questions.map((q) => q.id));
      const preservedLegacy = selectQuestionsStmt
        .all(id)
        .map(rowToQuestion)
        .filter((q) => q.removedAt && !incomingIds.has(q.id));

      deleteQuestionsStmt.run(id);
      [...questions, ...preservedLegacy].forEach((q, index) => {
        insertQuestionStmt.run(
          q.id || randomUUID(),
          id,
          index,
          q.type,
          q.title || "",
          q.description || "",
          q.showDescription ? 1 : 0,
          q.showImage ? 1 : 0,
          q.required ? 1 : 0,
          JSON.stringify(q.options || []),
          JSON.stringify(q.scale || {}),
          JSON.stringify(q.rows || []),
          q.imageUrl || null,
          JSON.stringify(q.correctAnswerIndex || []),
          JSON.stringify(q.correctAnswers || []),
          Number.isFinite(q.points) && q.points >= 0 ? q.points : 1,
          q.removedAt || null
        );
      });
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return getForm(id);
}

// Recreates a form from a previously-exported definition (a JSON file, or a form fetched from
// the cloud server — see server/cloud/routes.js) as a brand new form — always a fresh form id
// (never reuse the exported one) so importing the same source twice can never collide with an
// existing row. Question images are already inline base64 data: URIs on the question object
// (see ImageBlock.jsx), so they round-trip for free with no separate asset handling.
// remoteFormId/remoteVersion/ownerUserId are only set for cloud imports — a plain file import
// leaves them null, matching a locally-authored form.
//
// preserveQuestionIds matters ONLY for cloud imports: a response synced down from another
// device has its answers keyed by THAT device's question ids (see server/cloud/sync.js and
// buildPayload in the same file) — those ids are shared, canonical identifiers for a given
// form version once it's on the cloud server, not a per-device implementation detail. Minting
// fresh question ids here (the plain file-import behavior, kept as the default) would silently
// orphan every synced-down response's answers on any device that had to import the form itself
// rather than being the one that published it.
export function importForm({
  title = "",
  description = "",
  settings,
  questions,
  subjectId = null,
  remoteFormId = null,
  remoteVersion = null,
  ownerUserId = null,
  preserveQuestionIds = false,
  googleFormId = null,
  bannerImage = null,
} = {}) {
  const id = randomUUID();
  const timestamp = now();
  const nextSettings = { ...DEFAULT_SETTINGS, ...(settings || {}) };

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO forms (id, title, description, status, settings, subject_id, created_at, updated_at, remote_form_id, remote_version, remote_saved_at, owner_user_id, google_form_id, banner_image)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, title, description, JSON.stringify(nextSettings), resolveSubjectId(subjectId), timestamp, timestamp, remoteFormId, remoteVersion, remoteFormId ? timestamp : null, ownerUserId, googleFormId, bannerImage);

    (questions || []).forEach((q, index) => {
      insertQuestionStmt.run(
        preserveQuestionIds && q.id ? q.id : randomUUID(),
        id,
        index,
        q.type,
        q.title || "",
        q.description || "",
        q.showDescription ? 1 : 0,
        q.showImage ? 1 : 0,
        q.required ? 1 : 0,
        JSON.stringify(q.options || []),
        JSON.stringify(q.scale || {}),
        JSON.stringify(q.rows || []),
        q.imageUrl || null,
        JSON.stringify(q.correctAnswerIndex || []),
        JSON.stringify(q.correctAnswers || []),
        Number.isFinite(q.points) && q.points >= 0 ? q.points : 1,
        q.removedAt || null
      );
    });
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return getForm(id);
}

const setRemoteInfoStmt = db.prepare(
  "UPDATE forms SET remote_form_id = ?, remote_version = ?, owner_user_id = ?, updated_at = ?, remote_saved_at = ? WHERE id = ?"
);

// Stamps a local form with where it now lives on the cloud server, after a publish (see
// server/cloud/routes.js POST /forms/:id/publish). Never touches title/description/questions —
// those are the source of truth locally; this only records the remote pointer.
//
// `publishedAt` is the form's updated_at as it was when the uploaded copy was read. If the form was
// edited again while the upload was in flight, stamping "saved now" would hide that edit (it would
// look older than the save), so it is left marked as unsaved instead.
const setRemoteInfoKeepingEditsStmt = db.prepare(
  "UPDATE forms SET remote_form_id = ?, remote_version = ?, owner_user_id = ?, remote_saved_at = ? WHERE id = ?"
);

export function setRemoteInfo(id, { remoteFormId, remoteVersion, ownerUserId }, { publishedAt } = {}) {
  const current = selectFormStmt.get(id);
  if (publishedAt && current && current.updated_at > publishedAt) {
    setRemoteInfoKeepingEditsStmt.run(remoteFormId, remoteVersion, ownerUserId, publishedAt, id);
    return getForm(id);
  }
  // Same instant for both, so a form that was just published/imported reads as in step with the
  // cloud (updated_at is not later than remote_saved_at).
  const timestamp = now();
  setRemoteInfoStmt.run(remoteFormId, remoteVersion, ownerUserId, timestamp, timestamp, id);
  return getForm(id);
}

// Deliberately leaves updated_at alone: linking a Google Form is bookkeeping, not an edit, and
// bumping it would make a freshly imported form look like it has unsaved cloud changes.
const setGoogleFormIdStmt = db.prepare("UPDATE forms SET google_form_id = ? WHERE id = ?");

// Records which real Google Form this local form was imported from, so a later
// "Update from Google" (see server/cloud/routes.js POST /google-forms/:id/refresh) can find
// its way back to it. Set once at import time; never touched afterward.
export function setGoogleFormId(id, googleFormId) {
  setGoogleFormIdStmt.run(googleFormId, id);
  return getForm(id);
}

export function deleteForm(id) {
  const result = db.prepare("DELETE FROM forms WHERE id = ?").run(id);
  return result.changes > 0;
}

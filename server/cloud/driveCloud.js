import { randomUUID } from "node:crypto";
import { createJson, deleteFile, listAppFiles, readJson, updateJson } from "./drive.js";

// Drive-backed stand-in for the old cloud server's HTTP API. server/cloud/routes.js and sync.js still
// call cloudFetch("/api/forms…") and cloudFetch("/api/sync"), so they work unchanged, but the data now
// lives in the signed-in user's own Google Drive (hidden app-data folder) instead of a database we run.
//
// Layout of that folder:
//   form-<formId>.json                 one file per form: current version + every published snapshot
//   resp-<formId>-<responseId>.json    one small file per response
//
// A device only ever creates or updates files for work it did, and each response is its own file, so
// two devices don't overwrite each other's writes. Files are matched by name; Drive's own
// modifiedTime is the sync cursor (it replaces the old database's server_seq).

const PAGE_SIZE = 500;
const MAX_CHANGES_PER_REQUEST = 500;
const FETCH_CONCURRENCY = 6;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_PATTERN = new RegExp(`^${UUID}$`, "i");
const FORM_NAME = new RegExp(`^form-(${UUID})\\.json$`, "i");
const RESPONSE_NAME = new RegExp(`^resp-(${UUID})-(${UUID})\\.json$`, "i");

const QUESTION_TYPES = new Set([
  "short_answer",
  "paragraph",
  "multiple_choice",
  "checkboxes",
  "dropdown",
  "linear_scale",
  "date",
  "time",
  "file_upload",
  "matrix",
  "matrix_checkbox",
  "section",
]);

const formFileName = (id) => `form-${id}.json`;
const responseFileName = (formId, responseId) => `resp-${formId}-${responseId}.json`;
const reply = (status, body) => ({ status, body });
const notFound = () => reply(404, { error: "Form not found." });

function validateFormBody(body) {
  const { title, description, settings, questions } = body || {};
  if (title !== undefined && typeof title !== "string") return "title must be a string";
  if (description !== undefined && typeof description !== "string") return "description must be a string";
  if (settings !== undefined && (typeof settings !== "object" || settings === null)) return "settings must be an object";
  if (!Array.isArray(questions)) return "questions must be an array";
  for (const q of questions) {
    if (!q || typeof q !== "object") return "each question must be an object";
    if (!q.id || typeof q.id !== "string") return "each question must have a string id";
    if (!QUESTION_TYPES.has(q.type)) return `unknown question type: ${q.type}`;
  }
  return null;
}

// Key order can differ between a payload we stored and one a device re-sends, so equality has to
// ignore it to tell a harmless retry from a real conflicting write.
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

const summary = (doc) => ({
  id: doc.id,
  title: doc.title,
  description: doc.description,
  version: doc.currentVersion,
  questionCount: (doc.versions.find((v) => v.version === doc.currentVersion)?.questions || []).filter((q) => q.type !== "section").length,
  updatedAt: doc.updatedAt,
});

function detail(doc, wantedVersion) {
  const snapshot = doc.versions.find((v) => v.version === (wantedVersion ?? doc.currentVersion));
  if (!snapshot) return null;
  return {
    id: doc.id,
    title: snapshot.title,
    description: snapshot.description,
    settings: snapshot.settings,
    version: snapshot.version,
    questions: snapshot.questions,
    updatedAt: doc.updatedAt,
    googleFormId: null,
  };
}

function snapshotOf(version, body) {
  return {
    version,
    createdAt: new Date().toISOString(),
    title: body.title || "",
    description: body.description || "",
    settings: body.settings || {},
    questions: body.questions || [],
  };
}

async function findForm(token, id) {
  // `id` was already validated as a uuid by the caller, so it is safe inside the query string.
  const [file] = await listAppFiles(token, { q: `name = '${formFileName(id)}'` });
  if (!file) return null;
  return { file, doc: await readJson(token, file.id) };
}

async function listForms(token) {
  const files = (await listAppFiles(token)).filter((f) => FORM_NAME.test(f.name));
  const docs = await mapLimit(files, FETCH_CONCURRENCY, (f) => readJson(token, f.id));
  docs.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return reply(200, docs.map(summary));
}

async function createForm(token, body, id = randomUUID()) {
  const error = validateFormBody(body);
  if (error) return reply(400, { error });
  const now = new Date().toISOString();
  const doc = {
    id,
    title: body.title || "",
    description: body.description || "",
    currentVersion: 1,
    updatedAt: now,
    versions: [snapshotOf(1, body)],
  };
  await createJson(token, formFileName(id), doc);
  return reply(201, detail(doc));
}

// Publishing an edit adds a new snapshot rather than overwriting the old one, so a device that
// imported an older version still has a definition that matches the responses it collected.
async function publishVersion(token, id, body, coalesceSeconds = 0) {
  const error = validateFormBody(body);
  if (error) return reply(400, { error });
  const found = await findForm(token, id);
  // A form this device published to the previous cloud server has no file here yet. Creating it
  // under the same id keeps its responses attached instead of failing the publish.
  if (!found) return createForm(token, body, id).then((r) => (r.status === 201 ? reply(200, r.body) : r));

  const { file, doc } = found;
  const latest = doc.versions.find((v) => v.version === doc.currentVersion);
  const recent = latest && coalesceSeconds > 0 && Date.now() - Date.parse(latest.createdAt) < coalesceSeconds * 1000;
  if (recent) {
    // Same editing session: refresh the newest snapshot instead of adding another near-identical one.
    Object.assign(latest, snapshotOf(latest.version, body), { createdAt: latest.createdAt });
  } else {
    const nextVersion = doc.currentVersion + 1;
    doc.versions.push(snapshotOf(nextVersion, body));
    doc.currentVersion = nextVersion;
  }
  doc.title = body.title || "";
  doc.description = body.description || "";
  doc.updatedAt = new Date().toISOString();
  await updateJson(token, file.id, doc);
  return reply(200, detail(doc));
}

async function deleteForm(token, id) {
  const files = await listAppFiles(token);
  const form = files.find((f) => f.name === formFileName(id));
  if (!form) return notFound();
  const responses = files.filter((f) => f.name.startsWith(`resp-${id}-`));
  await mapLimit(responses, FETCH_CONCURRENCY, (f) => deleteFile(token, f.id));
  await deleteFile(token, form.id);
  return reply(204, null);
}

function validateChange(change) {
  if (!change || typeof change !== "object") return "each change must be an object";
  if (typeof change.id !== "string" || !UUID_PATTERN.test(change.id)) return "each change needs a uuid id";
  if (typeof change.formId !== "string" || !UUID_PATTERN.test(change.formId)) return "each change needs a uuid formId";
  if (typeof change.createdAt !== "string" || Number.isNaN(Date.parse(change.createdAt))) return "createdAt must be a date";
  if (!Number.isInteger(change.version) || change.version < 1) return "each change needs an integer version >= 1";
  if (change.payload === undefined || change.payload === null || typeof change.payload !== "object") {
    return "each change needs a payload object";
  }
  if (change.formVersion !== undefined && !Number.isInteger(change.formVersion)) return "formVersion must be an integer when present";
  return null;
}

// Mirrors the old POST /api/sync contract: upload `changes`, then return everything modified since
// `lastCursor`. The cursor is a Drive modifiedTime in milliseconds. It is inclusive, so a file that
// shares the cursor's millisecond is re-sent rather than missed; applying a response twice is a
// no-op because the local side checks the version.
async function sync(token, body, ctx) {
  const { lastCursor, changes, formId: onlyFormId } = body || {};
  if (changes !== undefined && !Array.isArray(changes)) return reply(400, { error: "changes must be an array when present" });
  if (Array.isArray(changes) && changes.length > MAX_CHANGES_PER_REQUEST) {
    return reply(400, { error: `At most ${MAX_CHANGES_PER_REQUEST} changes per request.` });
  }
  if (onlyFormId !== undefined && onlyFormId !== null && (typeof onlyFormId !== "string" || !UUID_PATTERN.test(onlyFormId))) {
    return reply(400, { error: "formId must be a uuid when present" });
  }
  const cursor = Number.isFinite(Number(lastCursor)) ? Number(lastCursor) : 0;

  const files = await listAppFiles(token);
  const formIds = new Set(files.map((f) => FORM_NAME.exec(f.name)?.[1]?.toLowerCase()).filter(Boolean));
  const responseFiles = new Map(files.filter((f) => RESPONSE_NAME.test(f.name)).map((f) => [f.name, f]));

  const accepted = [];
  const rejected = [];

  for (const change of changes || []) {
    const error = validateChange(change);
    if (error) {
      rejected.push({ id: change?.id || null, reason: "invalid", detail: error });
      continue;
    }
    if (!formIds.has(change.formId.toLowerCase())) {
      rejected.push({ id: change.id, reason: "invalid_form" });
      continue;
    }

    const name = responseFileName(change.formId, change.id);
    const record = {
      id: change.id,
      formId: change.formId,
      formVersion: change.formVersion ?? 1,
      version: change.version,
      deviceId: ctx.deviceId,
      deviceName: ctx.deviceName,
      createdAt: change.createdAt,
      payload: change.payload,
    };

    const existing = responseFiles.get(name);
    if (!existing) {
      responseFiles.set(name, await createJson(token, name, record));
      accepted.push(change.id);
      continue;
    }

    const stored = await readJson(token, existing.id);
    if (stored.version < change.version) {
      responseFiles.set(name, await updateJson(token, existing.id, record));
      accepted.push(change.id);
    } else if (canonicalJson(stored.payload) === canonicalJson(change.payload)) {
      accepted.push(change.id); // an exact retry
    } else {
      rejected.push({ id: change.id, reason: "conflict" });
    }
  }

  const candidates = [...responseFiles.values()]
    .map((f) => ({ file: f, ms: Date.parse(f.modifiedTime) || 0, match: RESPONSE_NAME.exec(f.name) }))
    .filter((c) => c.match && c.ms >= cursor && (!onlyFormId || c.match[1].toLowerCase() === onlyFormId.toLowerCase()))
    .sort((a, b) => a.ms - b.ms || a.file.name.localeCompare(b.file.name));

  const page = candidates.slice(0, PAGE_SIZE);
  const records = await mapLimit(page, FETCH_CONCURRENCY, (c) => readJson(token, c.file.id));

  return reply(200, {
    accepted,
    rejected,
    changes: records.map((r, i) => ({
      id: r.id,
      formId: r.formId,
      formVersion: r.formVersion,
      version: r.version,
      deviceId: r.deviceId,
      deviceName: r.deviceName,
      payload: r.payload,
      serverSeq: page[i].ms,
    })),
    nextCursor: page.length ? page[page.length - 1].ms : cursor,
    hasMore: candidates.length > PAGE_SIZE,
  });
}

/**
 * Answers one request in the shape the old cloud server did. `ctx` is { deviceId, deviceName }.
 * Returns { status, body }; Drive failures propagate as DriveError for the caller to translate.
 */
export async function handleCloudRequest(token, method, path, body, ctx) {
  const url = new URL(path.replace(/^\/+/, "/"), "http://local");
  const parts = url.pathname.split("/").filter(Boolean); // ["api", "forms", id?, "versions"?]
  if (parts[0] !== "api") return reply(404, { error: "Not found." });

  if (parts[1] === "sync" && parts.length === 2 && method === "POST") return sync(token, body, ctx);

  if (parts[1] === "forms") {
    const id = parts[2];
    if (parts.length === 2) {
      if (method === "GET") return listForms(token);
      if (method === "POST") return createForm(token, body);
    }
    if (id && !UUID_PATTERN.test(id)) return notFound();

    if (id && parts.length === 3) {
      if (method === "GET") {
        const found = await findForm(token, id);
        if (!found) return notFound();
        const requested = url.searchParams.get("version");
        const wanted = requested !== null && Number.isInteger(Number(requested)) ? Number(requested) : undefined;
        const result = detail(found.doc, wanted);
        return result ? reply(200, result) : notFound();
      }
      if (method === "PUT") return publishVersion(token, id, body, Number(url.searchParams.get("coalesce")) || 0);
      if (method === "DELETE") return deleteForm(token, id);
    }

    if (id && parts[3] === "versions" && parts.length === 4 && method === "GET") {
      const found = await findForm(token, id);
      if (!found) return notFound();
      return reply(200, [...found.doc.versions].sort((a, b) => b.version - a.version).map((v) => ({ version: v.version, createdAt: v.createdAt })));
    }
  }

  return reply(404, { error: "Not found." });
}

import * as cloudRepo from "./repository.js";
import { cloudFetch } from "./client.js";
import * as formsRepo from "../forms/repository.js";
import { runSync } from "./sync.js";

export class PublishError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Saves a locally-authored (or previously imported) form to the user's Google Drive so it can be
// imported on another device signed in to the same account. The first save creates it; every later
// save adds a version rather than overwriting, so a device that imported an older version keeps a
// definition that still matches the responses collected against it.
//
// `coalesce` is for automatic saves: edits made within a few minutes of the last version replace that
// version instead of adding another, so a long editing session doesn't leave dozens of near-identical
// snapshots in the user's Drive. A manual "Save to Drive" always adds a version.
export async function publishFormToCloud(formId, { coalesce = false } = {}) {
  const form = formsRepo.getForm(formId);
  if (!form) throw new PublishError("Form not found.", 404);

  const payload = {
    title: form.title,
    description: form.description,
    settings: form.settings,
    questions: form.questions,
  };

  const base = form.remoteFormId ? `/api/forms/${encodeURIComponent(form.remoteFormId)}` : "/api/forms";
  const path = form.remoteFormId && coalesce ? `${base}?coalesce=${COALESCE_WINDOW_SECONDS}` : base;
  const upstream = await cloudFetch(path, { method: form.remoteFormId ? "PUT" : "POST", body: JSON.stringify(payload) });
  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({}));
    throw new PublishError(body.error || "Failed to publish the form.", upstream.status);
  }

  const published = await upstream.json();
  const account = cloudRepo.getCloudAccount();
  const updated = formsRepo.setRemoteInfo(form.id, {
    remoteFormId: published.id,
    remoteVersion: published.version,
    ownerUserId: account.userId,
  });

  // Saving a form carries the responses collected under it: they became eligible for upload the
  // moment remote_form_id was set. That can take a while and has nothing to do with whether the FORM
  // saved, so it runs in the background. A failure just leaves them queued for the next sync.
  runSync().catch(() => {});

  return formsRepo.getForm(updated.id);
}

export const COALESCE_WINDOW_SECONDS = 600;

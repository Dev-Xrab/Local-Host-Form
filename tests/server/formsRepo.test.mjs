// Run with `npm run test:drive`. Covers the "edited while an upload was in flight" case for the
// saved-to-Drive marker, using a real database in a temporary folder.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

let repo;
let dir;
before(async () => {
  dir = mkdtempSync(join(tmpdir(), "shf-repo-"));
  process.env.DATA_DIR = dir; // must be set before the database module is first imported
  repo = await import("../../server/forms/repository.js");
});
after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // the database file can stay locked on Windows until the process exits
  }
});

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// remote_form_id is unique per form, so every test gets its own.
const newInfo = () => ({ remoteFormId: randomUUID(), remoteVersion: 1, ownerUserId: "u1" });

test("a normal save marks the form as in step with Drive", async () => {
  const form = repo.createForm({ title: "A", description: "", subjectId: null });
  const saved = repo.setRemoteInfo(form.id, newInfo(), { publishedAt: form.updatedAt });
  assert.equal(saved.hasUnsavedCloudChanges, false);
});

test("an edit made after the uploaded copy was read stays marked as unsaved", async () => {
  const form = repo.createForm({ title: "B", description: "", subjectId: null });
  const info = newInfo();
  repo.setRemoteInfo(form.id, info, { publishedAt: form.updatedAt });
  await pause(5);

  const readForUpload = repo.getForm(form.id); // the copy being uploaded
  await pause(5);
  repo.updateForm(form.id, { title: "B edited during the upload" }); // the user keeps typing
  await pause(5);

  const afterUpload = repo.setRemoteInfo(form.id, info, { publishedAt: readForUpload.updatedAt });
  assert.equal(afterUpload.hasUnsavedCloudChanges, true, "the later edit must still be sent");
  assert.equal(afterUpload.title, "B edited during the upload");
});

test("without publishedAt (cloud import) the form reads as in step, as before", async () => {
  const form = repo.createForm({ title: "C", description: "", subjectId: null });
  await pause(5);
  const imported = repo.setRemoteInfo(form.id, newInfo());
  assert.equal(imported.hasUnsavedCloudChanges, false);
});

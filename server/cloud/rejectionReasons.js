// Human-readable messages for each reason the cloud server can reject an uploaded response with
// (see cloud-server/sync/repository.js upsertResponse) — shared between server/cloud/sync.js,
// which writes one of these onto a rejected response, and server/responses/repository.js, which
// reads it back to tell the host which failures a Retry can never fix. Kept in its own module
// (rather than living in either of those) so neither has to import the other.
export const REJECTION_MESSAGES = {
  conflict: "Conflicts with a version already on the server — not overwritten.",
  invalid_form:
    "This form no longer exists on your cloud account (it may have been deleted) — this response can't be synced.",
  forbidden: "This response no longer belongs to your cloud account.",
};

// Reasons where the cause isn't transient — the form is gone, or ownership changed — so
// pressing Retry can never succeed. Discard is the only real action available for these.
export const NON_RETRYABLE_REASONS = new Set(["invalid_form", "forbidden"]);

export function describeRejection(reason) {
  return REJECTION_MESSAGES[reason] || reason || "Rejected by the server.";
}

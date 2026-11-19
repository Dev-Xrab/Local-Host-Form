// Maps a thrown cloudApi error (see services/cloudApi.js request() — carries .status and
// optionally .body) into the professional, non-technical copy this app shows for cloud/Google
// failures, instead of a raw API/network error string. Falls back to the server's own message
// for anything unrecognized rather than guessing at wording that might mislead — that message is
// already reasonable, just not always calibrated for a non-technical host (e.g. a bare "Failed to
// fetch").
export function describeCloudError(err) {
  if (!err) return "Something went wrong.";
  if (err.status === 401) return "Your Google session expired — please sign in again.";
  if (err.status === 403) return "You don't have permission to access this form.";
  if (err.status === 502 || err.status === 503 || err.message === "Failed to fetch") {
    return "Unable to connect to Google. Check your connection and try again.";
  }
  return err.message || "Something went wrong.";
}

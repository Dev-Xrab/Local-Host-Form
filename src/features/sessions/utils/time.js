// Always derives remaining time from a server-provided timestamp, never a locally-stored
// duration — the caller re-fetches endsAt from the API, this just formats "now" against it.
export function secondsRemaining(endsAt) {
  if (!endsAt) return null;
  return Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 1000));
}

export function formatClock(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined) return "—";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export const STATUS_LABEL = { draft: "Draft", active: "Active", ended: "Ended" };

// A response can be stuck at 'in_progress' forever if the respondent's tab closed before
// their own client-side auto-submit could fire (on deadline, or on the host ending an
// untimed session) — see RespondForm.jsx. Distinguish those two "never finished" reasons
// so a host can tell a dropped connection from someone still actively answering.
export function respondentStatusInfo(respondent, session) {
  if (respondent.status === "submitted") return { text: "Submitted", modifier: "submitted" };

  const deadlinePassed = respondent.deadlineAt && new Date(respondent.deadlineAt).getTime() <= Date.now();
  if (deadlinePassed) return { text: "Time ran out", modifier: "unfinished" };
  if (session.status === "ended") return { text: "Host ended session", modifier: "unfinished" };
  return { text: "In Progress", modifier: "in-progress" };
}

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

// "3 days ago" style age for cards and lists; falls back to a plain date once it's old enough that
// a relative figure stops being useful.
export function formatRelative(iso, { short = false } = {}) {
  if (!iso) return "—";
  if (short) return formatRelativeShort(iso);
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hr ago`;
  if (seconds < 86400 * 30) {
    const days = Math.round(seconds / 86400);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Compact form ("16d ago", "3h ago", "Feb 20") for tight spots like card stat tiles, where the
// long form gets truncated.
function formatRelativeShort(iso) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  if (seconds < 86400 * 30) return `${Math.round(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Duration inputs that let a host pick "seconds" or "minutes" (see the refocus-lock setting on
// Session Detail / Create Session) are stored on the server as one plain integer of seconds —
// these two just convert at the edges, so nothing else needs to know a unit was ever involved.
export const DURATION_DEFAULT_SECONDS = 8;

// A whole number of minutes displays as minutes; anything else (including "no value yet")
// displays as seconds, which is also the finer-grained, safer default for a brand-new toggle.
export function secondsToDurationParts(totalSeconds) {
  const seconds = Number.isInteger(totalSeconds) && totalSeconds > 0 ? totalSeconds : DURATION_DEFAULT_SECONDS;
  if (seconds >= 60 && seconds % 60 === 0) {
    return { value: seconds / 60, unit: "minutes" };
  }
  return { value: seconds, unit: "seconds" };
}

export function durationPartsToSeconds(value, unit) {
  const n = Math.max(1, Math.round(Number(value)) || DURATION_DEFAULT_SECONDS);
  return unit === "minutes" ? n * 60 : n;
}

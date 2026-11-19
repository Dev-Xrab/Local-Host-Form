import { useCallback, useEffect, useRef, useState } from "react";
import { cloudApi } from "../services/cloudApi";

const STATUS_POLL_MS = 20000;
// A single runSync() call caps itself at MAX_ROUNDS server-side (see server/cloud/sync.js) and
// reports back `incomplete: true` for a backlog too large to finish in one round-trip. Chasing
// that automatically for a couple more calls closes the common case without the user having to
// notice "more to sync" and press the button again themselves.
const MAX_AUTO_CONTINUE = 2;

// Distinguishes "no network"/"server unreachable" from "not signed in" and from "mid-sync" —
// each needs different UI (see item 13 of the offline-first spec: Online/Offline/Syncing/
// SyncError/Synced are not the same state and shouldn't share one generic "loading" spinner.
export function useSync() {
  const [status, setStatus] = useState(null); // { connected, reachable, pendingCount, lastSyncedAt }
  const [phase, setPhase] = useState("checking"); // checking | disconnected | offline | online | syncing | synced | error
  const [result, setResult] = useState(null); // last sync's summary
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  // Updates the raw status numbers (pendingCount, lastSyncedAt) without touching `phase` — used
  // right after a sync completes, when `sync()` has already set the correct terminal phase
  // (synced/error) and a phase-mutating refresh would immediately stomp it back to "online"
  // before the user ever sees the result.
  const fetchStatusOnly = useCallback(async () => {
    try {
      const s = await cloudApi.syncStatus();
      setStatus(s);
      return s;
    } catch {
      setStatus(null);
      return null;
    }
  }, []);

  // The polling refresh, by contrast, IS allowed to move the phase — but only ever into
  // "online"/"offline"/"disconnected", the three ambient (non-result, non-transient) states.
  // A "synced" or "error" result from the user's last click is left alone here; it naturally
  // gets replaced by "online" on the *next* poll tick, giving the result a full interval of
  // visibility instead of vanishing the instant it appears.
  const refreshStatus = useCallback(async () => {
    const s = await fetchStatusOnly();
    if (!s) {
      setPhase("disconnected");
      return null;
    }
    if (!s.connected) setPhase("disconnected");
    else if (!s.reachable) setPhase("offline");
    else setPhase((p) => (p === "syncing" ? p : "online"));
    return s;
  }, [fetchStatusOnly]);

  useEffect(() => {
    refreshStatus();
    pollRef.current = setInterval(refreshStatus, STATUS_POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [refreshStatus]);

  const sync = useCallback(async () => {
    setPhase("syncing");
    setError(null);
    try {
      let summary = await cloudApi.sync();
      const merged = { ...summary };
      let continues = 0;
      while (merged.incomplete && continues < MAX_AUTO_CONTINUE) {
        continues += 1;
        summary = await cloudApi.sync();
        merged.uploaded += summary.uploaded;
        merged.downloaded += summary.downloaded;
        merged.rejected = [...merged.rejected, ...summary.rejected];
        merged.downloadFailed = [...merged.downloadFailed, ...summary.downloadFailed];
        merged.rounds += summary.rounds;
        merged.incomplete = summary.incomplete;
      }
      setResult(merged);
      setPhase(merged.rejected?.length || merged.downloadFailed?.length ? "error" : "synced");
      await fetchStatusOnly();
      return merged;
    } catch (err) {
      setError(err.message);
      setPhase("error");
      await fetchStatusOnly();
      throw err;
    }
  }, [fetchStatusOnly]);

  return { status, phase, result, error, sync, refreshStatus };
}

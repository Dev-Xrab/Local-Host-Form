import { useCallback, useState } from "react";
import { cloudApi } from "../services/cloudApi";

// Deliberately fetched on demand (open the panel / after a sync completes) rather than polled —
// these are "needs a human to look at it" items, not an ambient status number, so there's no
// value in refreshing them every few seconds while nobody's looking.
export function useSyncIssues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actingId, setActingId] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setIssues(await cloudApi.listSyncIssues());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const retry = useCallback(
    async (id) => {
      setActingId(id);
      try {
        await cloudApi.retrySyncIssue(id);
        await refresh();
      } finally {
        setActingId(null);
      }
    },
    [refresh]
  );

  const discard = useCallback(
    async (id) => {
      setActingId(id);
      try {
        await cloudApi.discardSyncIssue(id);
        await refresh();
      } finally {
        setActingId(null);
      }
    },
    [refresh]
  );

  return { issues, loading, error, actingId, refresh, retry, discard };
}

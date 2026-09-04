import { useCallback, useEffect, useState } from "react";
import { sessionsApi } from "../services/sessionsApi";

export function useSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    return sessionsApi
      .list()
      .then(setSessions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sessions, loading, error, refresh };
}

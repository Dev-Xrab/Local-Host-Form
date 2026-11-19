import { useCallback, useEffect, useRef, useState } from "react";
import { cloudApi } from "../services/cloudApi";

const POLL_INTERVAL_MS = 2000;

// Polls /auth/status rather than pushing an event, because the actual sign-in completes in a
// separate OS-browser tab this window has no direct channel to — see server/cloud/routes.js
// GET /auth/callback. Polling only runs while `connected` is false so a signed-in session
// doesn't keep hitting the endpoint forever.
export function useCloudAccount() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const status = await cloudApi.status();
      setAccount(status.connected ? status : null);
      return status;
    } catch {
      setAccount(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const status = await refresh();
      if (status?.connected) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, POLL_INTERVAL_MS);
  }, [refresh]);

  useEffect(() => () => pollRef.current && clearInterval(pollRef.current), []);

  const login = useCallback(async () => {
    await cloudApi.startLogin();
    startPolling();
  }, [startPolling]);

  const logout = useCallback(async () => {
    await cloudApi.logout();
    setAccount(null);
  }, []);

  return { account, connected: !!account, loading, login, logout, refresh };
}

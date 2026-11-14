import { useCallback, useEffect, useRef, useState } from "react";
import { tunnelApi } from "../services/tunnelApi";

const POLL_INTERVAL_MS = 1500;
const IN_FLIGHT_STATUSES = new Set(["installing", "starting"]);

// Same shape as useCloudAccount (src/features/cloud/hooks/useCloudAccount.js): fetch status once,
// then poll only while something is actually in progress, so a settled state (connected, error,
// idle) doesn't keep hitting the endpoint forever.
export function useTunnel() {
  const [state, setState] = useState({ status: "idle", url: null, error: null, allowedEmails: [] });
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const status = await tunnelApi.status();
      setState(status);
      return status;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const status = await refresh();
      if (!status || !IN_FLIGHT_STATUSES.has(status.status)) stopPolling();
    }, POLL_INTERVAL_MS);
  }, [refresh, stopPolling]);

  useEffect(() => {
    refresh().then((status) => {
      if (status && IN_FLIGHT_STATUSES.has(status.status)) startPolling();
    });
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async () => {
    const status = await tunnelApi.start();
    setState(status);
    if (IN_FLIGHT_STATUSES.has(status.status)) startPolling();
  }, [startPolling]);

  const saveAccess = useCallback(async (allowedEmails) => {
    const status = await tunnelApi.saveAccess(allowedEmails);
    setState(status);
  }, []);

  const stop = useCallback(async () => {
    stopPolling();
    const status = await tunnelApi.stop();
    setState(status);
  }, [stopPolling]);

  return { ...state, loading, start, stop, saveAccess };
}

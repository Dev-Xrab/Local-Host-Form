// AbortSignal.timeout is missing from some runtimes (the phone's Hermes engine), so fall back to a
// plain AbortController. The timer is unref'd where supported so it never keeps a process alive.
export function timeoutSignal(ms) {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Request timed out")), ms);
  timer.unref?.();
  return controller.signal;
}

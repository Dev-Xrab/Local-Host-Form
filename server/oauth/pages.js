// Minimal pages shown in the OS browser at the end of sign-in. Rendered on this server's own origin,
// so every dynamic value is escaped.
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function sendPage(res, status, message) {
  res
    .status(status)
    .set({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    })
    .send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Self Host Form</title>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:64px auto;padding:0 20px;line-height:1.5"><p>${escapeHtml(message)}</p></body>`);
}

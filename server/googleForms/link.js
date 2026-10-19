// Extracts a Google Form id from whatever the user pastes: the bare id, an editor link
// (docs.google.com/forms/d/<id>/edit) or a Drive link (drive.google.com/open?id=<id>).
// Returns { id } or { error } with a message that says what to paste instead.
const ID = /^[A-Za-z0-9_-]{10,200}$/;

export function parseGoogleFormLink(input) {
  const text = String(input ?? "").trim();
  if (!text) return { error: "Paste a Google Form link or its id." };
  if (ID.test(text)) return { id: text };

  let url;
  try {
    url = new URL(text.startsWith("http") ? text : `https://${text}`);
  } catch {
    return { error: "That doesn't look like a Google Form link." };
  }
  const host = url.hostname.toLowerCase();

  if (host === "forms.gle") {
    return { error: "Short forms.gle links can't be read. Open the form in Google Forms and paste the link from the address bar (it contains /forms/d/…/edit)." };
  }
  if (host !== "docs.google.com" && host !== "drive.google.com" && host !== "forms.google.com") {
    return { error: "That doesn't look like a Google Form link." };
  }

  // The respondent link (/forms/d/e/<published id>/viewform) carries a different id that the API
  // cannot read; only the editor link works.
  if (/^\/forms\/(u\/\d+\/)?d\/e\//.test(url.pathname)) {
    return { error: "That is the link you send to respondents. Open the form as its owner and paste the editor link (…/forms/d/<id>/edit)." };
  }
  const match = /\/forms\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{10,200})/.exec(url.pathname);
  const id = match?.[1] || url.searchParams.get("id");
  return id && ID.test(id) ? { id } : { error: "Couldn't find a form id in that link." };
}

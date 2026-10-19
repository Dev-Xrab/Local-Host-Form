import assert from "node:assert/strict";
import { test } from "node:test";
import { parseGoogleFormLink } from "../../server/googleForms/link.js";

const ID = "1aBcD-eFgHiJkLmNoPqRsTuVwXyZ_0123456789";

test("accepts a bare id and the usual editor, account-prefixed and Drive links", () => {
  for (const input of [ID, `  ${ID}  `, `https://docs.google.com/forms/d/${ID}/edit`, `docs.google.com/forms/d/${ID}/edit#responses`, `https://docs.google.com/forms/u/1/d/${ID}/viewform`, `https://drive.google.com/open?id=${ID}`]) {
    assert.deepEqual(parseGoogleFormLink(input), { id: ID }, input);
  }
});

test("refuses links the Forms API cannot read, with a reason", () => {
  for (const input of ["", null, "nonsense", "https://forms.gle/xyz", `https://docs.google.com/forms/d/e/${ID}/viewform`, `https://evil.example/forms/d/${ID}/edit`]) {
    assert.ok(parseGoogleFormLink(input).error, String(input));
  }
});

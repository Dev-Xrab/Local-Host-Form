// Run with `npm run test:drive`. Names are put inside quoted sentences ("Delete "<title>"?"), so a
// line break in the name must never reach the message.
import test from "node:test";
import assert from "node:assert/strict";
import { oneLine } from "../../lib/text.ts";

test("a trailing line break in a title no longer splits the quote from the sentence", () => {
  // the case from the Delete form dialog: the closing quote and "?" used to wrap onto their own line
  assert.equal(oneLine("Keno Piad\n", "Untitled form"), "Keno Piad");
  assert.equal(`Delete "${oneLine("Keno Piad\n", "Untitled form")}"? This permanently deletes it.`, 'Delete "Keno Piad"? This permanently deletes it.');
});

test("line breaks, tabs and repeated spaces collapse to single spaces", () => {
  assert.equal(oneLine("  Two\r\n lines\tand   gaps "), "Two lines and gaps");
  assert.equal(oneLine("Quiz\n\nPart 2"), "Quiz Part 2");
});

test("empty, whitespace-only and missing names use the fallback", () => {
  assert.equal(oneLine("", "Untitled form"), "Untitled form");
  assert.equal(oneLine("\n\n  ", "Untitled form"), "Untitled form");
  assert.equal(oneLine(null, "Untitled form"), "Untitled form");
  assert.equal(oneLine(undefined), "");
});

test("an ordinary name is unchanged", () => {
  assert.equal(oneLine("Midterm Quiz — Cell Biology"), "Midterm Quiz — Cell Biology");
});

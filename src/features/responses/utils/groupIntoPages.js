// Splits a form's flat question list into pages the way Google Forms does: a `section`
// row becomes the header of a new page, and every question after it (until the next
// section, or the end of the list) belongs to that page. Questions before the first
// section marker become a leading, untitled page. A form with no sections at all comes
// back as a single page — so a simple form keeps today's one-screen behavior.
// `next` is the section's "After section" target (see src/lib/sectionFlow.js).
export function groupIntoPages(questions) {
  const pages = [{ id: "page-0", title: "", description: "", next: null, questions: [] }];

  for (const q of questions) {
    if (q.type === "section") {
      pages.push({ id: q.id, title: q.title || "", description: q.description || "", next: q.navigation?.next ?? null, questions: [] });
    } else {
      pages[pages.length - 1].questions.push(q);
    }
  }

  // Drop a leading page if it never picked up a title/description/questions — happens
  // whenever the form's very first item is a section marker.
  if (pages.length > 1 && !pages[0].title && !pages[0].description && pages[0].questions.length === 0) {
    pages.shift();
  }

  return pages;
}

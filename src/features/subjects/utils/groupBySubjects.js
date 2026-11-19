// Groups items (forms, sessions, ...) by their subject. Every item is expected to carry a real
// subjectId — the server resolves a missing one to the permanent "General" subject (see
// server/forms/repository.js resolveSubjectId) — so an item whose subjectId doesn't match any
// known subject (stale data predating that backfill) is folded into the default subject's own
// group here, rather than kept in a separate "No subject" bucket.
export function groupBySubjects(items, subjects, getSubjectId) {
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const defaultSubject = subjects.find((s) => s.isDefault) || null;
  const groups = new Map();

  items.forEach((item) => {
    const subjectId = getSubjectId(item);
    const subject = (subjectId && subjectById.get(subjectId)) || defaultSubject;
    const key = subject?.id || "unsorted";
    if (!groups.has(key)) groups.set(key, { subject, items: [] });
    groups.get(key).items.push(item);
  });

  return Array.from(groups.values()).sort((a, b) => {
    if (!a.subject) return 1;
    if (!b.subject) return -1;
    return a.subject.name.localeCompare(b.subject.name);
  });
}

// Compares a form's current local questions against a freshly-fetched live translation of its
// linked Google Form (see cloud-server/google-forms/translate.js) and describes what changed —
// read-only, no writes. Used to show the host a decision dialog before anything is applied (see
// server/cloud/routes.js GET /google-forms/:id/changes), never to silently overwrite the form.
//
// Comparisons are always by question id (Google's own questionId/itemId — see translate.js),
// never by title or position, so a rename or reorder is detected as exactly that rather than as
// an unrelated add+remove pair.

function questionsEqual(a, b) {
  return (
    a.type === b.type &&
    (a.title || "") === (b.title || "") &&
    !!a.required === !!b.required &&
    JSON.stringify(a.options || []) === JSON.stringify(b.options || []) &&
    JSON.stringify(a.scale || {}) === JSON.stringify(b.scale || {}) &&
    JSON.stringify((a.rows || []).map((r) => r.label)) === JSON.stringify((b.rows || []).map((r) => r.label))
  );
}

function describeQuestion(q) {
  return { id: q.id, title: q.title || "Untitled question" };
}

export function diffQuestions(localQuestions, liveQuestions) {
  const activeLocal = (localQuestions || []).filter((q) => !q.removedAt);
  const localById = new Map(activeLocal.map((q) => [q.id, q]));
  const liveById = new Map((liveQuestions || []).map((q) => [q.id, q]));

  const added = [];
  const modified = [];
  (liveQuestions || []).forEach((lq) => {
    const local = localById.get(lq.id);
    if (!local) {
      added.push(describeQuestion(lq));
    } else if (!questionsEqual(local, lq)) {
      modified.push(describeQuestion(lq));
    }
  });

  const removed = activeLocal.filter((q) => !liveById.has(q.id)).map(describeQuestion);

  const localOrderShared = activeLocal.map((q) => q.id).filter((id) => liveById.has(id));
  const liveOrderShared = (liveQuestions || []).map((q) => q.id).filter((id) => localById.has(id));
  const reordered = localOrderShared.length > 1 && JSON.stringify(localOrderShared) !== JSON.stringify(liveOrderShared);

  return {
    added,
    removed,
    modified,
    reordered,
    hasChanges: added.length > 0 || removed.length > 0 || modified.length > 0 || reordered,
  };
}

// Builds the full question array to write locally once the host picks "Sync From Online" —
// live questions define the active set and its order; a local question no longer present live is
// kept (never deleted) with removedAt stamped, preserving its last-known definition so historical
// answers stay labeled. A question that reappears live after being removed is treated as active
// again. Local-only grading fields (correctAnswerIndex/correctAnswers/points) are never touched by
// Google's data — Google Forms has no concept of them — so an existing question keeps whatever
// the host already configured.
export function mergeQuestions(localQuestions, liveQuestions) {
  const localById = new Map((localQuestions || []).map((q) => [q.id, q]));
  const liveIds = new Set((liveQuestions || []).map((q) => q.id));
  const removedAtStamp = new Date().toISOString();

  const merged = (liveQuestions || []).map((lq) => {
    const local = localById.get(lq.id);
    const base = local || {};
    return {
      ...base,
      id: lq.id,
      type: lq.type,
      title: lq.title,
      description: lq.description,
      showDescription: local ? base.showDescription : !!lq.description,
      options: lq.options,
      scale: lq.scale,
      rows: lq.rows,
      required: lq.required,
      removedAt: null,
    };
  });

  (localQuestions || []).forEach((q) => {
    if (liveIds.has(q.id)) return;
    merged.push({ ...q, removedAt: q.removedAt || removedAtStamp });
  });

  return merged;
}

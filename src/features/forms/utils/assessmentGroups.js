// Keeps analytics and exports scoped to the definition each response actually used.
export function assessmentGroups(form, responses, definitions = []) {
  const known = new Set(definitions.map((definition) => definition.id));
  if (responses.some((response) => response.formSnapshotId && !known.has(response.formSnapshotId))) {
    throw new Error("A response is missing its assessment definition. Refresh responses before exporting.");
  }
  const groups = definitions
    .map((definition) => ({
      ...definition,
      responses: responses.filter((r) => (r.formSnapshotId || "legacy") === definition.id),
    }))
    .filter((group) => group.responses.length > 0);
  return groups.length ? groups : [{ id: "legacy", title: form.title, questions: form.questions || [], provenance: "legacy_current_definition", responses }];
}

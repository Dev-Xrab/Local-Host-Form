import { useCallback, useEffect, useState } from "react";
import { rosterApi } from "../services/rosterApi";

export function useRoster() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    return rosterApi
      .list()
      .then(setStudents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { students, loading, error, refresh };
}

const norm = (s) => String(s ?? "").trim().toLowerCase();

// Mirrors server/roster/repository.js matchStudentByName — exact match on the
// student's own name or any of their aliases, case-insensitive.
export function matchStudentByName(students, respondentName) {
  const target = norm(respondentName);
  if (!target) return null;
  return (
    students.find((s) => norm(s.name) === target) ||
    students.find((s) => (s.aliases || []).some((a) => norm(a) === target)) ||
    null
  );
}

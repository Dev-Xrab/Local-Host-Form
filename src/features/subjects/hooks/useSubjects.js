import { useCallback, useEffect, useState } from "react";
import { subjectsApi } from "../services/subjectsApi";

export function useSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    return subjectsApi
      .list()
      .then(setSubjects)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { subjects, loading, error, refresh };
}

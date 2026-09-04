import { useCallback, useEffect, useState } from "react";
import { formsApi } from "../services/formsApi";

export function useForms() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    return formsApi
      .list()
      .then(setForms)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { forms, loading, error, refresh };
}

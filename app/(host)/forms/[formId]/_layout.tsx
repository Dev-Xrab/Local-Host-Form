import { useEffect, useState } from "react";
import { Slot, useLocalSearchParams } from "expo-router";
import { formsApi } from "../../../../src/features/forms/services/formsApi";
import { EmptyState, Spinner } from "../../../../ui";
import { FileText } from "lucide-react-native";
import { FormShell } from "../../../../components/editor/FormShell";
import { useFormActions, useFormStore } from "../../../../lib/formStore";

// Loads the form into the shared Zustand store once, then renders the editor shell around whichever
// tab (questions / responses / settings) is active.
export default function FormLayout() {
  const { formId } = useLocalSearchParams<{ formId: string }>();
  const loadedId = useFormStore((s) => s.formId);
  const { loadForm } = useFormActions();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);
    formsApi
      .get(formId)
      .then((form: unknown) => {
        if (cancelled) return;
        loadForm(form);
        setStatus("ready");
      })
      .catch((err: Error & { status?: number }) => {
        if (cancelled) return;
        setError(err.status === 404 ? "This form doesn't exist." : err.message);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [formId, loadForm]);

  if (status === "error") return <EmptyState icon={FileText} title="Couldn't open this form" body={error ?? undefined} />;
  // Also guards the render between the fetch resolving and the store finishing its update.
  if (status === "loading" || loadedId !== formId) return <Spinner label="Loading form" fill />;

  return (
    <FormShell formId={formId}>
      <Slot />
    </FormShell>
  );
}

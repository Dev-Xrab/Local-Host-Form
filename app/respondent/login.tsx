import { useState } from "react";
import { useRouter } from "expo-router";
import { responsesApi } from "../../src/features/responses/services/responsesApi";
import { getDeviceId } from "../../src/features/responses/utils/deviceId";
import { AuthCard, AuthField, AuthLink, Button } from "../../components/AuthCard";
import { GText } from "../../ui/gforms";

const NAME_STORAGE_KEY = "stonearch_respondent_name";

function readSavedName() {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export default function RespondentLogin() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState(readSavedName);
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<{ identifier?: string; code?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  // One screen does what used to take three: identify, enter the session code, and join, so the
  // form opens already answering (the form resolves the rest through this same device id).
  async function submit() {
    const next: typeof errors = {};
    if (!identifier.trim()) next.identifier = "Enter your name, email, or N/A.";
    if (!code.trim()) next.code = "Enter the session code.";
    setErrors(next);
    if (Object.keys(next).length) return;

    const sessionCode = code.trim().toUpperCase();
    setSubmitting(true);
    try {
      await responsesApi.join(sessionCode, { name: identifier.trim(), deviceId: getDeviceId() });
      try {
        localStorage.setItem(NAME_STORAGE_KEY, identifier.trim());
      } catch {
        // convenience only
      }
      router.push(`/s/${sessionCode}` as never);
    } catch (err) {
      setErrors({ code: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      kind="respondent"
      eyebrow="Join a session"
      title="Enter your session code."
      subtitle="Use the code you received and the name or identifier the host will recognize."
      footer={<GText size={14} secondary>Hosting a form? <AuthLink href="/host/login">Host sign in</AuthLink></GText>}
    >
      <AuthField label="Your name or identifier" value={identifier} onChangeText={(v) => { setIdentifier(v); setErrors((e) => ({ ...e, identifier: undefined })); }} placeholder="Name, email, or N/A" autoComplete="name" error={errors.identifier} autoFocus />
      <AuthField label="Session code" value={code} onChangeText={(v) => { setCode(v.toUpperCase()); setErrors((e) => ({ ...e, code: undefined })); }} placeholder="e.g. AB12CD" autoCapitalize="characters" autoComplete="off" maxLength={32} error={errors.code} onSubmitEditing={submit} />
      <Button label="Find session" loading={submitting} onPress={submit} />
    </AuthCard>
  );
}

import { useState } from "react";
import { formsApi } from "../../src/features/forms/services/formsApi";
import { Button, Dialog, Text } from "../../ui";
import { buildFormExport } from "../../lib/formExport";
import { saveTextFile } from "../../lib/saveFile";
import type { FormSummary } from "../../lib/domain";

/**
 * "Form only" vs "include responses" export, asked every time since a shareable template and a
 * full backup are both normal uses. Shared by every screen that lists forms so they behave alike.
 */
export function useFormExport(onError: (message: string) => void) {
  const [target, setTarget] = useState<FormSummary | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const run = async (includeResponses: boolean) => {
    const form = target!;
    setTarget(null);
    setExportingId(form.id);
    try {
      const [full, responses] = await Promise.all([formsApi.get(form.id), includeResponses ? formsApi.responses(form.id) : Promise.resolve(undefined)]);
      const { filename, json } = buildFormExport(full, responses);
      await saveTextFile(filename, json);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setExportingId(null);
    }
  };

  const dialog = (
    <Dialog
      visible={!!target}
      title="Export form"
      onClose={() => setTarget(null)}
      footer={<><Button label="Form only" variant="ghost" onPress={() => run(false)} /><Button label="Include responses" variant="primary" onPress={() => run(true)} /></>}
    >
      <Text tone="secondary">{`Include the responses collected for "${target?.title || "Untitled form"}" in the file? Importing it later will bring them back along with the form.`}</Text>
    </Dialog>
  );

  return { exportingId, request: setTarget, dialog };
}

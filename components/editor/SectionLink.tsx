import { useMemo } from "react";
import { Select } from "../../ui";
import { SUBMIT, describeTarget, listSections, sectionIdOf } from "../../src/lib/sectionFlow";
import { useFormStore, type SectionTarget } from "../../lib/formStore";

const NEXT = "__next__";
interface SectionInfo { id: string; title: string; number: number }

/**
 * Picker for a section link, with the same choices as Google Forms: continue to the next section,
 * go to a specific section, or submit the form. `fromId` is the item the link belongs to; its own
 * section is left out, since a link back to the page you are already on does nothing.
 */
export function TargetSelect({ fromId, value, onChange, label }: { fromId: string; value: SectionTarget | undefined; onChange: (target: SectionTarget) => void; label?: string }) {
  const questions = useFormStore((s) => s.questions);
  const options = useMemo(() => {
    const own = sectionIdOf(questions, fromId);
    return [
      { value: NEXT, label: "Continue to next section" },
      ...(listSections(questions) as SectionInfo[]).filter((s) => s.id !== own).map((s) => ({ value: s.id, label: `Go to section ${s.number}${s.title ? ` (${s.title})` : ""}` })),
      { value: SUBMIT, label: "Submit form" },
    ];
  }, [questions, fromId]);
  const known = options.some((o) => o.value === value);
  return <Select label={label} value={known && value ? value : NEXT} options={options} onChange={(v) => onChange(v === NEXT ? null : v)} />;
}

/** Plain-text name of a link target, for the read-only (collapsed) cards. */
export function useTargetLabel() {
  const questions = useFormStore((s) => s.questions);
  return (target: SectionTarget | undefined) => describeTarget(target, listSections(questions));
}

// Maps Google Forms API response resources (forms.googleapis.com v1 forms.responses.list) onto
// this app's own answer shape. Only meaningful alongside translate.js's translatedQuestions:
// answers are keyed by the same question id (Google's questionId/itemId, reused verbatim — see
// translate.js) so they line up directly, no separate id-mapping step needed.
//
// This app's internal answer format (see server/responses/grading.js) is NOT Google's raw
// label text for choice-type questions — multiple_choice/dropdown store the selected option's
// INDEX, checkboxes stores an ARRAY of indices. Every other supported type (text, date, time,
// linear_scale) is stored as the raw string, which already matches what Google returns.

const CHOICE_TYPES = new Set(["multiple_choice", "dropdown"]);

function rawValues(answer) {
  return (answer?.textAnswers?.answers || []).map((a) => a.value).filter((v) => v !== undefined && v !== null);
}

// Resolves a Google answer label back to this question's option index. Returns null (rather than
// throwing) for a label with no match — e.g. an "Other" free-text choice Google allows but this
// schema has no slot for — so the caller can skip just that one answer instead of the whole
// response.
function resolveOptionIndex(question, label) {
  const index = (question.options || []).indexOf(label);
  return index >= 0 ? index : null;
}

function translateAnswerValue(question, rawAnswer) {
  const values = rawValues(rawAnswer);
  if (values.length === 0) return { skipped: false, value: undefined };

  if (CHOICE_TYPES.has(question.type)) {
    const index = resolveOptionIndex(question, values[0]);
    return index === null ? { skipped: true, value: undefined } : { skipped: false, value: index };
  }

  if (question.type === "checkboxes") {
    const indices = values.map((v) => resolveOptionIndex(question, v)).filter((i) => i !== null);
    return indices.length === 0 ? { skipped: true, value: undefined } : { skipped: false, value: indices };
  }

  // short_answer, paragraph, date, time, linear_scale — Google's raw string is already this
  // schema's stored value.
  return { skipped: false, value: values[0] };
}

// `translatedQuestions` is the `questions` array returned by translate.js's translateGoogleForm
// for this same form — used only to know each question's type/options for the index mapping
// above, and to skip answers for any Google question this schema didn't import in the first
// place (a grid/file-upload/image question has no entry here, so its answers are silently
// dropped along with the question itself).
export function translateGoogleFormResponses(translatedQuestions, rawResponses) {
  const questionById = new Map(translatedQuestions.map((q) => [q.id, q]));

  return rawResponses.map((raw) => {
    const answers = {};
    let skippedAnswerCount = 0;

    for (const [questionId, rawAnswer] of Object.entries(raw.answers || {})) {
      const question = questionById.get(questionId);
      if (!question) continue; // question itself wasn't imported (unsupported type)

      const { skipped, value } = translateAnswerValue(question, rawAnswer);
      if (skipped) skippedAnswerCount += 1;
      else if (value !== undefined) answers[questionId] = value;
    }

    return {
      googleResponseId: raw.responseId,
      respondentName: raw.respondentEmail || "",
      startedAt: raw.createTime || raw.lastSubmittedTime || null,
      submittedAt: raw.lastSubmittedTime || raw.createTime || null,
      answers,
      skippedAnswerCount,
    };
  });
}

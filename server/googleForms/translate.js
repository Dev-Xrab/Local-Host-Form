// Maps a Google Forms API `Form` resource (forms.googleapis.com v1 forms.get) onto this app's
// own question schema (see server/forms/repository.js on the desktop app side — the same shape
// travels through publish/import unchanged). Deliberately one-way and lossy where Google Forms
// has no equivalent here: unsupported items are dropped and reported back in `skipped` rather
// than guessed at, so the caller can tell the user exactly what didn't come through.
//
// Question ids are taken directly from Google's own questionId/itemId rather than minted fresh —
// they're already stable, unique strings, and reusing them means re-importing the same Google
// Form later (if ever added) would naturally line up with itself.

const CHOICE_TYPE_MAP = {
  RADIO: "multiple_choice",
  CHECKBOX: "checkboxes",
  DROP_DOWN: "dropdown",
};

function translateQuestionItem(item) {
  const q = item.questionItem?.question;
  if (!q) return { skip: "unsupported item" };

  const base = {
    id: q.questionId || item.itemId,
    title: item.title || "",
    description: item.description || "",
    showDescription: !!item.description,
    showImage: false,
    required: !!q.required,
    imageUrl: null,
    correctAnswerIndex: [],
    correctAnswers: [],
    points: 1,
  };

  if (q.textQuestion) {
    return { question: { ...base, type: q.textQuestion.paragraph ? "paragraph" : "short_answer", options: [], scale: {} } };
  }

  if (q.choiceQuestion) {
    const type = CHOICE_TYPE_MAP[q.choiceQuestion.type];
    if (!type) return { skip: `unsupported choice type: ${q.choiceQuestion.type}` };
    return {
      question: {
        ...base,
        type,
        options: (q.choiceQuestion.options || []).map((o) => o.value || ""),
        scale: {},
      },
    };
  }

  if (q.scaleQuestion) {
    return {
      question: {
        ...base,
        type: "linear_scale",
        options: [],
        scale: {
          min: q.scaleQuestion.low,
          max: q.scaleQuestion.high,
          minLabel: q.scaleQuestion.lowLabel || "",
          maxLabel: q.scaleQuestion.highLabel || "",
        },
      },
    };
  }

  if (q.dateQuestion) {
    return { question: { ...base, type: "date", options: [], scale: {} } };
  }

  if (q.timeQuestion) {
    return { question: { ...base, type: "time", options: [], scale: {} } };
  }

  // File upload, grid (questionGroupItem is handled separately below), and anything else this
  // schema has no representation for.
  return { skip: "unsupported question type (e.g. file upload or grid)" };
}

export function translateGoogleForm(form) {
  const title = form.info?.title || "Untitled form";
  const description = form.info?.description || "";
  const questions = [];
  const skipped = [];

  for (const item of form.items || []) {
    if (item.pageBreakItem || item.textItem) {
      // Both render as a plain content break in Google Forms — the closest equivalent this
      // schema has is a section header, using whatever title/description the item carries.
      questions.push({
        id: item.itemId,
        type: "section",
        title: item.title || "",
        description: item.description || "",
        showDescription: !!item.description,
        showImage: false,
        required: false,
        options: [],
        scale: {},
        imageUrl: null,
        correctAnswerIndex: [],
        correctAnswers: [],
        points: 1,
      });
      continue;
    }

    if (item.questionGroupItem) {
      skipped.push({ title: item.title || "Untitled", reason: "grid questions aren't supported" });
      continue;
    }

    if (item.imageItem || item.videoItem) {
      skipped.push({ title: item.title || "Untitled", reason: "image/video items aren't supported" });
      continue;
    }

    if (!item.questionItem) {
      skipped.push({ title: item.title || "Untitled", reason: "unsupported item type" });
      continue;
    }

    const { question, skip } = translateQuestionItem(item);
    if (skip) {
      skipped.push({ title: item.title || "Untitled", reason: skip });
    } else {
      questions.push(question);
    }
  }

  return { title, description, questions, skipped };
}

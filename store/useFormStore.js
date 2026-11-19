import { create } from 'zustand';
import { formsApi } from '../src/features/forms/services/formsApi';
import { getQuestionType, createQuestionDefaults } from '../src/lib/questionTypes';
import { createMatrixRow, createMatrixColumn, buildPresetColumns, DEFAULT_MATRIX_SETTINGS } from '../src/lib/matrixQuestions';
import { supportsAnswerNavigation } from '../src/lib/sectionFlow';

let fallbackId = 0;
const nextId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `question-${Date.now()}-${fallbackId++}`;

const DEFAULT_QUESTION_DEFAULTS = { required: false, points: 1 };

const createQuestion = (type, defaults = DEFAULT_QUESTION_DEFAULTS) => ({
  id: nextId(),
  type,
  title: "",
  description: "",
  showDescription: false,
  showImage: false,
  required: !!defaults.required,
  rows: [],
  ...createQuestionDefaults(type),
  imageUrl: null,
  correctAnswerIndex: [],
  correctAnswers: [],
  points: defaults.points,
});

const createSection = () => ({
  id: nextId(),
  type: "section",
  title: "",
  description: "",
});

// Section links point at a section by id, so removing a section must unlink everything aimed at
// it. Those targets fall back to "continue to next section" (null), as in Google Forms.
const unlinkSection = (questions, sectionId) =>
  questions.map((q) => {
    const nav = q.navigation;
    if (!nav) return q;
    const next = nav.next === sectionId ? null : nav.next;
    const options = Array.isArray(nav.options) ? nav.options.map((t) => (t === sectionId ? null : t)) : nav.options;
    return next === nav.next && options === nav.options ? q : { ...q, navigation: { ...nav, next, options } };
  });

// Timer/session-code policy now lives on the session itself, not the form — a form only
// carries grading-disclosure and retake policy.
const DEFAULT_FORM_SETTINGS = {
  allowMultipleResponses: false,
  showScoreImmediately: true,
  revealCorrectAnswers: false,
  blurOnDisconnect: false,
  restrictCopying: false,
  shuffleQuestions: false,
  isQuiz: null,
  showMissedQuestions: false,
  showPointValues: false,
  collectEmail: false,
  allowDownloadCopy: true,
  allowResponseEditing: false,
  showProgressBar: true,
  showSubmitAnother: false,
  confirmationMessage: "",
  disableAutosave: false,
};

const signature = (form) => JSON.stringify({
  title: form.formTitle,
  description: form.formDescription,
  bannerImage: form.bannerImage,
  settings: form.formSettings,
  questions: form.questions,
  subjectId: form.subjectId,
});

const useFormStore = create((set, get) => ({
  // 1. Raw State
  formId: null,
  questions: [],
  mode: "edit",
  formTitle: "",
  formDescription: "",
  bannerImage: null,
  subjectId: null,
  formSettings: DEFAULT_FORM_SETTINGS,
  saveStatus: "idle", // idle | saving | saved | error
  saveError: null,
  savedSignature: null,
  // True when this form is linked to the cloud and has edits the cloud copy doesn't have yet.
  cloudUnsaved: false,
  // Server-wide "Question defaults"; filled in by the editor when it opens (see forms/[formId]/_layout.tsx).
  questionDefaults: DEFAULT_QUESTION_DEFAULTS,

  // 2. Grouped Actions (Cleaner to import and call in components)
  actions: {
    loadForm: (form) => {
      const next = {
        formId: form.id,
        formTitle: form.title,
        formDescription: form.description,
        bannerImage: form.bannerImage || null,
        subjectId: form.subjectId ?? null,
        formSettings: { ...DEFAULT_FORM_SETTINGS, ...form.settings },
        // A question a Google structural sync marked removed (see server/forms/questionDiff.js)
        // is kept server-side so its past answers stay labeled in All Responses, but it has no
        // place in the live editor/respondent form — excluded here, and the server independently
        // re-preserves it on save regardless of what this array contains (see updateForm).
        questions: (form.questions || []).filter((q) => !q.removedAt),
        mode: "edit",
        saveStatus: "idle",
        saveError: null,
        cloudUnsaved: !!form.hasUnsavedCloudChanges,
      };
      set({ ...next, savedSignature: signature(next) });
    },

    setCloudUnsaved: (cloudUnsaved) => set({ cloudUnsaved }),

    setQuestionDefaults: (patch) => set((state) => ({ questionDefaults: { ...state.questionDefaults, ...patch } })),

    setSubjectId: (subjectId) => {
      if (get().mode === "view") return;
      set({ subjectId });
    },

    saveForm: async () => {
      const { formId, formTitle, formDescription, bannerImage, formSettings, questions, subjectId, mode } = get();
      if (!formId || mode === "view") return;
      const submittedSignature = signature(get());
      set({ saveStatus: "saving", saveError: null });
      try {
        const saved = await formsApi.update(formId, {
          title: formTitle,
          description: formDescription,
          bannerImage,
          settings: formSettings,
          questions,
          subjectId,
        });
        set({
          saveStatus: "saved",
          savedSignature: submittedSignature,
          cloudUnsaved: !!saved.hasUnsavedCloudChanges,
        });
      } catch (err) {
        set({ saveStatus: "error", saveError: err.message });
      }
    },

    // Like Google Forms, a new item lands right after the selected one (or at the end).
    // Returns the new id so the editor can select it.
    addQuestion: (type, afterId) => {
      if (get().mode === "view") return null;
      const item = createQuestion(type, get().questionDefaults);
      set((state) => {
        // The form header sits above every question, so adding "after" it means at the very top.
        const i = afterId === "form-header" ? -2 : afterId ? state.questions.findIndex((q) => q.id === afterId) : -1;
        const questions = [...state.questions];
        questions.splice(i === -1 ? questions.length : i + 1, 0, item);
        return { questions };
      });
      return item.id;
    },

    addSection: (afterId) => {
      if (get().mode === "view") return null;
      const item = createSection();
      set((state) => {
        // The form header sits above every question, so adding "after" it means at the very top.
        const i = afterId === "form-header" ? -2 : afterId ? state.questions.findIndex((q) => q.id === afterId) : -1;
        const questions = [...state.questions];
        questions.splice(i === -1 ? questions.length : i + 1, 0, item);
        return { questions };
      });
      return item.id;
    },

    updateQuestion: (id, patch) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
      }));
    },

    changeQuestionType: (id, type) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) => {
          if (q.id !== id) return q;
          if (q.type === type) return q;
          const prevDef = getQuestionType(q.type);
          const def = getQuestionType(type);
          const wasGrid = !!prevDef?.isGridBased;
          const isGrid = !!def?.isGridBased;

          // Switching between the two grid types keeps rows/columns/settings as-is — only
          // the per-row selection behavior (single vs. multi) changes, not the shared scale.
          if (isGrid && wasGrid) {
            return { ...q, type };
          }

          if (isGrid && !wasGrid) {
            const defaults = createQuestionDefaults(type);
            return { ...q, type, ...defaults, correctAnswerIndex: [], correctAnswers: [], navigation: undefined };
          }

          if (!isGrid && wasGrid) {
            const defaults = createQuestionDefaults(type);
            return { ...q, type, ...defaults, correctAnswerIndex: [], correctAnswers: [], navigation: undefined };
          }

          const needsOptions = !!def?.isOptionBased;
          const isSingleSelect = !!def?.isSingleSelect;
          // Only multiple choice and dropdown can send a respondent to a section by their answer.
          const keepsNavigation = supportsAnswerNavigation(type) && Array.isArray(q.navigation?.options);
          return {
            ...q,
            type,
            navigation: keepsNavigation ? q.navigation : undefined,
            options: needsOptions ? (q.options.length ? q.options : ["Option 1"]) : q.options,
            correctAnswerIndex: needsOptions
              ? (isSingleSelect ? q.correctAnswerIndex.slice(0, 1) : q.correctAnswerIndex)
              : [],
            correctAnswers: def?.usesTextAnswerKey ? q.correctAnswers : [],
          };
        }),
      }));
    },

    deleteQuestion: (id) => {
      if (get().mode === "view") return;
      set((state) => ({ questions: unlinkSection(state.questions.filter((q) => q.id !== id), id) }));
    },

    // "After section": where a section goes once the respondent finishes it (null = next section).
    setSectionNext: (id, target) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) => (q.id === id ? { ...q, navigation: { ...q.navigation, next: target } } : q)),
      }));
    },

    // "Go to section based on answer" on a multiple choice / dropdown question: one target per option.
    setAnswerNavigation: (id, enabled) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) => {
          if (q.id !== id || !supportsAnswerNavigation(q.type)) return q;
          const { options: _drop, ...rest } = q.navigation || {};
          return { ...q, navigation: enabled ? { ...rest, options: q.options.map(() => null) } : rest };
        }),
      }));
    },

    setOptionTarget: (id, index, target) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) => {
          if (q.id !== id || !Array.isArray(q.navigation?.options)) return q;
          return { ...q, navigation: { ...q.navigation, options: q.navigation.options.map((t, i) => (i === index ? target : t)) } };
        }),
      }));
    },

    duplicateQuestion: (id) => {
      if (get().mode === "view") return;
      set((state) => {
        const index = state.questions.findIndex((q) => q.id === id);
        if (index === -1) return state;
        const copy = { ...state.questions[index], id: nextId() };
        const questions = [...state.questions];
        questions.splice(index + 1, 0, copy);
        return { questions };
      });
    },

    moveQuestion: (id, direction) => {
      if (get().mode === "view") return;
      set((state) => {
        const index = state.questions.findIndex((q) => q.id === id);
        const target = index + direction;
        if (index === -1 || target < 0 || target >= state.questions.length) return state;
        const questions = [...state.questions];
        [questions[index], questions[target]] = [questions[target], questions[index]];
        return { questions };
      });
    },

    // Drag-and-drop move: `toIndex` is the position in the current list to insert before. A section
    // brings the questions under it along, so a whole section moves as one block.
    moveItem: (id, toIndex) => {
      if (get().mode === "view") return;
      set((state) => {
        const from = state.questions.findIndex((q) => q.id === id);
        if (from === -1) return state;
        let end = from + 1;
        if (state.questions[from].type === "section") {
          while (end < state.questions.length && state.questions[end].type !== "section") end++;
        }
        if (toIndex >= from && toIndex <= end) return state;
        const block = state.questions.slice(from, end);
        const rest = [...state.questions.slice(0, from), ...state.questions.slice(end)];
        const at = toIndex > from ? toIndex - block.length : toIndex;
        return { questions: [...rest.slice(0, at), ...block, ...rest.slice(at)] };
      });
    },

    addOption: (id) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) =>
          q.id === id
            ? {
                ...q,
                options: [...q.options, `Option ${q.options.length + 1}`],
                ...(Array.isArray(q.navigation?.options) ? { navigation: { ...q.navigation, options: [...q.navigation.options, null] } } : null),
              }
            : q
        ),
      }));
    },

    updateOption: (id, index, value) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) =>
          q.id === id
            ? { ...q, options: q.options.map((opt, i) => (i === index ? value : opt)) }
            : q
        ),
      }));
    },

    removeOption: (id, index) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) => {
          if (q.id !== id) return q;
          const correctAnswerIndex = (q.correctAnswerIndex || [])
            .filter((i) => i !== index)
            .map((i) => (i > index ? i - 1 : i));
          return {
            ...q,
            options: q.options.filter((_, i) => i !== index),
            correctAnswerIndex,
            ...(Array.isArray(q.navigation?.options) ? { navigation: { ...q.navigation, options: q.navigation.options.filter((_, i) => i !== index) } } : null),
          };
        }),
      }));
    },

    updateScale: (id, patch) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) =>
          q.id === id ? { ...q, scale: { ...q.scale, ...patch } } : q
        ),
      }));
    },

    updateMatrixSettings: (id, patch) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) =>
          q.id === id ? { ...q, scale: { ...DEFAULT_MATRIX_SETTINGS, ...q.scale, ...patch } } : q
        ),
      }));
    },

    addMatrixRow: (id) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) =>
          q.id === id
            ? { ...q, rows: [...q.rows, createMatrixRow(`Row ${q.rows.length + 1}`)] }
            : q
        ),
      }));
    },

    updateMatrixRow: (id, rowId, label) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) =>
          q.id === id
            ? { ...q, rows: q.rows.map((r) => (r.id === rowId ? { ...r, label } : r)) }
            : q
        ),
      }));
    },

    removeMatrixRow: (id, rowId) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) =>
          q.id === id ? { ...q, rows: q.rows.filter((r) => r.id !== rowId) } : q
        ),
      }));
    },

    moveMatrixRow: (id, rowId, direction) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) => {
          if (q.id !== id) return q;
          const index = q.rows.findIndex((r) => r.id === rowId);
          const target = index + direction;
          if (index === -1 || target < 0 || target >= q.rows.length) return q;
          const rows = [...q.rows];
          [rows[index], rows[target]] = [rows[target], rows[index]];
          return { ...q, rows };
        }),
      }));
    },

    addMatrixColumn: (id) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) =>
          q.id === id
            ? { ...q, options: [...q.options, createMatrixColumn(`Column ${q.options.length + 1}`, q.options.length + 1)] }
            : q
        ),
      }));
    },

    updateMatrixColumn: (id, columnId, patch) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) =>
          q.id === id
            ? { ...q, options: q.options.map((c) => (c.id === columnId ? { ...c, ...patch } : c)) }
            : q
        ),
      }));
    },

    removeMatrixColumn: (id, columnId) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) =>
          q.id === id ? { ...q, options: q.options.filter((c) => c.id !== columnId) } : q
        ),
      }));
    },

    moveMatrixColumn: (id, columnId, direction) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) => {
          if (q.id !== id) return q;
          const index = q.options.findIndex((c) => c.id === columnId);
          const target = index + direction;
          if (index === -1 || target < 0 || target >= q.options.length) return q;
          const options = [...q.options];
          [options[index], options[target]] = [options[target], options[index]];
          return { ...q, options };
        }),
      }));
    },

    applyMatrixColumnPreset: (id, presetId) => {
      if (get().mode === "view") return;
      const columns = buildPresetColumns(presetId);
      if (!columns) return;
      set((state) => ({
        questions: state.questions.map((q) => (q.id === id ? { ...q, options: columns } : q)),
      }));
    },

    toggleCorrectAnswer: (id, optionIndex) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) => {
          if (q.id !== id) return q;
          const isSingleSelect = q.type === "multiple_choice" || q.type === "dropdown";
          const correctIndices = Array.isArray(q.correctAnswerIndex) ? [...q.correctAnswerIndex] : [];
          const alreadyMarked = correctIndices.includes(optionIndex);

          if (isSingleSelect) {
            return { ...q, correctAnswerIndex: alreadyMarked ? [] : [optionIndex] };
          }

          const nextIndices = alreadyMarked
            ? correctIndices.filter((i) => i !== optionIndex)
            : [...correctIndices, optionIndex];
          return { ...q, correctAnswerIndex: nextIndices };
        }),
      }));
    },

    addCorrectAnswerVariation: (id, variation) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) => {
          if (q.id !== id) return q;
          const variations = Array.isArray(q.correctAnswers) ? [...q.correctAnswers] : [];
          if (!variations.includes(variation) && variation.trim()) {
            variations.push(variation);
          }
          return { ...q, correctAnswers: variations };
        }),
      }));
    },

    removeCorrectAnswerVariation: (id, index) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) => {
          if (q.id !== id) return q;
          const variations = Array.isArray(q.correctAnswers) ? [...q.correctAnswers] : [];
          variations.splice(index, 1);
          return { ...q, correctAnswers: variations };
        }),
      }));
    },

    setMode: (mode) => set({ mode }),

    setFormTitle: (formTitle) => {
      if (get().mode === "view") return;
      set({ formTitle });
    },

    setFormDescription: (formDescription) => {
      if (get().mode === "view") return;
      set({ formDescription });
    },

    // Local-only until the next Save, same as everything else here (and like a question's own
    // image — see ImageBlock.jsx) — no separate upload endpoint, just a data: URI riding along
    // with the rest of the form.
    setBannerImage: (bannerImage) => {
      if (get().mode === "view") return;
      set({ bannerImage });
    },

    updateFormSettings: (patch) => {
      if (get().mode === "view") return;
      set((state) => ({ formSettings: { ...state.formSettings, ...patch } }));
    },
  },
}));

export const useFormActions = () => useFormStore((state) => state.actions);

export default useFormStore;

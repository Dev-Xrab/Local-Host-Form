import { create } from 'zustand';
import { formsApi } from '../src/features/forms/services/formsApi';

const OPTION_TYPES = new Set(["multiple_choice", "checkboxes", "dropdown"]);

let fallbackId = 0;
const nextId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `question-${Date.now()}-${fallbackId++}`;

const createQuestion = (type) => ({
  id: nextId(),
  type,
  title: "",
  description: "",
  showDescription: false,
  showImage: false,
  required: false,
  options: OPTION_TYPES.has(type) ? ["Option 1"] : [],
  scale: { min: 1, max: 5, minLabel: "", maxLabel: "" },
  imageUrl: null,
  correctAnswerIndex: [],
  correctAnswers: [],
  points: 1,
});

const createSection = () => ({
  id: nextId(),
  type: "section",
  title: "",
  description: "",
});

// Timer/session-code policy now lives on the session itself, not the form — a form only
// carries grading-disclosure and retake policy.
const DEFAULT_FORM_SETTINGS = {
  allowMultipleResponses: false,
  showScoreImmediately: true,
  revealCorrectAnswers: false,
};

const useFormStore = create((set, get) => ({
  // 1. Raw State
  formId: null,
  questions: [],
  mode: "edit",
  formTitle: "",
  formDescription: "",
  subjectId: null,
  formSettings: DEFAULT_FORM_SETTINGS,
  saveStatus: "idle", // idle | saving | saved | error
  saveError: null,
  recalculatedResponses: 0,

  // 2. Grouped Actions (Cleaner to import and call in components)
  actions: {
    loadForm: (form) =>
      set({
        formId: form.id,
        formTitle: form.title,
        formDescription: form.description,
        subjectId: form.subjectId ?? null,
        formSettings: { ...DEFAULT_FORM_SETTINGS, ...form.settings },
        questions: form.questions,
        mode: "edit",
        saveStatus: "idle",
        saveError: null,
        recalculatedResponses: 0,
      }),

    setSubjectId: (subjectId) => {
      if (get().mode === "view") return;
      set({ subjectId });
    },

    saveForm: async () => {
      const { formId, formTitle, formDescription, formSettings, questions, subjectId, mode } = get();
      if (!formId || mode === "view") return;
      set({ saveStatus: "saving", saveError: null });
      try {
        const saved = await formsApi.update(formId, {
          title: formTitle,
          description: formDescription,
          settings: formSettings,
          questions,
          subjectId,
        });
        set({ saveStatus: "saved", recalculatedResponses: saved.recalculatedResponses || 0 });
      } catch (err) {
        set({ saveStatus: "error", saveError: err.message });
      }
    },

    addQuestion: (type) => {
      if (get().mode === "view") return;
      set((state) => ({ questions: [...state.questions, createQuestion(type)] }));
    },

    addSection: () => {
      if (get().mode === "view") return;
      set((state) => ({ questions: [...state.questions, createSection()] }));
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
          const needsOptions = OPTION_TYPES.has(type);
          const isSingleSelect = type === "multiple_choice" || type === "dropdown";
          return {
            ...q,
            type,
            options: needsOptions ? (q.options.length ? q.options : ["Option 1"]) : q.options,
            correctAnswerIndex: needsOptions
              ? (isSingleSelect ? q.correctAnswerIndex.slice(0, 1) : q.correctAnswerIndex)
              : [],
            correctAnswers: ["short_answer", "paragraph"].includes(type) ? q.correctAnswers : [],
          };
        }),
      }));
    },

    deleteQuestion: (id) => {
      if (get().mode === "view") return;
      set((state) => ({ questions: state.questions.filter((q) => q.id !== id) }));
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

    addOption: (id) => {
      if (get().mode === "view") return;
      set((state) => ({
        questions: state.questions.map((q) =>
          q.id === id ? { ...q, options: [...q.options, `Option ${q.options.length + 1}`] } : q
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

    updateFormSettings: (patch) => {
      if (get().mode === "view") return;
      set((state) => ({ formSettings: { ...state.formSettings, ...patch } }));
    },
  },
}));

export const useFormActions = () => useFormStore((state) => state.actions);

export default useFormStore;

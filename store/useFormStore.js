import { create } from 'zustand';

const OPTION_TYPES = new Set(["multiple_choice", "checkboxes", "dropdown"]);

let fallbackId = 0;
const nextId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `question-${Date.now()}-${fallbackId++}`;

const SESSION_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const nextSessionCode = () =>
  Array.from({ length: 6 }, () => SESSION_CODE_CHARS[Math.floor(Math.random() * SESSION_CODE_CHARS.length)]).join("");

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
});

const createSection = () => ({
  id: nextId(),
  type: "section",
  title: "",
  description: "",
});

const useFormStore = create((set) => ({
  // 1. Raw State
  questions: [],
  mode: "edit",
  sessions: [],
  formTitle: "",
  formDescription: "",
  formSettings: {
    requireSessionCode: true,
    allowMultipleResponses: false,
    timerEnabled: false,
    timerMinutes: 30,
    showScoreImmediately: true,
    revealCorrectAnswers: false,
  },

  // 2. Grouped Actions (Cleaner to import and call in components)
  actions: {
    addQuestion: (type) =>
      set((state) => ({ questions: [...state.questions, createQuestion(type)] })),

    addSection: () =>
      set((state) => ({ questions: [...state.questions, createSection()] })),

    updateQuestion: (id, patch) =>
      set((state) => ({
        questions: state.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
      })),

    changeQuestionType: (id, type) =>
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
      })),

    deleteQuestion: (id) =>
      set((state) => ({ questions: state.questions.filter((q) => q.id !== id) })),

    duplicateQuestion: (id) =>
      set((state) => {
        const index = state.questions.findIndex((q) => q.id === id);
        if (index === -1) return state;
        const copy = { ...state.questions[index], id: nextId() };
        const questions = [...state.questions];
        questions.splice(index + 1, 0, copy);
        return { questions };
      }),

    moveQuestion: (id, direction) =>
      set((state) => {
        const index = state.questions.findIndex((q) => q.id === id);
        const target = index + direction;
        if (index === -1 || target < 0 || target >= state.questions.length) return state;
        const questions = [...state.questions];
        [questions[index], questions[target]] = [questions[target], questions[index]];
        return { questions };
      }),

    addOption: (id) =>
      set((state) => ({
        questions: state.questions.map((q) =>
          q.id === id ? { ...q, options: [...q.options, `Option ${q.options.length + 1}`] } : q
        ),
      })),

    updateOption: (id, index, value) =>
      set((state) => ({
        questions: state.questions.map((q) =>
          q.id === id
            ? { ...q, options: q.options.map((opt, i) => (i === index ? value : opt)) }
            : q
        ),
      })),

    removeOption: (id, index) =>
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
      })),

    updateScale: (id, patch) =>
      set((state) => ({
        questions: state.questions.map((q) =>
          q.id === id ? { ...q, scale: { ...q.scale, ...patch } } : q
        ),
      })),

    toggleCorrectAnswer: (id, optionIndex) =>
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
      })),

    addCorrectAnswerVariation: (id, variation) =>
      set((state) => ({
        questions: state.questions.map((q) => {
          if (q.id !== id) return q;
          const variations = Array.isArray(q.correctAnswers) ? [...q.correctAnswers] : [];
          if (!variations.includes(variation) && variation.trim()) {
            variations.push(variation);
          }
          return { ...q, correctAnswers: variations };
        }),
      })),

    removeCorrectAnswerVariation: (id, index) =>
      set((state) => ({
        questions: state.questions.map((q) => {
          if (q.id !== id) return q;
          const variations = Array.isArray(q.correctAnswers) ? [...q.correctAnswers] : [];
          variations.splice(index, 1);
          return { ...q, correctAnswers: variations };
        }),
      })),

    setMode: (mode) => set({ mode }),

    setFormTitle: (formTitle) => set({ formTitle }),

    setFormDescription: (formDescription) => set({ formDescription }),

    updateFormSettings: (patch) =>
      set((state) => ({ formSettings: { ...state.formSettings, ...patch } })),

    startSession: () =>
      set((state) => {
        const existingCodes = new Set(state.sessions.map((s) => s.code));
        let code = nextSessionCode();
        while (existingCodes.has(code)) code = nextSessionCode();

        const session = {
          id: nextId(),
          code,
          status: "active",
          startedAt: new Date().toISOString(),
          endedAt: null,
          responses: [],
        };
        return { sessions: [...state.sessions, session] };
      }),

    endSession: (id) =>
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === id && s.status === "active"
            ? { ...s, status: "ended", endedAt: new Date().toISOString() }
            : s
        ),
      })),

    deleteSession: (id) =>
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== id),
      })),
  },
}));

export const useFormActions = () => useFormStore((state) => state.actions);

export default useFormStore;

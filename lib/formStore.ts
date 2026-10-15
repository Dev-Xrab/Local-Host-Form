import type { UseBoundStore, StoreApi } from "zustand";
import useFormStoreJs, { useFormActions as useFormActionsJs } from "../store/useFormStore";
import { QUESTION_TYPES as TYPES_JS, getQuestionType as getTypeJs } from "../src/lib/questionTypes";

export interface MatrixRow { id: string; label: string }
export interface MatrixColumn { id: string; label: string; value: number }
export interface Scale { min: number; max: number; minLabel: string; maxLabel: string; requireAllRows?: boolean }

export interface Question {
  id: string;
  type: string;
  title: string;
  description: string;
  showDescription: boolean;
  showImage: boolean;
  required: boolean;
  options: (string | MatrixColumn)[];
  rows: MatrixRow[];
  scale: Scale;
  imageUrl: string | null;
  correctAnswerIndex: number[];
  correctAnswers: string[];
  points: number;
  removedAt?: string | null;
}

export interface FormSettings {
  allowMultipleResponses: boolean;
  showScoreImmediately: boolean;
  revealCorrectAnswers: boolean;
  blurOnDisconnect: boolean;
  restrictCopying: boolean;
  shuffleQuestions: boolean;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface FormState {
  formId: string | null;
  questions: Question[];
  mode: "edit" | "view";
  formTitle: string;
  formDescription: string;
  bannerImage: string | null;
  subjectId: string | null;
  formSettings: FormSettings;
  saveStatus: SaveStatus;
  saveError: string | null;
  recalculatedResponses: number;
  cloudUnsaved: boolean;
}

export interface FormActions {
  loadForm: (form: unknown) => void;
  saveForm: () => Promise<void>;
  setMode: (mode: "edit" | "view") => void;
  setCloudUnsaved: (v: boolean) => void;
  setSubjectId: (id: string | null) => void;
  addQuestion: (type: string) => void;
  addSection: () => void;
  updateQuestion: (id: string, patch: Partial<Question>) => void;
  changeQuestionType: (id: string, type: string) => void;
  deleteQuestion: (id: string) => void;
  duplicateQuestion: (id: string) => void;
  moveQuestion: (id: string, direction: -1 | 1) => void;
  addOption: (id: string) => void;
  updateOption: (id: string, index: number, value: string) => void;
  removeOption: (id: string, index: number) => void;
  updateScale: (id: string, patch: Partial<Scale>) => void;
  updateMatrixSettings: (id: string, patch: Partial<Scale>) => void;
  addMatrixRow: (id: string) => void;
  updateMatrixRow: (id: string, rowId: string, label: string) => void;
  removeMatrixRow: (id: string, rowId: string) => void;
  moveMatrixRow: (id: string, rowId: string, direction: -1 | 1) => void;
  addMatrixColumn: (id: string) => void;
  updateMatrixColumn: (id: string, columnId: string, patch: Partial<MatrixColumn>) => void;
  removeMatrixColumn: (id: string, columnId: string) => void;
  moveMatrixColumn: (id: string, columnId: string, direction: -1 | 1) => void;
  applyMatrixColumnPreset: (id: string, presetId: string) => void;
  toggleCorrectAnswer: (id: string, optionIndex: number) => void;
  addCorrectAnswerVariation: (id: string, variation: string) => void;
  removeCorrectAnswerVariation: (id: string, index: number) => void;
  setFormTitle: (v: string) => void;
  setFormDescription: (v: string) => void;
  setBannerImage: (v: string | null) => void;
  updateFormSettings: (patch: Partial<FormSettings>) => void;
}

// The store itself is the existing JS Zustand store; these are typed views over it.
export const useFormStore = useFormStoreJs as unknown as UseBoundStore<StoreApi<FormState & { actions: FormActions }>>;
export const useFormActions = useFormActionsJs as unknown as () => FormActions;

export interface QuestionTypeMeta {
  id: string;
  label: string;
  icon: string;
  isOptionBased: boolean;
  isSingleSelect: boolean;
  isGradable: boolean;
  usesTextAnswerKey: boolean;
  isGridBased?: boolean;
}
export const QUESTION_TYPES = TYPES_JS as QuestionTypeMeta[];
export const getQuestionType = getTypeJs as (type: string) => QuestionTypeMeta | undefined;

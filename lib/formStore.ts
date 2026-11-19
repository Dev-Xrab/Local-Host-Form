import type { UseBoundStore, StoreApi } from "zustand";
import useFormStoreJs, { useFormActions as useFormActionsJs } from "../store/useFormStore";
import { QUESTION_TYPES as TYPES_JS, getQuestionType as getTypeJs } from "../src/lib/questionTypes";

export interface MatrixRow { id: string; label: string }
export interface MatrixColumn { id: string; label: string; value: number }
export interface Scale { min: number; max: number; minLabel: string; maxLabel: string; requireAllRows?: boolean }

/** Where a section link goes: `null` = continue to the next section, "submit", or a section id. */
export type SectionTarget = string | null;
export interface Navigation {
  /** Section: where to go after it ("After section N"). */
  next?: SectionTarget;
  /** Multiple choice / dropdown: where each option goes ("Go to section based on answer"). */
  options?: SectionTarget[];
}

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
  navigation?: Navigation;
}

export interface FormSettings {
  allowMultipleResponses: boolean;
  showScoreImmediately: boolean;
  revealCorrectAnswers: boolean;
  blurOnDisconnect: boolean;
  restrictCopying: boolean;
  shuffleQuestions: boolean;
  /** `null` = decide from the questions (a form with answer keys stays a quiz). */
  isQuiz: boolean | null;
  showMissedQuestions: boolean;
  showPointValues: boolean;
  collectEmail: boolean;
  allowDownloadCopy: boolean;
  allowResponseEditing: boolean;
  showProgressBar: boolean;
  showSubmitAnother: boolean;
  confirmationMessage: string;
  disableAutosave: boolean;
  downloadIncludesChoices?: boolean;
}

/** What a brand-new question starts as (Settings > Defaults > Question defaults). */
export interface QuestionDefaults { required: boolean; points: number }

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
  savedSignature: string | null;
  cloudUnsaved: boolean;
  questionDefaults: QuestionDefaults;
}

export interface FormActions {
  loadForm: (form: unknown) => void;
  saveForm: () => Promise<void>;
  setMode: (mode: "edit" | "view") => void;
  setCloudUnsaved: (v: boolean) => void;
  setQuestionDefaults: (d: Partial<QuestionDefaults>) => void;
  setSubjectId: (id: string | null) => void;
  addQuestion: (type: string, afterId?: string | null) => string | null;
  addSection: (afterId?: string | null) => string | null;
  updateQuestion: (id: string, patch: Partial<Question>) => void;
  setSectionNext: (id: string, target: SectionTarget) => void;
  setAnswerNavigation: (id: string, enabled: boolean) => void;
  setOptionTarget: (id: string, index: number, target: SectionTarget) => void;
  changeQuestionType: (id: string, type: string) => void;
  deleteQuestion: (id: string) => void;
  duplicateQuestion: (id: string) => void;
  moveQuestion: (id: string, direction: -1 | 1) => void;
  moveItem: (id: string, toIndex: number) => void;
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

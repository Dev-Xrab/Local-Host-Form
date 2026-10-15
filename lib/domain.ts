// Shapes returned by the local Express API (see server/*/repository.js). The legacy JS hooks and
// services are reused unchanged, so these types are declared here and applied via the wrappers in
// lib/data.ts rather than inferred from untyped JS.

export interface FormSummary {
  id: string;
  title: string;
  description: string;
  subjectId: string | null;
  questionCount: number;
  responseCount: number;
  lastResponseAt: string | null;
  updatedAt: string;
  googleFormId?: string | null;
  remoteFormId?: string | null;
  remoteVersion?: number | null;
  hasUnsavedCloudChanges?: boolean;
  unsavedResponseCount?: number;
}

export interface Subject {
  id: string;
  name: string;
  code?: string | null;
  isDefault?: boolean;
  formCount: number;
  updatedAt?: string;
}

export interface SessionSummary {
  id: string;
  name: string | null;
  formId: string;
  formTitle: string;
  code: string;
  /** False for placeholder sessions (synced, imported or from Google): their code is a label, not a join code. */
  joinable?: boolean;
  status: "draft" | "active" | "ended";
  submittedCount: number;
  inProgressCount: number;
  durationMinutes: number | null;
  subjectId?: string | null;
  createdAt?: string;
  startedAt?: string | null;
  endedAt?: string | null;
}

export interface Hook<T> {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  data: T;
}

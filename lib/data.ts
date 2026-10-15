import { useForms as useFormsJs } from "../src/features/forms/hooks/useForms";
import { useSubjects as useSubjectsJs } from "../src/features/subjects/hooks/useSubjects";
import { useSessions as useSessionsJs } from "../src/features/sessions/hooks/useSessions";
import { useTunnel as useTunnelJs } from "../src/features/tunnel/hooks/useTunnel";
import { useCloudAccount as useCloudAccountJs } from "../src/features/cloud/hooks/useCloudAccount";
import type { FormSummary, SessionSummary, Subject } from "./domain";

type Loadable = { loading: boolean; error: string | null; refresh: () => Promise<void> };

// Typed views over the existing JS data hooks. Behavior (fetching, polling) is unchanged.
export const useForms = () => useFormsJs() as unknown as Loadable & { forms: FormSummary[] };
export const useSubjects = () => useSubjectsJs() as unknown as Loadable & { subjects: Subject[] };
export const useSessions = () => useSessionsJs() as unknown as Loadable & { sessions: SessionSummary[] };

export interface TunnelState {
  status: "idle" | "installing" | "starting" | "connected" | "error";
  url: string | null;
  error: string | null;
  loading: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}
export const useTunnel = () => useTunnelJs() as unknown as TunnelState;

export interface CloudAccountState {
  account: { email?: string; name?: string; picture?: string } | null;
  connected: boolean;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<unknown>;
}
export const useCloudAccount = () => useCloudAccountJs() as unknown as CloudAccountState;

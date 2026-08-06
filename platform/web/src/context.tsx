import { createContext, useContext } from "react";
import type { SessionPayload, WorkspaceSnapshot } from "./types";

export interface WorkspaceContextValue {
  session: SessionPayload;
  snapshot: WorkspaceSnapshot;
  reload: () => Promise<void>;
  notify: (message: string, tone?: "success" | "error") => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const WorkspaceProvider = WorkspaceContext.Provider;

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  return value;
}

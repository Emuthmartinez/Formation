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

/**
 * Runs a mutation, then refreshes the snapshot — keeping the two failure modes honest.
 * A failed mutation gets the real error. A mutation that succeeded but whose follow-up
 * refresh failed is reported as saved-but-stale, never as a failure of the action itself.
 * Returns true when the mutation itself succeeded.
 */
export async function runMutation(
  { reload, notify }: Pick<WorkspaceContextValue, "reload" | "notify">,
  mutation: () => Promise<unknown>,
  successMessage: string,
): Promise<boolean> {
  try {
    await mutation();
  } catch (error) {
    notify(error instanceof Error ? error.message : String(error), "error");
    return false;
  }
  try {
    await reload();
    notify(successMessage);
  } catch {
    notify("Saved. The page could not refresh just now — reload to see the latest state.", "error");
  }
  return true;
}

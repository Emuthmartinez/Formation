import { useWorkspace } from "./context";
import type { Capability, WorkspaceRole } from "./types";

/**
 * What this member may do here.
 *
 * The list comes from the server with every snapshot — the rules themselves live in
 * server/domain/capabilities.mjs and are enforced there. This file only decides what to show. It
 * deliberately holds no copy of the role ladder: a second copy would let the interface offer a
 * control the server refuses, which is worse than not offering it at all.
 */
export function useCan(): (capability: Capability) => boolean {
  const { snapshot } = useWorkspace();
  return (capability) => snapshot.capabilities.includes(capability);
}

export function useRole(): WorkspaceRole | string {
  return useWorkspace().snapshot.membership.role;
}

const ROLE_TITLES: Record<string, string> = {
  owner: "owner",
  editor: "editor",
  reviewer: "reviewer",
  viewer: "viewer",
};

/**
 * One sentence explaining what this member can and cannot do, shown once per page rather than as a
 * disabled control beside every action. A page of greyed-out buttons reads as a broken product;
 * one plain line reads as a company with people in different jobs.
 */
export function accessSummary(role: string, capabilities: Capability[]): string | null {
  if (role === "owner") return null;
  const title = ROLE_TITLES[role] ?? "guest";
  if (capabilities.includes("work-write")) {
    return `You are an ${title} on this company. You can do the work; changing what the company is, and answering launch approvals, stays with the owner.`;
  }
  if (capabilities.includes("evidence-write")) {
    return `You are a ${title} on this company. You can raise questions and record evidence; the company's work, decisions, and source of truth stay with the team.`;
  }
  return `You are a ${title} on this company. You can read everything here and change nothing.`;
}

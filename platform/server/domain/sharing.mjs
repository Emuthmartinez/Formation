import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createId } from "./shared.mjs";

/**
 * Showing the work to someone who will never have an account.
 *
 * An invitation brings a person into the company. This is the other thing a founder needs: handing
 * an investor, an advisor, or a customer a link to one deliverable without making them a member of
 * anything. The link is the credential, so it behaves like one — high entropy, hashed at rest,
 * expiring, revocable, and never shown again after it is created.
 *
 * The important half of this file is not the token. It is `sharedView`: the projection is built by
 * naming the fields that may leave, one at a time, rather than by taking a record and deleting
 * what should not go. A record that grows a new field later does not silently start leaking it.
 */

const TOKEN_BYTES = 32;
export const SHARE_TTL_DAYS = 30;
export const MAX_ACTIVE_SHARES = 25;
export const SHARE_SCOPES = new Set(["deliverable", "company"]);

export class ShareError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ShareError";
    this.status = status;
  }
}

export function hashShareToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

function isLive(share, now) {
  return !share.revokedAt && share.expiresAt > now;
}

/** What the founder sees about their own links. Never the token, never its hash. */
export function founderShare(share) {
  return {
    id: share.id,
    scope: share.scope,
    artifactId: share.artifactId ?? null,
    label: share.label,
    createdBy: share.createdByName,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt,
    revokedAt: share.revokedAt ?? null,
    viewCount: share.viewCount ?? 0,
    lastViewedAt: share.lastViewedAt ?? null,
  };
}

export function listShares(database, workspaceId, now = new Date().toISOString()) {
  return database.shares
    .filter((entry) => entry.workspaceId === workspaceId && isLive(entry, now))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(founderShare);
}

export function createShare(database, { workspaceId, scope, artifactId, createdBy, now = new Date().toISOString() }) {
  if (!SHARE_SCOPES.has(scope)) throw new ShareError(400, "A link can share one deliverable or the company overview.");

  let label = "this company's overview";
  let evidenceAtCreation = [];
  if (scope === "deliverable") {
    const artifact = database.artifacts.find((entry) => entry.id === artifactId && entry.workspaceId === workspaceId);
    if (!artifact) throw new ShareError(404, "Deliverable not found.");
    label = artifact.title;
    evidenceAtCreation = [...(artifact.sourceClaimIds ?? [])];
  } else if (artifactId) {
    throw new ShareError(400, "A company overview link is not about one deliverable.");
  }

  const live = database.shares.filter((entry) => entry.workspaceId === workspaceId && isLive(entry, now));
  if (live.length >= MAX_ACTIVE_SHARES) {
    throw new ShareError(409, `This company already has ${live.length} live links. Stop some before creating more.`);
  }

  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const share = {
    id: createId("shr"),
    workspaceId,
    scope,
    artifactId: scope === "deliverable" ? artifactId : null,
    label,
    // The evidence attached the moment the link was made, recorded rather than read live. The
    // engine appends to an artifact's sourceClaimIds when it re-imports a verified result, with no
    // founder action — reading that list at request time meant an ordinary background import could
    // put new words in front of someone who already had the page open. The founder's own words
    // still travel live; what an automated process can add does not.
    evidenceClaimIds: scope === "deliverable" ? [...(evidenceAtCreation ?? [])] : [],
    tokenHash: hashShareToken(token),
    createdByUserId: createdBy.id,
    createdByName: createdBy.name,
    createdAt: now,
    expiresAt: new Date(new Date(now).getTime() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1_000).toISOString(),
    revokedAt: null,
    revokedByUserId: null,
    viewCount: 0,
    lastViewedAt: null,
  };
  database.shares.push(share);
  database.activity.push({
    id: createId("act"),
    workspaceId,
    type: "share-created",
    title: `${label} shared by link`,
    detail: `Anyone with the link can read it until ${share.expiresAt.slice(0, 10)}. It can be stopped at any time.`,
    actor: createdBy.name,
    createdAt: now,
  });
  return { share, token };
}

export function revokeShare(database, { workspaceId, shareId, actor, now = new Date().toISOString() }) {
  const share = database.shares.find((entry) => entry.id === shareId && entry.workspaceId === workspaceId);
  if (!share) throw new ShareError(404, "That link does not exist.");
  if (!isLive(share, now)) throw new ShareError(409, "That link has already stopped working.");
  share.revokedAt = now;
  share.revokedByUserId = actor.id;
  database.activity.push({
    id: createId("act"),
    workspaceId,
    type: "share-revoked",
    title: `${share.label} is no longer shared`,
    detail: "The link stopped working.",
    actor: actor.name,
    createdAt: now,
  });
  return founderShare(share);
}

/**
 * Find the share a raw token refers to, in constant time. Expired, revoked, and never-existed are
 * one answer, so a caller cannot learn that a link was once real.
 */
export function findLiveShare(database, token, now = new Date().toISOString()) {
  if (typeof token !== "string" || !token) return null;
  const supplied = Buffer.from(hashShareToken(token), "hex");
  for (const share of database.shares) {
    const stored = Buffer.from(String(share.tokenHash ?? ""), "hex");
    if (stored.length !== supplied.length) continue;
    if (!timingSafeEqual(stored, supplied)) continue;
    return isLive(share, now) ? share : null;
  }
  return null;
}

/**
 * Everything a link shows, and nothing else.
 *
 * Built field by field on purpose. The alternative — take the workspace or the artifact and delete
 * the parts that should not leave — means every field added to those records in future is public
 * by default until somebody remembers. Here, a new field stays private until it is named.
 *
 * What deliberately never appears: members, email addresses, activity, tasks, jobs, executions,
 * engine provenance, other deliverables, and any claim or decision the founder did not attach to
 * the deliverable being shared.
 */
export function sharedView(database, share) {
  const workspace = database.workspaces.find((entry) => entry.id === share.workspaceId);
  if (!workspace) return null;

  const company = {
    name: workspace.name,
    stage: workspace.stage,
    oneLiner: workspace.company.oneLiner,
  };

  if (share.scope === "company") {
    return {
      scope: "company",
      sharedBy: share.createdByName,
      expiresAt: share.expiresAt,
      company: {
        ...company,
        thesis: workspace.company.thesis,
        targetCustomer: workspace.company.targetCustomer,
        problem: workspace.company.problem,
        solution: workspace.company.solution,
        positioning: workspace.company.positioning,
        differentiation: workspace.company.differentiation,
        businessModel: workspace.company.businessModel,
        pricing: workspace.company.pricing,
        northStarMetric: workspace.company.northStarMetric,
        currentGoal: workspace.company.currentGoal,
      },
      workstreams: (workspace.workstreams ?? []).map((stream) => ({
        id: stream.id,
        title: stream.title,
        group: stream.group,
        summary: stream.summary,
        status: stream.status,
        progress: stream.progress,
      })),
    };
  }

  const artifact = database.artifacts.find((entry) => entry.id === share.artifactId && entry.workspaceId === share.workspaceId);
  if (!artifact) return null;

  // Only the evidence that was attached when the link was made, and only its words — not its
  // confidence, status, or engine provenance. Links created before this was recorded fall back to
  // the deliverable's current list, which is what they were already showing.
  const attached = new Set(share.evidenceClaimIds ?? artifact.sourceClaimIds ?? []);
  const evidence = database.claims
    .filter((claim) => claim.workspaceId === share.workspaceId && attached.has(claim.id))
    .map((claim) => ({ kind: claim.kind, statement: claim.statement }));

  return {
    scope: "deliverable",
    sharedBy: share.createdByName,
    expiresAt: share.expiresAt,
    company,
    deliverable: {
      title: artifact.title,
      status: artifact.status,
      version: artifact.version,
      summary: artifact.summary,
      updatedAt: artifact.updatedAt,
      sections: (artifact.sections ?? []).map((section) => ({ title: section.title, body: section.body })),
      evidence,
    },
  };
}

/**
 * A view is a fact about the link, and the founder can see it — but writing it down costs a full
 * store rewrite, and a link handed to a mailing list would turn every read into one. Views are
 * counted in memory and written at most once a minute per link, so the count stays honest and the
 * writes stay bounded by time rather than by how many people opened the page.
 */
const pendingViews = new Map();
const VIEW_FLUSH_MS = 60 * 1_000;

/** Returns the number of views to write, or 0 when it is not yet time. */
export function noteShareView(shareId, at = Date.now()) {
  const pending = pendingViews.get(shareId) ?? { count: 0, flushedAt: 0 };
  pending.count += 1;
  if (at - pending.flushedAt < VIEW_FLUSH_MS) {
    pendingViews.set(shareId, pending);
    return 0;
  }
  pendingViews.set(shareId, { count: 0, flushedAt: at });
  return pending.count;
}

export function recordShareView(database, shareId, views, now = new Date().toISOString()) {
  const share = database.shares.find((entry) => entry.id === shareId);
  if (!share || views <= 0) return;
  share.viewCount = (share.viewCount ?? 0) + views;
  share.lastViewedAt = now;
}

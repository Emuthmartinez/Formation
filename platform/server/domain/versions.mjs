/**
 * What changed between two versions of a deliverable.
 *
 * Formation keeps every version of every document, which is the right thing to keep and, on its
 * own, not much use: a founder looking at version seven can see that six earlier ones exist and
 * cannot see what any of them changed. Opening two and reading them side by side is work the
 * product should be doing.
 *
 * The summary is computed rather than stored, for two reasons. A stored note would be written by
 * whoever saved the version, which makes it a claim about the change rather than the change; and
 * a change summary that can drift from the versions it describes is worse than none, because it
 * will be believed. Versions are immutable, so recomputing always agrees with them.
 *
 * Sections are matched by their own ids first. `applyArtifactPatch` preserves a section id the
 * client sends back, so an edited section keeps its identity across versions and reads as edited
 * rather than as one section removed and another added. Where an id is absent — a version written
 * before ids were round-tripped, or a section the founder added in the editor — the title is the
 * fallback, and only then position.
 */

/** Below this similarity, an edit is a rewrite rather than a revision. */
const REWRITE_SIMILARITY = 0.6;

function words(text) {
  return String(text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter(Boolean);
}

/**
 * How much of the shorter text survives in the longer one, by word multiset. Not a diff algorithm
 * and not trying to be: the question here is "is this the same passage, edited?", and word overlap
 * answers it well enough to choose between two words in a sentence a founder reads.
 */
function similarity(before, after) {
  const left = words(before);
  const right = words(after);
  if (!left.length && !right.length) return 1;
  if (!left.length || !right.length) return 0;

  const counts = new Map();
  for (const word of left) counts.set(word, (counts.get(word) ?? 0) + 1);
  let shared = 0;
  for (const word of right) {
    const available = counts.get(word) ?? 0;
    if (available > 0) {
      shared += 1;
      counts.set(word, available - 1);
    }
  }
  return shared / Math.max(left.length, right.length);
}

function wordDelta(before, after) {
  return words(after).length - words(before).length;
}

/** Pairs the sections of two versions: by id, then by title, then by position. */
export function pairSections(before, after) {
  const previous = [...(before ?? [])];
  const pairs = [];
  const taken = new Set();

  const claim = (predicate) => {
    const index = previous.findIndex((section, position) => !taken.has(position) && predicate(section));
    if (index < 0) return null;
    taken.add(index);
    return previous[index];
  };

  for (const [position, section] of (after ?? []).entries()) {
    const byId = section.id ? claim((candidate) => candidate.id && candidate.id === section.id) : null;
    const byTitle = byId ?? claim((candidate) => candidate.title === section.title);
    // Position is a last resort only where identity is genuinely unknowable. When both sides carry
    // ids and they differ, the difference is positive evidence that these are not the same section
    // — falling through to position there turns "one added, one removed" into "one rewritten",
    // which is the single most misleading thing this summary could say.
    const candidate = previous[position];
    const byPosition =
      byTitle ??
      (candidate && !taken.has(position) && (!section.id || !candidate.id) ? (taken.add(position), candidate) : null);
    pairs.push({ before: byPosition, after: section });
  }
  for (const [position, section] of previous.entries()) {
    if (!taken.has(position)) pairs.push({ before: section, after: null });
  }
  return pairs;
}

function listChange(before, after) {
  const previous = new Set(before ?? []);
  const next = new Set(after ?? []);
  return {
    added: [...next].filter((id) => !previous.has(id)),
    removed: [...previous].filter((id) => !next.has(id)),
  };
}

/**
 * Everything that changed between two immutable versions, as founder-readable entries. `before`
 * being absent means this is the first version, which is a fact worth stating rather than a
 * comparison to make.
 */
export function summariseVersionChange(before, after) {
  if (!after) return null;
  if (!before) {
    // Version 1 was created; anything higher is simply the earliest snapshot still retained, and
    // saying it was "created" would claim the versions before it never existed.
    const created = after.version === 1;
    return {
      version: after.version,
      previousVersion: null,
      createdAt: after.createdAt,
      createdBy: after.createdBy,
      headline: created
        ? `Created with ${after.sections.length} ${after.sections.length === 1 ? "section" : "sections"}.`
        : "The earliest version still kept — there is nothing before it to compare against.",
      changes: [],
    };
  }

  const changes = [];

  if (before.title !== after.title) {
    changes.push({ kind: "title", label: "Renamed", detail: `“${before.title}” → “${after.title}”` });
  }
  if (before.status !== after.status) {
    changes.push({ kind: "status", label: "Status", detail: `${before.status} → ${after.status}` });
  }
  if (before.confidence !== after.confidence) {
    const direction = after.confidence > before.confidence ? "rose" : "fell";
    changes.push({ kind: "confidence", label: "Confidence", detail: `${direction} from ${before.confidence}% to ${after.confidence}%` });
  }
  if ((before.summary ?? "") !== (after.summary ?? "")) {
    changes.push({ kind: "summary", label: "Summary", detail: "rewritten" });
  }

  let added = 0;
  let removed = 0;
  let rewritten = 0;
  let revised = 0;
  const sectionDetails = [];

  for (const pair of pairSections(before.sections, after.sections)) {
    if (!pair.before) {
      added += 1;
      sectionDetails.push({ kind: "section-added", label: "Added", detail: pair.after.title });
      continue;
    }
    if (!pair.after) {
      removed += 1;
      sectionDetails.push({ kind: "section-removed", label: "Removed", detail: pair.before.title });
      continue;
    }
    if (pair.before.title !== pair.after.title) {
      sectionDetails.push({ kind: "section-retitled", label: "Retitled", detail: `“${pair.before.title}” → “${pair.after.title}”` });
    }
    if (pair.before.body === pair.after.body) continue;

    const delta = wordDelta(pair.before.body, pair.after.body);
    const shape = similarity(pair.before.body, pair.after.body) < REWRITE_SIMILARITY ? "rewritten" : "revised";
    if (shape === "rewritten") rewritten += 1;
    else revised += 1;
    sectionDetails.push({
      kind: `section-${shape}`,
      label: shape === "rewritten" ? "Rewritten" : "Revised",
      detail: `${pair.after.title}${delta === 0 ? "" : delta > 0 ? ` (+${delta} words)` : ` (${delta} words)`}`,
    });
  }
  changes.push(...sectionDetails);

  const claims = listChange(before.sourceClaimIds, after.sourceClaimIds);
  if (claims.added.length || claims.removed.length) {
    changes.push({
      kind: "evidence",
      label: "Evidence",
      detail: [claims.added.length ? `${claims.added.length} added` : null, claims.removed.length ? `${claims.removed.length} removed` : null].filter(Boolean).join(", "),
    });
  }
  const decisions = listChange(before.linkedDecisionIds, after.linkedDecisionIds);
  if (decisions.added.length || decisions.removed.length) {
    changes.push({
      kind: "decisions",
      label: "Linked decisions",
      detail: [decisions.added.length ? `${decisions.added.length} added` : null, decisions.removed.length ? `${decisions.removed.length} removed` : null].filter(Boolean).join(", "),
    });
  }

  return {
    version: after.version,
    previousVersion: before.version,
    createdAt: after.createdAt,
    createdBy: after.createdBy,
    headline: headlineFor({ added, removed, rewritten, revised, changes }),
    changes,
  };
}

/**
 * One sentence for the row a founder scans before deciding whether to open it. Content changes
 * lead, because they are what a version is for; a status or confidence change alone is worth
 * saying as itself rather than as "1 change".
 */
function headlineFor({ added, removed, rewritten, revised, changes }) {
  const parts = [];
  if (rewritten) parts.push(`${rewritten} ${rewritten === 1 ? "section" : "sections"} rewritten`);
  if (revised) parts.push(`${revised} ${revised === 1 ? "section" : "sections"} revised`);
  if (added) parts.push(`${added} added`);
  if (removed) parts.push(`${removed} removed`);
  if (parts.length) return `${capitalise(parts.join(", "))}.`;

  const status = changes.find((entry) => entry.kind === "status");
  if (status) return `Status ${status.detail}.`;
  const confidence = changes.find((entry) => entry.kind === "confidence");
  if (confidence) return `Confidence ${confidence.detail}.`;
  const title = changes.find((entry) => entry.kind === "title");
  if (title) return "Renamed.";
  if (changes.length) return `${changes.length} ${changes.length === 1 ? "detail" : "details"} changed.`;
  // Reachable: restoring a version records a new one whose content matches the one restored.
  return "Saved with no change to the document.";
}

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * A change summary per version of one deliverable, newest first. Versions arrive in whatever order
 * the caller holds them; this sorts by version number, which is the only ordering that can be
 * trusted — two versions saved in the same second share a timestamp.
 */
export function summariseVersionHistory(versions) {
  const ordered = [...(versions ?? [])].sort((a, b) => a.version - b.version);
  return ordered
    .map((version, index) => summariseVersionChange(index === 0 ? null : ordered[index - 1], version))
    .filter(Boolean)
    .reverse();
}

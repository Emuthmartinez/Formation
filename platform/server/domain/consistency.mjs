/**
 * Ways a company's record can disagree with itself that have nothing to do with two claims holding
 * different values for the same key.
 *
 * `detectContradictions` catches that one shape — two active claims sharing a `key` and disagreeing
 * on its value — and it is a good check, but it can only fire on claims somebody gave a key to.
 * Nothing Formation writes for itself has one: engine results, imported launch work, and generated
 * drafts all arrive with `key: null`. A workspace can now hold a hundred imported claims and still
 * report a perfectly consistent record, because none of them were eligible to be compared.
 *
 * The findings here are structural instead. Each one is a statement the record makes that another
 * part of the same record contradicts, and each is decided by looking at fields rather than at
 * language:
 *
 * - a fact with nothing behind it is not a fact, whatever it is labelled;
 * - a document approved on assumptions has been approved on the strength of things nobody checked;
 * - a document still resting on evidence that has since been retired is resting on nothing;
 * - a decision reviewed before it was made, or work due after the launch it is meant to precede,
 *   describes a sequence that cannot have happened.
 *
 * **What is deliberately not here: terminology consistency.** Catching a company that calls its
 * customers "families" in one document and "households" in another needs a record of the words the
 * company has chosen — a lexicon — and Formation has no such record. A keyword matcher without one
 * would flag synonyms as drift and miss the drift that matters, and a check that reports confidently
 * on something it cannot see is worse than an absent one. `docs/platform/remaining-gaps.md` keeps it
 * open rather than claiming it.
 *
 * Every finding names the records involved, so the founder can open the thing rather than go
 * looking for it. Nothing here changes a record: a contradiction is the founder's to resolve, and
 * two of these have a legitimate answer of "that is fine, leave it".
 */

const RETIRED_CLAIM_STATUSES = new Set(["rejected", "superseded"]);
const SETTLED_DELIVERABLE_STATUSES = new Set(["reviewed", "approved"]);
/** Below this, a claim is not asserting much; at or above it, it is asserting something. */
const ASSERTIVE_CONFIDENCE = 80;
const FINDING_LIMIT = 50;

function isCalendarOrder(earlier, later) {
  if (!earlier || !later) return true;
  return String(earlier) <= String(later);
}

function today(now) {
  return (now ?? new Date().toISOString()).slice(0, 10);
}

/**
 * Every structural disagreement in one workspace, most serious first. Pure: it reads a snapshot's
 * records and returns findings.
 */
export function detectInconsistencies({ workspace, claims, decisions, tasks, artifacts }, now) {
  const findings = [];
  const claimsById = new Map(claims.map((claim) => [claim.id, claim]));
  const push = (finding) => findings.push(finding);

  for (const claim of claims) {
    if (claim.status !== "active") continue;

    if (claim.kind === "fact" && !(claim.evidence ?? []).length) {
      push({
        id: `inc_fact_${claim.id}`,
        code: "fact-without-evidence",
        severity: "high",
        title: "Recorded as fact, with nothing behind it",
        detail: `“${claim.statement}” is filed as a fact but carries no evidence. Either attach what makes it one, or record it as an assumption so the work built on it knows what it is standing on.`,
        claimIds: [claim.id],
        workstreamId: claim.workstreamId ?? null,
      });
      continue;
    }

    if (claim.kind !== "question" && claim.confidence >= ASSERTIVE_CONFIDENCE && !(claim.evidence ?? []).length) {
      push({
        id: `inc_confident_${claim.id}`,
        code: "confidence-without-evidence",
        severity: "medium",
        title: "Held with confidence, unsupported",
        detail: `“${claim.statement}” is held at ${claim.confidence}% with no evidence recorded. Confidence that high is a claim about the evidence, so it should be possible to say what it is.`,
        claimIds: [claim.id],
        workstreamId: claim.workstreamId ?? null,
      });
    }
  }

  for (const artifact of artifacts) {
    const sources = (artifact.sourceClaimIds ?? []).map((id) => claimsById.get(id)).filter(Boolean);

    const retired = sources.filter((claim) => RETIRED_CLAIM_STATUSES.has(claim.status));
    if (retired.length) {
      push({
        id: `inc_retired_${artifact.id}`,
        code: "deliverable-on-retired-evidence",
        severity: artifact.status === "approved" ? "high" : "medium",
        title: `${artifact.title} rests on evidence that has been retired`,
        detail: `${retired.length === 1 ? "A claim" : `${retired.length} claims`} this deliverable was built from ${retired.length === 1 ? "has" : "have"} since been rejected or superseded. Re-read it before anything else depends on it.`,
        artifactId: artifact.id,
        claimIds: retired.map((claim) => claim.id),
        workstreamId: artifact.workstreamId ?? null,
      });
    }

    if (SETTLED_DELIVERABLE_STATUSES.has(artifact.status) && sources.length > 0) {
      const settled = sources.some((claim) => claim.kind === "fact" || (claim.kind === "recommendation" && claim.confidence >= ASSERTIVE_CONFIDENCE));
      if (!settled) {
        push({
          id: `inc_assumed_${artifact.id}`,
          code: "settled-on-assumptions",
          severity: "medium",
          title: `${artifact.title} is settled, but everything under it is not`,
          detail: `This deliverable is marked ${artifact.status}, and every claim it was built from is still an assumption or an open question. Marking it settled says the company has decided; the evidence underneath says it has not.`,
          artifactId: artifact.id,
          claimIds: sources.map((claim) => claim.id),
          workstreamId: artifact.workstreamId ?? null,
        });
      }
    }
  }

  for (const decision of decisions) {
    if (!isCalendarOrder(decision.decidedAt, decision.reviewAt)) {
      push({
        id: `inc_review_${decision.id}`,
        code: "reviewed-before-decided",
        severity: "medium",
        title: `${decision.title} is set to be reviewed before it was made`,
        detail: `The review date is earlier than the date this was decided, so the review has already passed by the time the decision exists. One of the two dates is wrong.`,
        decisionId: decision.id,
        workstreamId: decision.workstreamId ?? null,
      });
    }
    if (decision.status === "decided" && !decision.reviewAt) {
      push({
        id: `inc_unreviewed_${decision.id}`,
        code: "decided-without-review",
        severity: "low",
        title: `${decision.title} has no date to be looked at again`,
        detail: "A decision without a review date is one the company has agreed never to revisit. If that is right, it is right — but it should be a choice rather than an omission.",
        decisionId: decision.id,
        workstreamId: decision.workstreamId ?? null,
      });
    }
  }

  const launchTarget = workspace.launchTarget;
  if (launchTarget) {
    const late = tasks.filter((task) => task.status !== "done" && task.dueAt && task.dueAt > launchTarget);
    if (late.length) {
      push({
        id: "inc_due_after_launch",
        code: "work-due-after-launch",
        severity: "high",
        title: `${late.length === 1 ? "A task is" : `${late.length} tasks are`} due after the launch they are meant to precede`,
        detail: `The launch target is ${launchTarget}, and this work is not due until after it. Either the work is not needed for launch, or the date is not real.`,
        taskIds: late.slice(0, 10).map((task) => task.id),
        workstreamId: late[0].workstreamId ?? null,
      });
    }

    if (launchTarget < today(now) && !["launch", "growth"].includes(workspace.stage)) {
      push({
        id: "inc_launch_passed",
        code: "launch-target-passed",
        severity: "high",
        title: "The launch date has passed and the company has not launched",
        detail: `The target was ${launchTarget}, and the company is still recorded as ${workspace.stage}. Move the date or move the stage — a date that has quietly gone by stops meaning anything.`,
        workstreamId: null,
      });
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, FINDING_LIMIT);
}

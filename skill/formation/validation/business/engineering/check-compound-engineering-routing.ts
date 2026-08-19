#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import {
  asString,
  getPath,
  isRecord,
  issue,
  loadProjectState,
  normalizedStringArray,
  parseCliArgs,
  readText,
  reportAndExit,
  type Issue,
} from "../../../tooling/lib/launch-state.js";

const args = parseCliArgs(process.argv.slice(2));
const loaded = loadProjectState(args);
const issues: Issue[] = [...loaded.issues];
const state = loaded.state;

const ceRoutingStatusValues = new Set(["used", "skipped_with_reason", "fallback_equivalent", "blocked", "not_needed", "not_evaluated"]);
const availabilityValues = new Set(["available", "unavailable", "not_needed", "unknown"]);
const routeValues = new Set(["ce_full_pipeline", "ce_plan_work", "ce_fallback", "not_needed", "not_evaluated"]);
const freshnessValues = new Set(["checked", "ce_update_run", "source_registry_refresh_run", "unavailable_with_reason", "not_needed", "not_checked"]);

const engineeringLaneStatus = state ? asString(getPath(state, "lanes.engineering.status"))?.toLowerCase() : undefined;
const readinessArtifacts = [
  "engineering/ENGINEERING_PLAN.md",
  "engineering/engineering/ENGINEERING_PLAN.md",
  "engineering/PRODUCTION_READINESS.md",
  "engineering/engineering/PRODUCTION_READINESS.md",
].filter((candidate) => existsSync(path.join(args.root, candidate)));
const compoundRoute = state ? asString(getPath(state, "compound_engineering.route")) : undefined;
const engineeringInScope =
  engineeringLaneStatus === "done" ||
  (compoundRoute !== undefined && compoundRoute !== "not_evaluated" && compoundRoute !== "not_needed") ||
  readinessArtifacts.some((artifact) => hasReadinessClaim(readText(args.root, artifact) ?? ""));

const orchestration = firstText(["operations/ORCHESTRATION.md", "orchestration/operations/ORCHESTRATION.md"]);
const engineeringPlan = firstText(["engineering/ENGINEERING_PLAN.md", "engineering/engineering/ENGINEERING_PLAN.md"]);
const productionReadiness = firstText(["engineering/PRODUCTION_READINESS.md", "engineering/engineering/PRODUCTION_READINESS.md"]);

if (state && engineeringInScope) {
  const compound = getPath(state, "compound_engineering");
  if (!isRecord(compound)) {
    issues.push(
      issue(
        "error",
        "compound_engineering.state_missing",
        "state/PROJECT_STATE.yaml must include compound_engineering before core engineering readiness.",
        "state/PROJECT_STATE.yaml",
      ),
    );
  } else {
    validateCompoundState(compound, engineeringLaneStatus === "done");
  }
}

if (engineeringInScope) {
  if (!orchestration) {
    issues.push(
      issue(
        "error",
        "compound_engineering.orchestration_missing",
        "operations/ORCHESTRATION.md must record Compound Engineering routing.",
        "operations/ORCHESTRATION.md",
      ),
    );
  } else {
    requireTerms(orchestration.text, ["Compound Engineering Routing", "ce-plan", "ce-work", "ce-code-review"], orchestration.relativePath);
    if (!includesAny(orchestration.text, ["ce-update", "CE freshness check", "latest-release check"])) {
      issues.push(
        issue(
          "error",
          "compound_engineering.freshness_missing",
          "operations/ORCHESTRATION.md must record CE freshness check or latest-release fallback.",
          orchestration.relativePath,
        ),
      );
    }
    if (!includesAny(orchestration.text, ["ce-proof", "ce-demo-reel", "proof route"])) {
      issues.push(
        issue(
          "error",
          "compound_engineering.proof_route_missing",
          "operations/ORCHESTRATION.md must record CE proof or an equivalent proof route.",
          orchestration.relativePath,
        ),
      );
    }
  }
}

if (engineeringPlan) {
  requireTerms(engineeringPlan.text, ["Compound Engineering", "ce-plan", "ce-work"], engineeringPlan.relativePath);
  if (!includesAny(engineeringPlan.text, ["ce-brainstorm", "brainstorm skipped", "product direction already decisive"])) {
    issues.push(
      issue(
        "error",
        "compound_engineering.brainstorm_decision_missing",
        "engineering/ENGINEERING_PLAN.md must record ce-brainstorm use or skip rationale.",
        engineeringPlan.relativePath,
      ),
    );
  }
}

// CE-unavailable routing is a real fallback path, not just a recorded excuse:
// the plan must name the Standalone Engineering Loop (engineering-orchestration.md)
// so the build keeps the same plan/slice/review/test/proof bar without CE skills.
const ceAvailability = state ? asString(getPath(state, "compound_engineering.availability"))?.trim() : undefined;
const ceRoute = state ? asString(getPath(state, "compound_engineering.route"))?.trim() : undefined;
if ((ceAvailability === "unavailable" || ceRoute === "ce_fallback") && engineeringPlan && !engineeringPlan.text.includes("Standalone Engineering Loop")) {
  issues.push(
    issue(
      "error",
      "compound_engineering.standalone_loop_missing",
      "Compound Engineering is unavailable (or routed to ce_fallback) but engineering/ENGINEERING_PLAN.md does not record the Standalone Engineering Loop. " +
        "A fallback reason alone is documentation, not a path — record the plan/bounded-slices/adversarial-review/test/proof loop from " +
        "knowledge/engineering/engineering-orchestration.md so the readiness bar does not silently drop with CE missing.",
      engineeringPlan.relativePath,
    ),
  );
}

if (productionReadiness) {
  requireTerms(productionReadiness.text, ["ce-code-review"], productionReadiness.relativePath);
  if (!includesAny(productionReadiness.text, ["ce-test-browser", "ce-test-xcode", "MobAI", "E2E proof"])) {
    issues.push(
      issue(
        "error",
        "compound_engineering.test_route_missing",
        "engineering/PRODUCTION_READINESS.md must record CE test route, MobAI, or equivalent E2E proof.",
        productionReadiness.relativePath,
      ),
    );
  }
  if (!includesAny(productionReadiness.text, ["ce-proof", "ce-demo-reel", "proof artifact"])) {
    issues.push(
      issue(
        "error",
        "compound_engineering.readiness_proof_missing",
        "engineering/PRODUCTION_READINESS.md must record CE proof/demo or an equivalent proof artifact.",
        productionReadiness.relativePath,
      ),
    );
  }
}

reportAndExit("Compound Engineering routing check", issues);

function validateCompoundState(compound: Record<string, unknown>, engineeringDone: boolean): void {
  const availability = asString(compound.availability)?.trim() ?? "";
  const route = asString(compound.route)?.trim() ?? "";
  if (!availabilityValues.has(availability)) {
    issues.push(
      issue(
        "error",
        "compound_engineering.availability.invalid",
        `compound_engineering.availability must be one of ${Array.from(availabilityValues).join(", ")}.`,
        "state/PROJECT_STATE.yaml",
      ),
    );
  }
  if (!routeValues.has(route)) {
    issues.push(
      issue(
        "error",
        "compound_engineering.route.invalid",
        `compound_engineering.route must be one of ${Array.from(routeValues).join(", ")}.`,
        "state/PROJECT_STATE.yaml",
      ),
    );
  }
  if (availability === "unknown" || route === "not_evaluated") {
    issues.push(
      issue(
        "error",
        "compound_engineering.not_evaluated",
        "Core engineering work cannot proceed to plan/readiness with Compound Engineering still not_evaluated.",
        "state/PROJECT_STATE.yaml",
      ),
    );
  }

  const latestCheck = compound.latest_check;
  if (!isRecord(latestCheck)) {
    issues.push(
      issue(
        "error",
        "compound_engineering.latest_check.missing",
        "compound_engineering.latest_check must record CE freshness status.",
        "state/PROJECT_STATE.yaml",
      ),
    );
  } else {
    const freshnessStatus = asString(latestCheck.status)?.trim() ?? "";
    if (!freshnessValues.has(freshnessStatus)) {
      issues.push(
        issue(
          "error",
          "compound_engineering.latest_check.status.invalid",
          `latest_check.status must be one of ${Array.from(freshnessValues).join(", ")}.`,
          "state/PROJECT_STATE.yaml",
        ),
      );
    }
    if (freshnessStatus === "not_checked") {
      issues.push(
        issue(
          "error",
          "compound_engineering.latest_check.not_checked",
          "Check ce-update or record why CE latest-version verification is unavailable before core engineering.",
          "state/PROJECT_STATE.yaml",
        ),
      );
    }
  }

  const skills = normalizedStringArray(compound.skills_considered);
  if (availability === "available") {
    for (const required of ["ce-plan", "ce-work", "ce-code-review"]) {
      if (!skills.includes(required)) {
        issues.push(
          issue(
            "error",
            `compound_engineering.skills.${required}.missing`,
            `skills_considered must include ${required} when CE is available.`,
            "state/PROJECT_STATE.yaml",
          ),
        );
      }
    }
    if (!skills.some((skill) => ["ce-test-browser", "ce-test-xcode", "ce-proof", "ce-demo-reel"].includes(skill))) {
      issues.push(
        issue(
          "error",
          "compound_engineering.skills.proof_or_test_missing",
          "skills_considered must include a CE test or proof route.",
          "state/PROJECT_STATE.yaml",
        ),
      );
    }
  }

  if (availability === "unavailable" || route === "ce_fallback") {
    if (!asString(compound.fallback_reason)?.trim()) {
      issues.push(
        issue("error", "compound_engineering.fallback_reason.missing", "Unavailable CE routing requires fallback_reason.", "state/PROJECT_STATE.yaml"),
      );
    }
  }

  const fields = ["brainstorm_status", "plan_status", "work_status", "worktree_status", "review_status", "test_status", "proof_status"];
  for (const field of fields) {
    const value = asString(compound[field])?.trim() ?? "";
    if (!ceRoutingStatusValues.has(value)) {
      issues.push(
        issue(
          "error",
          `compound_engineering.${field}.invalid`,
          `${field} must be one of ${Array.from(ceRoutingStatusValues).join(", ")}.`,
          "state/PROJECT_STATE.yaml",
        ),
      );
    }
  }

  if (availability === "available" && engineeringDone) {
    for (const field of ["plan_status", "work_status", "review_status", "test_status", "proof_status"]) {
      if (asString(compound[field]) !== "used") {
        issues.push(
          issue(
            "error",
            `compound_engineering.${field}.not_used`,
            `Done engineering requires ${field}: used when CE is available.`,
            "state/PROJECT_STATE.yaml",
          ),
        );
      }
    }
  }
}

function firstText(candidates: string[]): { relativePath: string; text: string } | undefined {
  for (const candidate of candidates) {
    const text = readText(args.root, candidate);
    if (text) {
      return { relativePath: candidate, text };
    }
  }
  return undefined;
}

function requireTerms(text: string, terms: string[], filePath: string): void {
  for (const term of terms) {
    if (!text.includes(term)) {
      issues.push(
        issue(
          "error",
          `compound_engineering.${term.replaceAll(" ", "_").replaceAll("-", "_").toLowerCase()}.missing`,
          `${filePath} must include ${term}.`,
          filePath,
        ),
      );
    }
  }
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function hasReadinessClaim(text: string): boolean {
  if (!text.trim() || /Status:\s*partial until/i.test(text)) {
    return false;
  }
  return /\b(done|ready|production[- ]ready|launch[- ]ready|implementation proof|ce-work completed)\b/i.test(text);
}

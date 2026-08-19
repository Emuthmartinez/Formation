#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020, type AnySchema, type ErrorObject } from "ajv/dist/2020.js";
import { operators as operatorDefinitions } from "../catalog/operators.js";
import {
  asArray,
  asBoolean,
  asString,
  expandHome,
  flagBoolean,
  flagString,
  getPath,
  isRecord,
  issue,
  loadProjectState,
  parseFlags,
  reportAndExit,
  type Issue,
} from "./lib/launch-state.js";

interface Args {
  root: string;
  businessStatePath: string;
  launchStatePath: string;
  schemaPath: string;
  outputPath?: string;
  check: boolean;
  /** Aggregate mode: one business dir per repeated --business flag. */
  businessDirs: string[];
}

interface Workspace {
  schemaVersion: "0.2.0";
  updatedAt: string;
  product: {
    name: string;
    subtitle: string;
  };
  businesses: WorkspaceBusiness[];
  templates: WorkspaceTemplate[];
}

interface WorkspaceBusiness {
  id: string;
  name: string;
  type: string;
  updated: string;
  badge: string;
  mark: string;
  subtitle: string;
  metrics: Metric[];
  readiness: ReadinessItem[];
  agents: AgentLane[];
  lanes: WorkspaceLane[];
}

interface Metric {
  label: string;
  value: string;
  note: string;
}

interface ReadinessItem {
  status: "green" | "amber" | "red" | "quiet";
  label: string;
  tag: string;
}

interface AgentLane {
  id: string;
  name: string;
  kind: "human" | "agent" | "system";
  summary: string;
}

interface WorkspaceLane {
  id: string;
  title: string;
  summary: string;
  path: string;
  status: "Ready" | "Watch" | "Draft" | "Gate" | "Active" | "Blocked";
}

interface WorkspaceTemplate {
  name: string;
  summary: string;
  included: string[];
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDir, "..");
const args = parseArgs(process.argv.slice(2));
const issues: Issue[] = [];

const schemaResult = readJson(args.schemaPath, "workspace_schema");
issues.push(...schemaResult.issues);

/**
 * One state pair per business. Single-root mode (the default, unchanged) reads
 * the pair from --root; aggregate mode reads one pair per repeated --business
 * dir and concatenates the resulting business entries into one board — the
 * portfolio read model over the exact same per-business adapter.
 */
const businessPairs: Array<{ businessState: Record<string, unknown>; projectState: Record<string, unknown> }> = [];
const pairSources =
  args.businessDirs.length > 0
    ? args.businessDirs.map((dir) => ({
        root: dir,
        businessStatePath: resolveFrom(dir, "studio/seed/business.json"),
        launchStatePath: resolveFrom(dir, "state/PROJECT_STATE.yaml"),
      }))
    : [{ root: args.root, businessStatePath: args.businessStatePath, launchStatePath: args.launchStatePath }];

for (const source of pairSources) {
  const businessStateResult = readJson(source.businessStatePath, "business_state");
  const projectStateResult = loadProjectState({
    root: source.root,
    statePath: source.launchStatePath,
  });
  issues.push(...businessStateResult.issues, ...projectStateResult.issues);
  if (!isRecord(businessStateResult.value)) {
    issues.push(issue("error", "business_workspace.business_state.invalid", "Business state must be a JSON object.", source.businessStatePath));
  }
  if (!isRecord(projectStateResult.state)) {
    issues.push(issue("error", "business_workspace.project_state.invalid", "Project state must be a YAML object.", source.launchStatePath));
  }
  if (isRecord(businessStateResult.value) && isRecord(projectStateResult.state)) {
    businessPairs.push({ businessState: businessStateResult.value, projectState: projectStateResult.state });
  }
}

if (issues.some((item) => item.severity === "error")) {
  reportAndExit("Business Control Plane workspace render", issues);
}

const workspace = buildWorkspace(businessPairs);

// One row per business means one id per business: two dirs resolving to the
// same slug would silently overlay each other on the board.
const seenIds = new Set<string>();
for (const entry of workspace.businesses) {
  if (seenIds.has(entry.id)) {
    issues.push(
      issue(
        "error",
        "business_workspace.duplicate_business_id",
        `Two aggregated businesses resolve to the same id "${entry.id}". Give each business its own slug in studio/seed/business.json before aggregating.`,
        entry.id,
      ),
    );
  }
  seenIds.add(entry.id);
}

issues.push(...validateWorkspace(workspace, schemaResult.value, args.schemaPath));
const rendered = `${JSON.stringify(workspace, null, 2)}\n`;

if (args.outputPath) {
  if (args.check) {
    if (!existsSync(args.outputPath)) {
      issues.push(issue("error", "business_workspace.output.missing", `Generated workspace output is missing: ${args.outputPath}`, args.outputPath));
    } else {
      const current = readFileSync(args.outputPath, "utf8");
      if (current !== rendered) {
        issues.push(
          issue(
            "error",
            "business_workspace.output.drift",
            "Generated workspace output is stale. Re-run render:business-control-plane-workspace.",
            args.outputPath,
          ),
        );
      }
    }
  } else {
    mkdirSync(path.dirname(args.outputPath), { recursive: true });
    writeFileSync(args.outputPath, rendered, "utf8");
  }
} else {
  process.stdout.write(rendered);
}

reportAndExit("Business Control Plane workspace render", issues);

function parseArgs(argv: string[]): Args {
  const flags = parseFlags(argv, [
    { flags: ["--root"], key: "root" },
    { flags: ["--business-state"], key: "businessState", kind: "string" },
    { flags: ["--launch-state", "--state"], key: "launchState", kind: "string" },
    { flags: ["--schema"], key: "schema", kind: "string" },
    { flags: ["--out", "--output"], key: "output", kind: "string" },
    { flags: ["--check"], key: "check", kind: "boolean" },
  ]);
  const root = flagString(flags, "root") ?? process.cwd();
  const businessStatePath = flagString(flags, "businessState") ?? "studio/seed/business.json";
  const launchStatePath = flagString(flags, "launchState") ?? "state/PROJECT_STATE.yaml";
  const schemaPath = flagString(flags, "schema") ?? path.join(skillRoot, "studio/seed/schema/workspace.schema.json");
  const outputPath = flagString(flags, "output");

  // Aggregate mode: parseFlags keeps only the last value of a repeated flag,
  // so --business dirs are collected straight from argv. Each names one
  // business workspace (containing studio/seed/business.json + state/PROJECT_STATE.yaml).
  const businessDirs: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--business") {
      const value = argv[index + 1];
      if (value && !value.startsWith("--")) businessDirs.push(path.resolve(expandHome(value)));
    }
  }

  return {
    root,
    businessStatePath: resolveFrom(root, businessStatePath),
    launchStatePath: resolveFrom(root, launchStatePath),
    schemaPath: path.resolve(expandHome(schemaPath)),
    outputPath: outputPath ? resolveFrom(root, outputPath) : undefined,
    check: flagBoolean(flags, "check"),
    businessDirs,
  };
}

function buildWorkspace(pairs: Array<{ businessState: Record<string, unknown>; projectState: Record<string, unknown> }>): Workspace {
  const businesses = pairs.map((pair) => buildBusiness(pair.businessState, pair.projectState));
  const updatedAt =
    businesses
      .map((business) => business.updated)
      .sort()
      .pop() ?? new Date().toISOString().slice(0, 10);

  return {
    schemaVersion: "0.2.0",
    updatedAt,
    product: {
      name: "Business Control",
      subtitle: "Local-first control plane for repo-backed businesses",
    },
    businesses,
    templates: defaultTemplates(),
  };
}

function buildBusiness(businessState: Record<string, unknown>, projectState: Record<string, unknown>): WorkspaceBusiness {
  const business = businessState.business;
  const project = getPath(projectState, "project");
  const businessName = concreteString(getPath(business, "name")) || concreteString(getPath(project, "name")) || "Unnamed Business";
  const businessSlug = concreteString(getPath(business, "slug")) || concreteString(getPath(project, "slug")) || slugify(businessName);
  const businessStage = concreteString(getPath(business, "stage")) || concreteString(getPath(project, "phase")) || "concept";
  const updatedAt = concreteString(businessState.updatedAt) || concreteString(getPath(projectState, "updated_at")) || new Date().toISOString().slice(0, 10);
  const platforms = asArray(getPath(project, "platforms"))
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
  const productType = concreteString(getPath(businessState, "designBrief.productType"));
  const subtitle =
    concreteString(getPath(business, "positioning")) ||
    concreteString(getPath(projectState, "continuity.next_action")) ||
    "Local business workspace generated from launch and design state.";
  const launchLanes = laneRecords(projectState);
  const evidenceCount = launchLanes.reduce((count, [, lane]) => count + asArray(lane.evidence).length, 0);
  const blockedCount = launchLanes.filter(([, lane]) => asString(lane.status) === "blocked").length;
  const doneCount = launchLanes.filter(([, lane]) => asString(lane.status) === "done").length;
  const driftRiskCount = asArray(getPath(projectState, "continuity.drift_risks")).length;
  const activeFailureCards = asArray(getPath(projectState, "failure_cards.active")).length;
  const riskCount = blockedCount + driftRiskCount + activeFailureCards;

  return {
    id: businessSlug,
    name: businessName,
    type: productType || platformType(platforms),
    updated: updatedAt,
    badge: stageBadge(businessStage),
    mark: initials(businessName),
    subtitle,
    metrics: [
      { label: "Stage", value: stageBadge(businessStage), note: businessStage },
      { label: "Lanes", value: `${doneCount}/${launchLanes.length}`, note: `${blockedCount} blocked` },
      { label: "Artifacts", value: String(evidenceCount), note: "evidence refs" },
      { label: "Risk", value: String(riskCount), note: "blockers + drift + cards" },
    ],
    readiness: readinessItems(businessState, projectState),
    agents: agentLanes(businessState, projectState, launchLanes, blockedCount),
    lanes: workspaceLanes(businessState, projectState, launchLanes),
  };
}

function readinessItems(businessState: Record<string, unknown>, projectState: Record<string, unknown>): ReadinessItem[] {
  const continuityReviewed = asString(getPath(projectState, "continuity.last_state_review")) !== "not_reviewed";
  const gitReviewed = asBoolean(getPath(projectState, "continuity.git_status_reviewed")) === true;
  const orchestrationReady = asBoolean(getPath(projectState, "orchestration.preflight_done")) === true;
  const designRoomStatus = asString(getPath(businessState, "designRoom.status")) || "not_started";
  const designRoomReady = new Set(["rendered", "baselined"]).has(designRoomStatus);
  const compoundRoute = asString(getPath(projectState, "compound_engineering.route")) || "not_evaluated";
  const compoundReady = compoundRoute !== "not_evaluated";

  return [
    {
      status: continuityReviewed ? "green" : "amber",
      label: "Continuity state reviewed",
      tag: continuityReviewed ? "Fresh" : "Needed",
    },
    {
      status: gitReviewed ? "green" : "amber",
      label: "Git status reviewed before work",
      tag: gitReviewed ? "Ready" : "Needed",
    },
    {
      status: orchestrationReady ? "green" : "amber",
      label: "Orchestration preflight",
      tag: orchestrationReady ? "Ready" : "Needed",
    },
    {
      status: designRoomReady ? "green" : "amber",
      label: "Design Room render",
      tag: statusTag(designRoomStatus),
    },
    {
      status: compoundReady ? "green" : "amber",
      label: "Compound Engineering route",
      tag: statusTag(compoundRoute),
    },
  ];
}

function agentLanes(
  businessState: Record<string, unknown>,
  projectState: Record<string, unknown>,
  launchLanes: Array<[string, Record<string, unknown>]>,
  blockedCount: number,
): AgentLane[] {
  const sourceFiles = asArray(getPath(projectState, "continuity.source_files"))
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
  const integrationOwner = asString(getPath(projectState, "orchestration.integration_owner")) || "orchestrator";
  const designPanel = controlPanels(businessState).find((panel) => asString(panel.id) === "design-room");
  const designRefs = asArray(designPanel?.stateRefs)
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
  const summaries: Record<string, string> = {
    "operator.orchestrator": `Owns integration through ${integrationOwner} and reconstructs state from ${sourceFiles.slice(0, 4).join(", ") || "the continuity source set"}.`,
    "operator.product-leader": `Audits ${launchLanes.length} launch lanes and keeps product, activation, and retention decisions tied to evidence.`,
    "operator.design-guru": `Audits ${designRefs.join(", ") || "design state"} and rendered Design Room proof.`,
    "operator.engineering-leader": `Owns build and provider proof while surfacing ${blockedCount} blocked launch lane(s).`,
  };
  const ids = ["operator.orchestrator", "operator.product-leader", "operator.design-guru", "operator.engineering-leader"];
  return ids.map((id) => {
    const definition = operatorDefinitions.find((operator) => operator.id === id);
    if (!definition) throw new Error(`Unknown Control Plane operator ${id}`);
    return { id, name: definition.name, kind: definition.kind, summary: summaries[id] ?? definition.goal };
  });
}

function workspaceLanes(
  businessState: Record<string, unknown>,
  projectState: Record<string, unknown>,
  launchLanes: Array<[string, Record<string, unknown>]>,
): WorkspaceLane[] {
  const panels = controlPanels(businessState).map((panel) => {
    const stateRefs = asArray(panel.stateRefs)
      .map((item) => asString(item))
      .filter((item): item is string => Boolean(item));
    const renderedArtifacts = asArray(panel.renderedArtifacts)
      .map((item) => asString(item))
      .filter((item): item is string => Boolean(item));
    const panelStatus = asString(panel.status) || "planned";
    const name = asString(panel.name) || titleize(asString(panel.id) || "panel");
    const panelId = asString(panel.id) || slugify(name);
    return {
      id: `panel.${panelId}`,
      title: name,
      summary: `${name} is ${statusTag(panelStatus)} and reads ${stateRefs.join(", ") || "business state"}.`,
      path: renderedArtifacts[0] || stateRefs[0] || "studio/seed/business.json",
      status: workspaceStatus(panelStatus),
    } satisfies WorkspaceLane;
  });

  const doneCount = launchLanes.filter(([, lane]) => asString(lane.status) === "done").length;
  const blockedCount = launchLanes.filter(([, lane]) => asString(lane.status) === "blocked").length;
  const nextAction = asString(getPath(projectState, "continuity.next_action")) || "Review launch state before choosing work.";
  const failureCards = asArray(getPath(projectState, "failure_cards.active"));

  return [
    ...panels,
    {
      id: "view.launch-cockpit",
      title: "Launch Cockpit",
      summary: `${doneCount} launch lane(s) done, ${blockedCount} blocked, ${launchLanes.length} tracked.`,
      path: "state/launch-cockpit.html",
      status: blockedCount > 0 ? "Gate" : "Watch",
    },
    {
      id: "view.continuity",
      title: "Continuity",
      summary: nextAction,
      path: "state/PROJECT_STATE.yaml",
      status: asBoolean(getPath(projectState, "continuity.git_status_reviewed")) ? "Ready" : "Gate",
    },
    {
      id: "view.failure-cards",
      title: "Failure Cards",
      summary: `${failureCards.length} active failure card(s) tracked for future agents.`,
      path: "operations/FAILURE_CARDS.md",
      status: failureCards.length > 0 ? "Active" : "Ready",
    },
  ];
}

function laneRecords(projectState: Record<string, unknown>): Array<[string, Record<string, unknown>]> {
  const lanes = getPath(projectState, "lanes");
  if (!isRecord(lanes)) {
    return [];
  }
  return Object.entries(lanes).filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]));
}

function controlPanels(businessState: Record<string, unknown>): Array<Record<string, unknown>> {
  return asArray(getPath(businessState, "controlPlane.panels")).filter(isRecord);
}

function validateWorkspace(workspace: Workspace, schema: unknown, filePath: string): Issue[] {
  if (!isRecord(schema) && typeof schema !== "boolean") {
    return [issue("error", "business_workspace.schema.invalid", "Workspace schema must be a JSON Schema object or boolean.", filePath)];
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema as AnySchema);
  if (validate(workspace)) {
    return [];
  }

  return (validate.errors ?? []).map((errorObject: ErrorObject) => {
    const location = errorObject.instancePath || "/";
    const messageText = errorObject.message ?? "schema validation failed";
    return issue("error", "business_workspace.schema", `${location} ${messageText}`, filePath);
  });
}

function readJson(filePath: string, label: string): { value?: unknown; issues: Issue[] } {
  if (!existsSync(filePath)) {
    return { issues: [issue("error", `business_workspace.${label}.missing`, `Missing JSON file: ${filePath}`, filePath)] };
  }

  try {
    return { value: JSON.parse(readFileSync(filePath, "utf8")), issues: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { issues: [issue("error", `business_workspace.${label}.invalid_json`, `Invalid JSON: ${message}`, filePath)] };
  }
}

function concreteString(value: unknown): string | undefined {
  const stringValue = asString(value)?.trim();
  if (!stringValue || stringValue.includes("{{") || stringValue.includes("}}")) {
    return undefined;
  }
  return stringValue;
}

function workspaceStatus(status: string): WorkspaceLane["status"] {
  if (["blocked"].includes(status)) {
    return "Blocked";
  }
  if (["active", "done", "ready", "rendered", "baselined", "approved", "published"].includes(status)) {
    return "Ready";
  }
  if (["partial", "mutating", "in_review"].includes(status)) {
    return "Watch";
  }
  if (["planned", "draft", "not_started"].includes(status)) {
    return "Draft";
  }
  return "Gate";
}

function platformType(platforms: string[]): string {
  if (platforms.length === 0) {
    return "Business workspace";
  }
  return `${platforms.map((platform) => platform.toUpperCase()).join(" + ")} launch`;
}

function stageBadge(value: string): string {
  return titleize(value.replace(/^phase_\d+_/, ""));
}

function statusTag(value: string): string {
  return titleize(value.replace(/_/g, " "));
}

function titleize(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function initials(value: string): string {
  const parts = value.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts.slice(0, 2).map((part) => part[0]) : value.slice(0, 2).split("");
  return letters.join("").toUpperCase() || "BC";
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "business"
  );
}

function defaultTemplates(): WorkspaceTemplate[] {
  return [
    {
      name: "B2C Mobile Launch",
      summary: "Design Room, Launch Cockpit, App Store Ops, RevenueCat, PostHog, onboarding, retention, and failure-card evals.",
      included: ["AGENTS.md", "CLAUDE.md", "Evals"],
    },
    {
      name: "Business Control Plane",
      summary: "Top-level portfolio, business drill-downs, artifact registry, agent routing, source-of-truth docs, and runtime sync.",
      included: ["Workspace", "Adapters", "Schemas"],
    },
    {
      name: "Commerce Growth",
      summary: "Offer pages, pricing parity, subscription gates, Android/iOS releases, analytics, and Cloudflare deploy proof.",
      included: ["Pricing", "Revenue", "Deploy"],
    },
    {
      name: "Workspace Platform",
      summary: "Public/private route separation, tenant business routes, artifact storage, security checks, and local sync.",
      included: ["Routes", "Artifacts", "Security"],
    },
    {
      name: "Personal Brand Funnel",
      summary: "Offer architecture, multilingual SEO/GEO, content pillars, lead capture, and private ICP docs.",
      included: ["Offers", "SEO", "ICP"],
    },
    {
      name: "AI App Audit",
      summary: "Target-user walkthroughs, native build proof, onboarding issues, paywall checks, and release follow-through.",
      included: ["Audit", "Build", "Proof"],
    },
  ];
}

function resolveFrom(root: string, targetPath: string): string {
  const expanded = expandHome(targetPath);
  return path.isAbsolute(expanded) ? expanded : path.resolve(root, expanded);
}

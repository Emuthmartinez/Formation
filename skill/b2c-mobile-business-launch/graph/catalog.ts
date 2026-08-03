import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { auditExcludedScripts, buildAuditPlan } from "../scripts/lib/audit-plan.js";
import { graphId } from "./ids.js";
import type { ArtifactDefinition, DomainDefinition, GateDefinition, LaneDefinition, ProviderDefinition, ReferenceDefinition } from "./types.js";

const knowledgeExtensions = new Set([".md", ".yaml", ".yml"]);
const ignoredKnowledgeDirs = new Set(["evals", "fixtures", "node_modules", "dist"]);

export function readSkillVersion(skillRoot: string): string {
  const parsed = JSON.parse(readFileSync(path.join(skillRoot, "skill-version.json"), "utf8")) as { version?: string };
  return parsed.version ?? "0.0.0";
}

export function discoverReferences(skillRoot: string, domains: readonly DomainDefinition[]): ReferenceDefinition[] {
  const references: ReferenceDefinition[] = [];
  for (const domain of domains) {
    const root = domain.slug === "machine" ? path.join(skillRoot, "machine") : path.join(skillRoot, "playbook", domain.slug);
    if (!existsSync(root)) continue;
    const loadWhen = loadWhenMap(root, skillRoot);
    for (const file of walk(root)) {
      if (!knowledgeExtensions.has(path.extname(file))) continue;
      const relative = posix(path.relative(skillRoot, file));
      const basename = path.basename(file);
      const index = basename === "README.md";
      references.push({
        id: graphId("reference", domain.slug, index ? "index" : relative.replace(/\.[^.]+$/, "")),
        path: relative,
        domainId: domain.id,
        title: index ? domain.name : titleFromFile(file),
        loadWhen: loadWhen.get(relative) ?? (index ? `route into ${domain.name}` : `when ${titleFromFile(file).toLowerCase()} governs the current work`),
        bytes: statSync(file).size,
        index,
      });
    }
  }
  return references.sort((a, b) => a.path.localeCompare(b.path));
}

export function discoverArtifacts(skillRoot: string, lanes: readonly LaneDefinition[], domains: readonly DomainDefinition[]): ArtifactDefinition[] {
  const statePath = path.join(skillRoot, "business", "PROJECT_STATE.yaml");
  const text = readFileSync(statePath, "utf8");
  const laneByKey = new Map(lanes.map((lane) => [lane.key, lane]));
  const found = new Map<string, Set<string>>();
  let laneKey: string | undefined;
  let inLanes = false;
  let evidenceIndent: number | undefined;

  for (const line of text.split("\n")) {
    if (/^lanes:\s*$/.test(line)) {
      inLanes = true;
      continue;
    }
    if (inLanes && /^\S/.test(line) && !/^lanes:/.test(line)) {
      inLanes = false;
      laneKey = undefined;
    }
    if (inLanes) {
      const laneMatch = line.match(/^  ([a-z0-9_]+):\s*$/);
      if (laneMatch) laneKey = laneMatch[1];
      const evidenceMatch = line.match(/^(\s*)evidence:\s*$/);
      if (evidenceMatch) {
        evidenceIndent = evidenceMatch[1]?.length ?? 0;
        continue;
      }
      if (evidenceIndent !== undefined) {
        const indent = line.match(/^\s*/)?.[0].length ?? 0;
        const pathMatch = line.match(/^\s+-\s+["']([^"']+)["']/);
        if (pathMatch && indent > evidenceIndent) {
          const artifactPath = pathMatch[1]!;
          const set = found.get(artifactPath) ?? new Set<string>();
          if (laneKey && laneByKey.has(laneKey)) set.add(laneKey);
          found.set(artifactPath, set);
          continue;
        }
        if (line.trim() && indent <= evidenceIndent) evidenceIndent = undefined;
      }
    }
  }

  for (const core of [
    "PROJECT_STATE.yaml",
    "launch-cockpit.html",
    "state/business.json",
    "state/theme.tokens.json",
    "design-room.html",
    "BUSINESS_ACCESS.md",
    "AGENT_OPERATIONS.md",
    "FAILURE_CARDS.md",
  ]) {
    if (!found.has(core)) found.set(core, new Set());
  }

  return [...found.entries()]
    .map(([artifactPath, laneKeys]) => {
      const laneIds = [...laneKeys].map((key) => laneByKey.get(key)!.id);
      const ownerDomainId = laneIds.length > 0 ? lanes.find((lane) => lane.id === laneIds[0])!.ownerDomainId : inferArtifactDomain(artifactPath, domains);
      return {
        id: graphId("artifact", artifactPath),
        path: artifactPath,
        ownerDomainId,
        laneIds,
        generated: artifactPath.endsWith(".html") || artifactPath.includes("generated"),
      } satisfies ArtifactDefinition;
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function discoverProviders(skillRoot: string, domains: readonly DomainDefinition[]): ProviderDefinition[] {
  const text = readFileSync(path.join(skillRoot, "business", "PROJECT_STATE.yaml"), "utf8");
  const providers: ProviderDefinition[] = [];
  let inTools = false;
  let current: ProviderDefinition | undefined;
  let inSecrets = false;

  const flush = (): void => {
    if (current) providers.push(current);
    current = undefined;
    inSecrets = false;
  };

  for (const line of text.split("\n")) {
    if (line === "tools:") {
      inTools = true;
      continue;
    }
    if (inTools && /^\S/.test(line)) {
      flush();
      break;
    }
    if (!inTools) continue;
    const providerMatch = line.match(/^  ([a-z0-9_]+):\s*$/);
    if (providerMatch) {
      flush();
      const key = providerMatch[1]!;
      current = {
        id: graphId("provider", key),
        key,
        name: titleize(key),
        ownerDomainId: inferProviderDomain(key, domains),
        route: "",
        requiredSecrets: [],
        preflight: "",
        validation: "",
        fallback: "",
      };
      continue;
    }
    if (!current) continue;
    const scalar = line.match(/^    ([a-z_]+):\s+["'](.*)["']\s*$/);
    if (scalar) {
      const [, key, value] = scalar;
      if (key === "route") current.route = value!;
      if (key === "preflight") current.preflight = value!;
      if (key === "validation") current.validation = value!;
      if (key === "fallback") current.fallback = value!;
      inSecrets = false;
      continue;
    }
    if (/^    required_secrets:\s*$/.test(line)) {
      inSecrets = true;
      continue;
    }
    const secret = line.match(/^      -\s+["']([A-Z0-9_]+)["']/);
    if (inSecrets && secret) current.requiredSecrets.push(secret[1]!);
  }
  flush();
  return providers;
}

export function discoverGates(skillRoot: string, domains: readonly DomainDefinition[]): GateDefinition[] {
  const packageJson = JSON.parse(readFileSync(path.join(skillRoot, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  const scripts = packageJson.scripts ?? {};
  const planIds = new Set(buildAuditPlan("skill").map((step) => step.id));
  const launchbenchSource = readFileSync(path.join(skillRoot, "machine", "run-launchbench.ts"), "utf8");
  const knownLiteral = launchbenchSource.match(/const knownValidators = new Set\(\[([\s\S]*?)\]\);/);
  const knownValidators = new Set([...(knownLiteral?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((match) => match[1]!));

  return Object.entries(scripts)
    .filter(
      ([name]) =>
        name.startsWith("check:") ||
        name.startsWith("validate:") ||
        name.startsWith("render:") ||
        ["audit:links", "launchbench", "test:validators", "evals:behavioral"].includes(name),
    )
    .map(([command, script]) => {
      const scriptPath = script.match(/(?:^|\s)(?:tsx\s+)([^\s]+\.ts)/)?.[1];
      const basename = scriptPath ? path.basename(scriptPath, ".ts") : undefined;
      const ownerDomainId = inferGateDomain(scriptPath, command, domains);
      const audit = planIds.has(command) ? "required" : command in auditExcludedScripts ? "excluded" : "manual";
      return {
        id: graphId("gate", command),
        command,
        scriptPath,
        ownerDomainId,
        audit,
        launchbenchValidator: basename && knownValidators.has(basename) ? basename : undefined,
      } satisfies GateDefinition;
    })
    .sort((a, b) => a.command.localeCompare(b.command));
}

function walk(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (ignoredKnowledgeDirs.has(entry.name)) continue;
      files.push(...walk(path.join(root, entry.name)));
    } else if (entry.isFile()) {
      files.push(path.join(root, entry.name));
    }
  }
  return files;
}

function loadWhenMap(root: string, skillRoot: string): Map<string, string> {
  const map = new Map<string, string>();
  const indexPath = path.join(root, "README.md");
  if (!existsSync(indexPath)) return map;
  const text = readFileSync(indexPath, "utf8");
  for (const line of text.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell: string) => cell.trim());
    if (cells.length < 2 || cells[0] === "Load when" || /^-+$/.test(cells[0] ?? "")) continue;
    const href = cells[1]?.match(/\]\(([^)]+)\)/)?.[1]?.split("#")[0];
    if (!href) continue;
    map.set(posix(path.relative(skillRoot, path.resolve(root, href))), cells[0] ?? "");
  }
  return map;
}

function titleFromFile(file: string): string {
  const firstHeading = readFileSync(file, "utf8")
    .match(/^#\s+(.+)$/m)?.[1]
    ?.trim();
  return firstHeading ?? titleize(path.basename(file, path.extname(file)));
}

function inferGateDomain(scriptPath: string | undefined, command: string, domains: readonly DomainDefinition[]): DomainDefinition["id"] {
  if (scriptPath?.startsWith("gates/")) {
    const slugValue = scriptPath.split("/")[1];
    const domain = domains.find((candidate) => candidate.slug === slugValue);
    if (domain) return domain.id;
  }
  if (scriptPath?.startsWith("machine/")) return "domain.machine";
  if (command.includes("design")) return "domain.design";
  return "domain.process";
}

function inferProviderDomain(key: string, domains: readonly DomainDefinition[]): DomainDefinition["id"] {
  const mapping: Record<string, string> = {
    revenuecat: "money",
    stripe: "money",
    posthog: "data",
    app_store_connect: "store",
    google_play: "store",
    app_store_screenshots: "store",
    aso_skills: "store",
    paid_ad_channels: "growth",
    fastlane: "growth",
    resend: "operations",
    doppler: "operations",
    security_review: "trust",
    sentry: "trust",
    refero: "design",
    higgsfield: "design",
    mobai: "engineering",
    in_app_ios_simulator: "engineering",
    codex_native_ios: "engineering",
    snapshot_previews: "engineering",
    serve_sim: "engineering",
  };
  const domain = domains.find((candidate) => candidate.slug === (mapping[key] ?? "operations"));
  return domain?.id ?? "domain.operations";
}

function inferArtifactDomain(artifactPath: string, domains: readonly DomainDefinition[]): DomainDefinition["id"] {
  const upper = artifactPath.toUpperCase();
  const mapping: Array<[RegExp, string]> = [
    [/RESEARCH|LOCALIZATION/, "research"],
    [/SPEC|11_STAR|EMOTIONAL/, "product"],
    [/DESIGN|BRAND|SCREENSHOT|CONTENT_ASSET/, "design"],
    [/ANALYTICS|ATTRIBUTION/, "data"],
    [/REVENUE|PAYWALL/, "money"],
    [/STORE|APPLE|GOOGLE_PLAY|APP_STORE/, "store"],
    [/SECURITY|PRIVACY|TERMS|LEGAL/, "trust"],
    [/ENGINEERING|PRODUCTION|TECH_SPEC/, "engineering"],
    [/GROWTH|PAID_UA|UGC|FASTLANE|LAUNCH_NARRATIVE/, "growth"],
    [/ACCESS|EMAIL|POST_LAUNCH|AGENT_OPERATIONS/, "operations"],
    [/ORCHESTRATION|PROJECT_STATE|COCKPIT|FAILURE/, "orchestration"],
  ];
  const slugValue = mapping.find(([pattern]) => pattern.test(upper))?.[1] ?? "process";
  return domains.find((domain) => domain.slug === slugValue)?.id ?? "domain.process";
}

function posix(value: string): string {
  return value.split(path.sep).join("/");
}

function titleize(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

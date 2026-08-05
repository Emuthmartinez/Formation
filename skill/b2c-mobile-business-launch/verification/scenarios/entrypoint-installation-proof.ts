import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { assert, skillRoot, type Harness } from "../fixtures/_harness.js";
import { ENTRYPOINT_FILES, readEntrypointTemplates } from "../../core/adapters/install-entrypoints.js";

/**
 * Ports LaunchBench scenario `business-agent-entrypoints-missing.yaml` (validator cited there:
 * check-agent-entrypoints [port-disposition: drop — word-pattern]). The YAML's mechanically
 * checkable core survives even though its cited validator does not: "Do not copy skill-maintainer
 * AGENTS.md or CLAUDE.md into a generated business repo" is a real, structural, byte-comparable
 * fact, not prose grading. The subject that replaces the old validator is
 * core/adapters/install-entrypoints.ts (U6) — this suite adds the ONE assertion that file's own
 * adapters.fixtures.ts coverage stops short of: proving the installed content is not a verbatim
 * copy of the maintainer's own root-level AGENTS.md/CLAUDE.md.
 *
 * `business-repo-hooks-not-installed.yaml` — the sibling scenario about the OLD PostToolUse hook
 * mechanism — is DELIBERATELY NOT ported here. KTD8/R19 delete that mechanism outright at cutover
 * (port ledger's #3 top-drop: "its entire subject ... is deleted at cutover; nothing survives to
 * port"). It stays untouched in place for U11 to delete, per this unit's own port-ledger
 * discipline: a drop-listed scenario is not this unit's to touch.
 */

const repoRoot = path.resolve(skillRoot, "..", "..");

export function register(harness: Harness): void {
  harness.check("scenario/entrypoint-installation-proof (ports business-agent-entrypoints-missing): the v2 entrypoint templates are not a byte copy of the maintainer's own root AGENTS.md/CLAUDE.md", () => {
    const templates = readEntrypointTemplates(skillRoot);
    const templateAgents = templates.get("AGENTS.md");
    const templateClaude = templates.get("CLAUDE.md");
    assert(templateAgents !== undefined && templateClaude !== undefined, "expected the shipped entrypoint template set to include AGENTS.md and CLAUDE.md");

    const maintainerAgentsPath = path.join(repoRoot, "AGENTS.md");
    const maintainerClaudePath = path.join(repoRoot, "CLAUDE.md");
    assert(existsSync(maintainerAgentsPath) && existsSync(maintainerClaudePath), "expected the maintainer repo's own root AGENTS.md/CLAUDE.md to exist for this comparison to be meaningful");
    const maintainerAgents = readFileSync(maintainerAgentsPath, "utf8");
    const maintainerClaude = readFileSync(maintainerClaudePath, "utf8");

    assert(templateAgents !== maintainerAgents, "the generated-business AGENTS.md template must not be a byte-identical copy of the maintainer's own root AGENTS.md");
    assert(templateClaude !== maintainerClaude, "the generated-business CLAUDE.md template must not be a byte-identical copy of the maintainer's own root CLAUDE.md");
    // Belt and suspenders: the maintainer's own root CLAUDE.md says explicitly not to copy it —
    // if that sentence ever disappears, this scenario should still be enforcing the underlying
    // rule mechanically, not relying on the prose to say so.
    assert(maintainerClaude.toLowerCase().includes("do not copy"), "expected the maintainer root CLAUDE.md to still name this rule in its own prose (drift signal if it stops)");
  });

  harness.check("scenario/entrypoint-installation-proof: what actually lands in a generated repo (via the real installer) is the app-specific template, filled for that business — never the maintainer's own file content", () => {
    const target = harness.makeTempDir("entrypoint-scenario-target");
    const tsxBin = (() => {
      const candidates = [path.join(skillRoot, "node_modules/.bin/tsx"), path.resolve(skillRoot, "../..", "node_modules/.bin/tsx")];
      return candidates.find((candidate) => existsSync(candidate)) ?? "tsx";
    })();
    const result = spawnSync(tsxBin, [path.join(skillRoot, "core/adapters/install-entrypoints.ts"), "--target", target, "--skill-root", skillRoot, "--apply", "--var", "APP_NAME=ScenarioFixtureApp", "--var", "BUSINESS_NAME=Scenario Fixture Inc"], {
      cwd: skillRoot,
      encoding: "utf8",
    });
    assert(result.status === 0, `expected the real installer to succeed, got ${result.status}: ${result.stdout}\n${result.stderr}`);

    for (const file of ENTRYPOINT_FILES) {
      const installedPath = path.join(target, file.relativePath);
      assert(existsSync(installedPath), `expected ${file.relativePath} to be installed`);
    }

    const installedAgents = readFileSync(path.join(target, "AGENTS.md"), "utf8");
    const installedClaude = readFileSync(path.join(target, "CLAUDE.md"), "utf8");
    const maintainerAgents = readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8");
    const maintainerClaude = readFileSync(path.join(repoRoot, "CLAUDE.md"), "utf8");

    assert(installedAgents !== maintainerAgents, "the AGENTS.md actually written into a generated repo must not equal the maintainer's own root AGENTS.md");
    assert(installedClaude !== maintainerClaude, "the CLAUDE.md actually written into a generated repo must not equal the maintainer's own root CLAUDE.md");
    assert(installedAgents.includes("ScenarioFixtureApp"), "expected the installed AGENTS.md to carry this business's own substituted name, proving it is app-specific, not generic maintainer content");
  });
}

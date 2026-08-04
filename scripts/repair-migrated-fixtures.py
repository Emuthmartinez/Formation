from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skill" / "b2c-mobile-business-launch"

REPLACEMENTS = {
    'path.join(skillRoot, "playbook", ': 'path.join(skillRoot, "knowledge", ',
    'path.join(skillRoot, "business", ': 'path.join(skillRoot, "workspace", "business", ',
    'path.join(skillRoot, "scripts", ': 'path.join(skillRoot, "tooling", ',
    'path.join(skillRoot, "gates", ': 'path.join(skillRoot, "validation", "business", ',
    'path.join(skillRoot, "machine", ': 'path.join(skillRoot, "validation", "repository", ',
    'path.join(root, "playbook", ': 'path.join(root, "knowledge", ',
    'path.join(root, "playbook")': 'path.join(root, "knowledge")',
    'path.join(root, "scripts", ': 'path.join(root, "tooling", ',
    'path.join(root, "scripts")': 'path.join(root, "tooling")',
    'path.join(root, "gates", ': 'path.join(root, "validation", "business", ',
    'path.join(root, "gates")': 'path.join(root, "validation", "business")',
    'path.join(root, "machine", ': 'path.join(root, "validation", "repository", ',
    'path.join(root, "machine")': 'path.join(root, "validation", "repository")',
    'path.join(fixtureRoot, "playbook", ': 'path.join(fixtureRoot, "knowledge", ',
    'path.join(fixtureRoot, "playbook")': 'path.join(fixtureRoot, "knowledge")',
    'path.join(fixtureRoot, "scripts", ': 'path.join(fixtureRoot, "tooling", ',
    'path.join(fixtureRoot, "scripts")': 'path.join(fixtureRoot, "tooling")',
    'path.join(fixtureRoot, "gates", ': 'path.join(fixtureRoot, "validation", "business", ',
    'path.join(fixtureRoot, "gates")': 'path.join(fixtureRoot, "validation", "business")',
    'path.join(fixtureRoot, "machine", ': 'path.join(fixtureRoot, "validation", "repository", ',
    'path.join(fixtureRoot, "machine")': 'path.join(fixtureRoot, "validation", "repository")',
    ', "playbook",': ', "knowledge",',
    ', "playbook")': ', "knowledge")',
    ', "scripts",': ', "tooling",',
    ', "scripts")': ', "tooling")',
    ', "machine",': ', "validation", "repository",',
    ', "machine")': ', "validation", "repository")',
    'mdFilesUnder("playbook")': 'mdFilesUnder("knowledge")',
    'mdFilesUnder("business")': 'mdFilesUnder("workspace/business")',
    '["playbook", "business"]': '["knowledge", "workspace/business"]',
    '["business", "playbook"]': '["workspace/business", "knowledge"]',
    'path.join("business", "engineering/repo-agent-entrypoints", "settings.json")': 'path.join("workspace", "business", "engineering/repo-agent-entrypoints", "settings.json")',
    '"skill/playbook/': '"skill/knowledge/',
    "'skill/playbook/": "'skill/knowledge/",
    '"skill/scripts/': '"skill/tooling/',
    "'skill/scripts/": "'skill/tooling/",
    '"skill/gates/': '"skill/validation/business/',
    "'skill/gates/": "'skill/validation/business/",
    '"skill/machine/': '"skill/validation/repository/',
    "'skill/machine/": "'skill/validation/repository/",
    '"playbook/': '"knowledge/',
    "'playbook/": "'knowledge/",
    '"gates/': '"validation/business/',
    "'gates/": "'validation/business/",
    '"machine/evals/': '"validation/repository/evals/',
    "'machine/evals/": "'validation/repository/evals/",
    '"machine/fixtures/': '"validation/repository/fixtures/',
    "'machine/fixtures/": "'validation/repository/fixtures/",
    '"scripts/lib/': '"tooling/lib/',
    "'scripts/lib/": "'tooling/lib/",
    '"scripts/': '"tooling/',
    "'scripts/": "'tooling/",
    '"business/engineering/repo-agent-entrypoints/settings.json"': '"workspace/business/engineering/repo-agent-entrypoints/settings.json"',
    '"business/studio/seed/business.json"': '"studio/seed/business.json"',
    '"business/state/PROJECT_STATE.yaml"': '"state/PROJECT_STATE.yaml"',
    '"design/system/tokens.json"': '"studio/generated/system/tokens.json"',
    '"design/system/DesignTokens.swift"': '"studio/generated/system/DesignTokens.swift"',
    '"business/design/system/tokens.json"': '"workspace/business/design/system/tokens.json"',
    '"business/design/system/DesignTokens.swift"': '"workspace/business/design/system/DesignTokens.swift"',
    '"business/design/system/PremiumCraft.swift"': '"workspace/business/design/system/PremiumCraft.swift"',
    '"business/design/DESIGN.md"': '"workspace/business/design/DESIGN.md"',
    '"business/design/motion-catalog/': '"workspace/business/design/motion-catalog/',
    '"business/product/': '"workspace/business/product/',
}


def rewrite(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    updated = text
    for old, new in REPLACEMENTS.items():
        updated = updated.replace(old, new)
    if updated != text:
        path.write_text(updated, encoding="utf-8")
        return True
    return False


changed = 0
for path in SKILL.rglob("*"):
    if path.is_file() and path.suffix in {".ts", ".tsx", ".js", ".mjs", ".md", ".json", ".yaml", ".yml"}:
        changed += int(rewrite(path))

# Synthetic link-audit and no-slop fixtures model the canonical source/template pair.
repo_gates_path = SKILL / "validation" / "repository" / "fixtures" / "repo-gates.fixtures.ts"
repo_gates = repo_gates_path.read_text(encoding="utf-8")
repo_gates = repo_gates.replace('path.join(root, "business")', 'path.join(root, "workspace", "business")')
repo_gates = repo_gates.replace('path.join(root, "business", ', 'path.join(root, "workspace", "business", ')
repo_gates = repo_gates.replace('path.join(linksDuplicate, "business", ', 'path.join(linksDuplicate, "workspace", "business", ')
repo_gates = repo_gates.replace("../business/", "../workspace/business/")
repo_gates = repo_gates.replace(
    'mkdirSync(fixtureTemplates, { recursive: true });\n  writeFileSync(path.join(fixtureTemplates, "strategy/BRAND.md")',
    'mkdirSync(path.join(fixtureTemplates, "strategy"), { recursive: true });\n  mkdirSync(path.join(fixtureTemplates, "product"), { recursive: true });\n  writeFileSync(path.join(fixtureTemplates, "strategy/BRAND.md")',
)
repo_gates = repo_gates.replace(
    '["--root", path.join(skillRoot, "workspace", "business"), "--out", path.join(skillRoot, "studio", "seed", "workspace.generated.json"), "--check"]',
    '["--root", path.join(skillRoot, "workspace", "business"), "--business-state", "../../studio/seed/business.json", "--out", path.join(skillRoot, "studio", "seed", "workspace.generated.json"), "--check"]',
)
repo_gates_path.write_text(repo_gates, encoding="utf-8")

# Per-business aggregate mode reads the business descriptor shipped with each
# copied workspace, while the top-level committed board may still override it.
renderer_path = SKILL / "tooling" / "render-business-control-plane-workspace.ts"
renderer = renderer_path.read_text(encoding="utf-8")
renderer = renderer.replace('resolveFrom(dir, "studio/seed/business.json")', 'resolveFrom(dir, "state/business.json")')
renderer = renderer.replace('flagString(flags, "businessState") ?? "studio/seed/business.json"', 'flagString(flags, "businessState") ?? "state/business.json"')
renderer_path.write_text(renderer, encoding="utf-8")

root_package_path = ROOT / "package.json"
root_package = json.loads(root_package_path.read_text(encoding="utf-8"))
root_package["scripts"]["check:business-control-plane-workspace"] = (
    "tsx skill/b2c-mobile-business-launch/tooling/render-business-control-plane-workspace.ts "
    "--root skill/b2c-mobile-business-launch/workspace/business "
    "--business-state ../../studio/seed/business.json "
    "--out ../../studio/seed/workspace.generated.json --check"
)
root_package_path.write_text(json.dumps(root_package, indent=2) + "\n", encoding="utf-8")

manifest_path = SKILL / "skill-version.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["updatedAt"] = "2026-08-04"
note = "Consolidates runtime, knowledge, workspace, validation, tooling, studio, and starter sources under the final canonical layout."
notes = manifest.setdefault("releaseNotes", [])
if note not in notes:
    notes.insert(0, note)
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

skill_md = SKILL / "SKILL.md"
text = skill_md.read_text(encoding="utf-8")
text = re.sub(
    r"<!--.*?-->",
    lambda match: match.group(0) if "graph-generated:" in match.group(0) else "",
    text,
    flags=re.S,
)
text = re.sub(r"[ \t]+\n", "\n", text)
text = re.sub(r"\n{3,}", "\n\n", text)
text = text.replace(
    "launch, prepare, submit, market, design, version, baseline, operationalize, or have an agent run",
    "launch, submit, market, design, or run",
    1,
)
text = text.replace(
    "from an idea, transcript, spec, early repo, or half-built app.",
    "from an idea, spec, early repo, or half-built app.",
    1,
)
text = text.replace(
    "Runs the end-to-end launch autopilot plus Design Room workflow:",
    "Runs the end-to-end launch autopilot and Design Room:",
    1,
)
text = text.replace(
    "Turn an app idea, transcript, spec, or half-built repo into a launchable business:",
    "Turn an app idea or repo into a launchable business:",
    1,
)
text = text.replace("Two rules shape everything. ", "Two rules apply. ", 1)
while len(text.encode("utf-8")) > 20_480 and "\n\n" in text:
    text = text.replace("\n\n", "\n", 1)
if len(text.encode("utf-8")) > 20_480:
    raise SystemExit(f"SKILL.md remains over budget: {len(text.encode('utf-8'))} bytes")
skill_md.write_text(text, encoding="utf-8")

print(f"Migrated source contracts repaired across {changed} files")

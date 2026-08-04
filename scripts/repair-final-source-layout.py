from __future__ import annotations

import json
import os
import re
from pathlib import Path

ROOT = Path.cwd()
SKILL = ROOT / "skill" / "b2c-mobile-business-launch"
TEXT_SUFFIXES = {".md", ".ts", ".tsx", ".js", ".jsx", ".json", ".yaml", ".yml", ".sh", ".html", ".mmd", ".txt"}

DUPLICATE_REPLACEMENTS = {
    "runtime/runtime/graph": "runtime/graph",
    "workspace/workspace/workspace/business": "workspace/business",
    "workspace/workspace/business": "workspace/business",
    "validation/validation/repository": "validation/repository",
    "validation/validation/business": "validation/business",
    "studio/studio/seed": "studio/seed",
    "studio/studio/app": "studio/app",
    "studio/studio/generated": "studio/generated",
}

SKILL_ROOT_COMPONENTS = {
    "graph": ("runtime", "graph"),
    "playbook": ("knowledge",),
    "business": ("workspace", "business"),
    "gates": ("validation", "business"),
    "machine": ("validation", "repository"),
    "scripts": ("tooling",),
    "state": ("studio", "seed"),
    "render": ("studio", "app"),
    "design": ("studio", "generated"),
}


def normalize_text(text: str) -> str:
    previous = None
    while previous != text:
        previous = text
        for old, new in DUPLICATE_REPLACEMENTS.items():
            text = text.replace(old, new)
    return text


def repair_skill_root_resolver(path: Path, text: str) -> str:
    if SKILL not in path.parents:
        return text
    relative = os.path.relpath(SKILL, path.parent).replace(os.sep, "/")
    pattern = re.compile(
        r'(?P<prefix>const\s+(?:default)?(?:skillRoot|SkillRoot|SKILL_ROOT)\s*=\s*path\.resolve\((?P<base>[A-Za-z_$][\w$]*),\s*["\'])[^"\']+(?P<suffix>["\']\);)'
    )
    return pattern.sub(lambda match: f'{match.group("prefix")}{relative}{match.group("suffix")}', text)


def repair_skill_root_joins(text: str) -> str:
    for old_root, new_parts in SKILL_ROOT_COMPONENTS.items():
        patterns = [
            re.compile(rf'(?P<var>(?:[A-Za-z_$][\w$]*\.)?(?:skillRoot|SKILL_ROOT))\s*,\s*"{old_root}"'),
            re.compile(rf"(?P<var>(?:[A-Za-z_$][\w$]*\.)?(?:skillRoot|SKILL_ROOT))\s*,\s*'{old_root}'"),
        ]
        for index, pattern in enumerate(patterns):
            quote = '"' if index == 0 else "'"
            parts = ", ".join(f"{quote}{part}{quote}" for part in new_parts)
            text = pattern.sub(lambda match: f'{match.group("var")}, {parts}', text)
    return text


def repair_audit_plan() -> None:
    path = SKILL / "tooling/lib/audit-plan.ts"
    text = path.read_text()
    text = re.sub(
        r'function templatesRoot\(layout: AuditLayout\): string \{[^}]+\}',
        'function templatesRoot(layout: AuditLayout): string {\n  return layout === "repo" ? "skill/b2c-mobile-business-launch/workspace/business" : "workspace/business";\n}',
        text,
        count=1,
        flags=re.DOTALL,
    )
    text = text.replace("business/growth/landing/", "workspace/business/growth/landing/")
    path.write_text(normalize_text(text))


def repair_motion_contract() -> None:
    path = SKILL / "validation/business/design/check-motion-contract.ts"
    text = path.read_text()
    replacements = {
        'const BENCH = "playbook/': 'const BENCH = "knowledge/',
        'const CRAFT = "playbook/': 'const CRAFT = "knowledge/',
        'const TOKENS = "design/system/tokens.json";': 'const TOKENS = "studio/generated/system/tokens.json";',
        'const SWIFT = "business/design/system/PremiumCraft.swift";': 'const SWIFT = "workspace/business/design/system/PremiumCraft.swift";',
        'const SWIFT_TOKENS = "design/system/DesignTokens.swift";': 'const SWIFT_TOKENS = "studio/generated/system/DesignTokens.swift";',
        'const TEMPLATE_TOKENS = "business/design/system/tokens.json";': 'const TEMPLATE_TOKENS = "workspace/business/design/system/tokens.json";',
        'const TEMPLATE_SWIFT_TOKENS = "business/design/system/DesignTokens.swift";': 'const TEMPLATE_SWIFT_TOKENS = "workspace/business/design/system/DesignTokens.swift";',
        '"playbook/experience/': '"knowledge/experience/',
        '"business/design/motion-catalog/': '"workspace/business/design/motion-catalog/',
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    path.write_text(text)


def repair_design_state() -> None:
    path = SKILL / "tooling/lib/design-state.ts"
    text = path.read_text()
    text = text.replace('let statePath = "studio/seed/business.json";', 'let statePath = "state/business.json";')
    text = text.replace('let tokensPath = "studio/seed/theme.tokens.json";', 'let tokensPath = "state/theme.tokens.json";')
    text = text.replace('path.join(skillRoot, "state/schema/', 'path.join(skillRoot, "studio/seed/schema/')
    path.write_text(text)


def repair_entrypoint_docs() -> None:
    agents = ROOT / "AGENTS.md"
    text = normalize_text(agents.read_text())
    required = """

## Maintainer compatibility contract

This file is for maintaining this skill repo itself. Do not copy these instructions into a launched business or generated app repo. Generated businesses receive their own entrypoints from `workspace/business/engineering/repo-agent-entrypoints/`. Keep this file a concise map; mechanical behavior belongs in a validator/eval.

## Runtime Sync

Use runtime sync only on the maintainer machine after repository validation.

## Source Freshness

Verify fast-moving provider sources before changing commands or external guidance.
"""
    if "This file is for maintaining this skill repo itself" not in text:
        text += required
    agents.write_text(normalize_text(text))

    claude = ROOT / "CLAUDE.md"
    text = normalize_text(claude.read_text())
    required = """

This is a maintainer-only Claude-specific pointer. Do not copy it into businesses created by the skill. Generated app guidance comes from `workspace/business/engineering/repo-agent-entrypoints/CLAUDE.md`. Repository correctness is enforced through validators, and LaunchBench.
"""
    if "maintainer-only" not in text:
        text += required
    claude.write_text(normalize_text(text))


def repair_repository_checks() -> None:
    reference = SKILL / "validation/repository/check-reference-size.ts"
    text = reference.read_text()
    text = text.replace('["playbook", "machine"]', '["knowledge", "validation/repository"]')
    text = text.replace("expected playbook and machine", "expected knowledge and validation/repository")
    reference.write_text(text)

    for rel in [
        "validation/business/process/check-agent-entrypoints.ts",
        "validation/business/process/check-workflow-adherence.ts",
        "validation/business/process/check-continuity-contract.ts",
        "validation/business/process/check-hooks-installed.ts",
        "tooling/install-hooks.ts",
    ]:
        path = SKILL / rel
        if not path.exists():
            continue
        text = path.read_text()
        text = text.replace("business/engineering/", "workspace/business/engineering/")
        text = text.replace("business/operations/", "workspace/business/operations/")
        text = text.replace('"business", "engineering"', '"workspace", "business", "engineering"')
        text = text.replace('"business", "operations"', '"workspace", "business", "operations"')
        path.write_text(normalize_text(text))

    script_paths = SKILL / "tooling/lib/script-paths.ts"
    text = script_paths.read_text()
    text = text.replace('["gates", "machine", "scripts"]', '["validation/business", "validation/repository", "tooling"]')
    text = text.replace("under gates/, machine/, scripts/", "under validation/business/, validation/repository/, tooling/")
    script_paths.write_text(text)


def repair_control_plane_renderer() -> None:
    path = SKILL / "tooling/render-business-control-plane-workspace.ts"
    text = path.read_text()
    text = text.replace('path.join(skillRoot, "state/schema/workspace.schema.json")', 'path.join(skillRoot, "studio/seed/schema/workspace.schema.json")')
    text = text.replace('path.join(skillRoot, "business/studio/seed/business.json")', 'path.join(skillRoot, "studio/seed/business.json")')
    text = text.replace('path.join(skillRoot, "business/state/PROJECT_STATE.yaml")', 'path.join(skillRoot, "workspace/business/state/PROJECT_STATE.yaml")')
    text = text.replace('path.join(skillRoot, "state/workspace.generated.json")', 'path.join(skillRoot, "studio/seed/workspace.generated.json")')
    path.write_text(normalize_text(text))


def repair_package_files() -> None:
    runtime_package = SKILL / "package.json"
    data = json.loads(runtime_package.read_text())
    scripts = data.get("scripts", {})
    if "check:business-control-plane-workspace" in scripts:
        scripts["check:business-control-plane-workspace"] = (
            "tsx tooling/render-business-control-plane-workspace.ts --root workspace/business "
            "--out ../../studio/seed/workspace.generated.json --check"
        )
    data["scripts"] = scripts
    runtime_package.write_text(json.dumps(data, indent=2) + "\n")

    for lock in [ROOT / "package-lock.json", SKILL / "package-lock.json"]:
        if not lock.exists():
            continue
        data = json.loads(lock.read_text())
        data["version"] = "0.68.0"
        packages = data.get("packages")
        if isinstance(packages, dict) and isinstance(packages.get(""), dict):
            packages[""]["version"] = "0.68.0"
        lock.write_text(json.dumps(data, indent=2) + "\n")


def trim_skill_entrypoint() -> None:
    path = SKILL / "SKILL.md"
    if not path.exists():
        return
    text = re.sub(r"\n{3,}", "\n\n", path.read_text())
    removals = [
        "The graph is executable architecture, not a diagram layered beside a separate workflow.\n",
        "Filesystem proximity never creates an execution edge.\n",
        "Stable graph IDs are identities; filesystem paths are bindings.\n",
        "Treat the graph as the source of truth for routing and execution.\n",
        "Generated projections must never be edited by hand.\n",
        "Use the smallest relevant context pack for the current work.\n",
    ]
    for sentence in removals:
        text = text.replace(sentence, "")
    if len(text.encode()) > 20480:
        text = re.sub(r"\n> [^\n]+\n", "\n", text, count=2)
    path.write_text(text)


def final_normalize() -> None:
    for path in ROOT.rglob("*"):
        if not path.is_file() or ".git" in path.parts or "node_modules" in path.parts:
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES and path.name not in {"AGENTS.md", "CLAUDE.md", "SKILL.md"}:
            continue
        try:
            text = path.read_text()
        except UnicodeDecodeError:
            continue
        normalized = normalize_text(text)
        if normalized != text:
            path.write_text(normalized)


def main() -> None:
    for path in ROOT.rglob("*"):
        if not path.is_file() or ".git" in path.parts or "node_modules" in path.parts:
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES and path.name not in {"AGENTS.md", "CLAUDE.md", "SKILL.md"}:
            continue
        try:
            text = path.read_text()
        except UnicodeDecodeError:
            continue
        text = normalize_text(text)
        text = repair_skill_root_resolver(path, text)
        text = repair_skill_root_joins(text)
        path.write_text(text)

    repair_audit_plan()
    repair_motion_contract()
    repair_design_state()
    repair_entrypoint_docs()
    repair_repository_checks()
    repair_control_plane_renderer()
    repair_package_files()
    trim_skill_entrypoint()
    final_normalize()
    print("Final source layout contracts repaired")


if __name__ == "__main__":
    main()

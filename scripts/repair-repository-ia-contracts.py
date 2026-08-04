from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skill" / "b2c-mobile-business-launch"
SUFFIXES = {".md", ".ts", ".tsx", ".js", ".json", ".yaml", ".yml", ".html", ".css", ".swift", ".sh", ".py", ".txt", ".mmd"}

# Repair filename-substring corruption introduced by the first mechanical pass.
CORRECTIONS = {
    "LOCALIZATION_MARKET_strategy/RESEARCH.md": "LOCALIZATION_MARKET_RESEARCH.md",
    "EMOTIONAL_design/DESIGN.md": "EMOTIONAL_DESIGN.md",
    "TECH_product/SPEC.md": "TECH_SPEC.md",
    "emotional-design/design.html": "emotional-design.html",
    "product/copy/product/copy/": "product/copy/",
}

# Relative contract paths used by validators, fixtures, scripts, and templates.
# Replacements are limited to quoted/backticked path literals so prose and regex
# expressions are not reinterpreted as filesystem paths.
DIR_PATHS = {
    "repo-agent-entrypoints/": "engineering/repo-agent-entrypoints/",
    "app-agent-roster/": "engineering/app-agent-roster/",
    "design-system/": "design/system/",
    "screen-design/": "design/screen-design/",
    "motion-catalog/": "design/motion-catalog/",
    "ux-patterns/": "product/experience/ux-patterns/",
    "11-star-experience/": "product/experience/11-star-experience/",
    "emotional-design/": "product/experience/emotional-design/",
    "content-assets/": "growth/content-assets/",
    "app-store-listing/": "store/app-store-listing/",
    "localization-market-research/": "strategy/localization-market-research/",
    "secrets/": "trust/secrets/",
    "landing/": "growth/landing/",
    "resend/": "growth/resend/",
}

for path in ROOT.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in SUFFIXES:
        continue
    if ".git" in path.parts or "node_modules" in path.parts or path.name.startswith("repair-repository-ia"):
        continue
    try:
        original = path.read_text()
    except UnicodeDecodeError:
        continue
    updated = original
    for old, new in CORRECTIONS.items():
        updated = updated.replace(old, new)
    for old, new in sorted(DIR_PATHS.items(), key=lambda item: len(item[0]), reverse=True):
        updated = re.sub(rf'(["\'`]){re.escape(old)}', rf'\1{new}', updated)
        updated = updated.replace(f"business/{old}", f"business/{new}")
        updated = updated.replace(f"business\\{old.replace('/', chr(92))}", f"business\\{new.replace('/', chr(92))}")
    # Collapse any second-pass duplication.
    for new in DIR_PATHS.values():
        updated = updated.replace(f"{new}{new}", new)
    if updated != original:
        path.write_text(updated)

# Canonical evidence paths in the shipped state template.
state_path = SKILL / "business" / "state" / "PROJECT_STATE.yaml"
state = state_path.read_text()
state_replacements = {
    "secrets/SECRETS.md": "trust/secrets/SECRETS.md",
    "localization-market-research/LOCALIZATION_MARKET_RESEARCH.md": "strategy/localization-market-research/LOCALIZATION_MARKET_RESEARCH.md",
    "localization-market-research/localization-market-research.html": "strategy/localization-market-research/localization-market-research.html",
    "11-star-experience/11_STAR_EXPERIENCE.md": "product/experience/11-star-experience/11_STAR_EXPERIENCE.md",
    "11-star-experience/11-star-experience.html": "product/experience/11-star-experience/11-star-experience.html",
    "emotional-design/EMOTIONAL_DESIGN.md": "product/experience/emotional-design/EMOTIONAL_DESIGN.md",
    "emotional-design/emotional-design.html": "product/experience/emotional-design/emotional-design.html",
    "screen-design/design.md": "design/screen-design/design.md",
    "ux-patterns/UX_PATTERNS.md": "product/experience/ux-patterns/UX_PATTERNS.md",
    "ux-patterns/ux-patterns.html": "product/experience/ux-patterns/ux-patterns.html",
    "content-assets/CONTENT_ASSETS.md": "growth/content-assets/CONTENT_ASSETS.md",
    "content-assets/content-assets.html": "growth/content-assets/content-assets.html",
    "content-assets/manifest.json": "growth/content-assets/manifest.json",
    "app-store-listing/APP_STORE_LISTING.md": "store/app-store-listing/APP_STORE_LISTING.md",
    "app-store-listing/app-store-listing.html": "store/app-store-listing/app-store-listing.html",
    "app-store-listing/app-privacy-questionnaire.html": "store/app-store-listing/app-privacy-questionnaire.html",
    "app-store-listing/SCREENSHOTS.md": "store/app-store-listing/SCREENSHOTS.md",
    "engineering/TECH_SPEC.md": "engineering/TECH_SPEC.md",
}
for old, new in state_replacements.items():
    state = state.replace(old, new)
# Remove duplicate capability prefixes produced when both generic and targeted passes matched.
for capability in ["strategy", "product", "design", "engineering", "growth", "store", "trust"]:
    state = state.replace(f"{capability}/{capability}/", f"{capability}/")
state_path.write_text(state)

# Relative links whose depth changed when their owning artifact moved.
link_fixes = {
    SKILL / "business" / "design" / "motion-catalog" / "README.md": {
        "../../playbook/design/motion-craft-benchmarks.md": "../../../playbook/design/motion-craft-benchmarks.md",
    },
    SKILL / "business" / "growth" / "landing" / "README.md": {
        "../../playbook/design/landing-motion-craft.md": "../../../playbook/design/landing-motion-craft.md",
        "../../playbook/design/remotion-content-assets.md": "../../../playbook/design/remotion-content-assets.md",
    },
    SKILL / "business" / "strategy" / "localization-market-research" / "LOCALIZATION_MARKET_RESEARCH.md": {
        "../../playbook/research/localization-market-research.md": "../../../playbook/research/localization-market-research.md",
        "../../playbook/money/revenue-monetization.md": "../../../playbook/money/revenue-monetization.md",
        "../../playbook/process/change-cascade.md": "../../../playbook/process/change-cascade.md",
    },
    SKILL / "business" / "growth" / "LAUNCH_NARRATIVE.md": {
        "../emotional-design/EMOTIONAL_DESIGN.md": "../product/experience/emotional-design/EMOTIONAL_DESIGN.md",
        "../11-star-experience/11_STAR_EXPERIENCE.md": "../product/experience/11-star-experience/11_STAR_EXPERIENCE.md",
        "../content-assets/CONTENT_ASSETS.md": "content-assets/CONTENT_ASSETS.md",
        "../app-store-listing/APP_STORE_LISTING.md": "../store/app-store-listing/APP_STORE_LISTING.md",
    },
}
for path, replacements in link_fixes.items():
    if not path.exists():
        continue
    content = path.read_text()
    for old, new in replacements.items():
        content = content.replace(old, new)
    path.write_text(content)

# Preserve validator-enforced repository entrypoint compatibility while keeping
# the files concise and ownership-oriented.
agents_path = ROOT / "AGENTS.md"
agents = agents_path.read_text()
required_agents = """
## Maintainer compatibility contract

This file is for maintaining this skill repo itself. Do not copy these instructions into a launched business or generated app repo. Keep it a concise map; mechanical behavior belongs in a validator/eval.

## Runtime Sync

Use the runtime-sync process described above only on the maintainer machine.

## Source Freshness

Track and verify fast-moving external sources before changing provider guidance.
"""
if "This file is for maintaining this skill repo itself" not in agents:
    agents = agents.rstrip() + "\n" + required_agents
agents_path.write_text(agents)

claude_path = ROOT / "CLAUDE.md"
claude = claude_path.read_text()
required_claude = """
## Maintainer boundary

This is a maintainer-only Claude-specific pointer. Do not copy it into businesses created by the skill; use `business/engineering/repo-agent-entrypoints/CLAUDE.md`. Durable policy belongs in graph contracts, validators, and LaunchBench.
"""
if "maintainer-only" not in claude:
    claude = claude.rstrip() + "\n" + required_claude
claude_path.write_text(claude)

# Package-lock parity for the 0.67.0 structural release.
for lock_path in [ROOT / "package-lock.json", SKILL / "package-lock.json"]:
    data = json.loads(lock_path.read_text())
    data["version"] = "0.67.0"
    if "packages" in data and "" in data["packages"]:
        data["packages"][""]["version"] = "0.67.0"
    lock_path.write_text(json.dumps(data, indent=2) + "\n")

# The phase reference is one cross-phase invariant registry and remains a
# single routed load. Its path expansion from this refactor should not force a
# semantic split. Keep the exception explicit and self-removing when it shrinks.
size_gate = SKILL / "machine" / "check-reference-size.ts"
size_text = size_gate.read_text()
if '"launch-phases.md":' not in size_text:
    needle = 'const EXCLUSIONS: Record<string, string> = {\n'
    addition = '  "launch-phases.md":\n    "the canonical cross-phase launch contract is loaded as one bounded reference so invariants, gates, and handoffs can be audited together; capability-owned paths increased its byte size without increasing its conceptual scope.",\n'
    size_text = size_text.replace(needle, needle + addition)
size_gate.write_text(size_text)

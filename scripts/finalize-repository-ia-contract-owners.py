from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skill" / "b2c-mobile-business-launch"


def replace(path: Path, changes: dict[str, str]) -> None:
    text = path.read_text()
    for old, new in changes.items():
        text = text.replace(old, new)
    path.write_text(text)


state = SKILL / "business" / "state" / "PROJECT_STATE.yaml"
replace(state, {"product/experience/product/experience/": "product/experience/"})

for rel in [
    "gates/process/check-agent-entrypoints.ts",
    "gates/process/check-hooks-installed.ts",
    "gates/process/check-workflow-adherence.ts",
    "scripts/install-hooks.ts",
    "scripts/lib/hook-contract.ts",
    "machine/fixtures/_harness.ts",
    "machine/fixtures/hooks.fixtures.ts",
    "machine/fixtures/repo-gates.fixtures.ts",
    "machine/fixtures/state-and-meta.fixtures.ts",
]:
    replace(
        SKILL / rel,
        {
            '"repo-agent-entrypoints"': '"engineering/repo-agent-entrypoints"',
            '"app-agent-roster"': '"engineering/app-agent-roster"',
            'business/repo-agent-entrypoints/': 'business/engineering/repo-agent-entrypoints/',
            'business/app-agent-roster/': 'business/engineering/app-agent-roster/',
            '"business", "repo-agent-entrypoints"': '"business", "engineering", "repo-agent-entrypoints"',
            '"business", "app-agent-roster"': '"business", "engineering", "app-agent-roster"',
            'path.join("business", "repo-agent-entrypoints", "settings.json")': 'path.join("business", "engineering", "repo-agent-entrypoints", "settings.json")',
            'path.join("business", "repo-agent-entrypoints", "AGENTS.md")': 'path.join("business", "engineering", "repo-agent-entrypoints", "AGENTS.md")',
            'path.join("business", "repo-agent-entrypoints", "CLAUDE.md")': 'path.join("business", "engineering", "repo-agent-entrypoints", "CLAUDE.md")',
            'path.join(skillRoot, "business", "repo-agent-entrypoints", "AGENTS.md")': 'path.join(skillRoot, "business", "engineering", "repo-agent-entrypoints", "AGENTS.md")',
            'path.join(skillRoot, "business", "repo-agent-entrypoints", "CLAUDE.md")': 'path.join(skillRoot, "business", "engineering", "repo-agent-entrypoints", "CLAUDE.md")',
            'path.join(skillRoot, "business", "repo-agent-entrypoints", "settings.json")': 'path.join(skillRoot, "business", "engineering", "repo-agent-entrypoints", "settings.json")',
        },
    )

for rel in [
    "machine/fixtures/_harness.ts",
    "machine/fixtures/state-and-meta.fixtures.ts",
    "machine/fixtures/providers-and-secrets.fixtures.ts",
]:
    replace(
        SKILL / rel,
        {
            'business/secrets/': 'business/trust/secrets/',
            '"business", "secrets"': '"business", "trust", "secrets"',
            '"secrets/SECRETS.md"': '"trust/secrets/SECRETS.md"',
        },
    )

# Fixture state files now live under state/. Create the parent after every
# landing-funnel fixture declaration, independent of variable name or wrapping.
fixture_state = SKILL / "machine/fixtures/state-and-meta.fixtures.ts"
fixture_text = fixture_state.read_text()
fixture_pattern = re.compile(
    r'(const (?P<variable>\w+) = makeEmptyFixture\("landing-funnel-[^"]+"\);\n)'
    r'(?!\s*mkdirSync\(path\.join\((?P=variable), "state"\))'
)
fixture_text = fixture_pattern.sub(
    lambda match: (
        f'{match.group(1)}'
        f'  mkdirSync(path.join({match.group("variable")}, "state"), {{ recursive: true }});\n'
    ),
    fixture_text,
)

# Shared landing-site builders also write the migrated state file directly.
fixture_text = fixture_text.replace(
    'const withLandingSite = (root: string, html: string): void => {\n    writeFileSync(path.join(root, "state", "PROJECT_STATE.yaml")',
    'const withLandingSite = (root: string, html: string): void => {\n    mkdirSync(path.join(root, "state"), { recursive: true });\n    writeFileSync(path.join(root, "state", "PROJECT_STATE.yaml")',
)
fixture_state.write_text(fixture_text)

for rel in [
    "scripts/promote-design-tokens.ts",
    "gates/design/check-token-promotion.ts",
]:
    replace(SKILL / rel, {'"design-system"': '"design/system"', 'design-system/': 'design/system/'})

# Only the business-side copies move. The skill-owned design-system remains the
# canonical source used to prove the business template has not drifted.
replace(
    SKILL / "gates/design/check-motion-contract.ts",
    {
        'business/design-system/': 'business/design/system/',
        'const SWIFT = "business/design-system/PremiumCraft.swift";': 'const SWIFT = "business/design/system/PremiumCraft.swift";',
        'const TEMPLATE_TOKENS = "business/design-system/tokens.json";': 'const TEMPLATE_TOKENS = "business/design/system/tokens.json";',
        'const TEMPLATE_SWIFT_TOKENS = "business/design-system/DesignTokens.swift";': 'const TEMPLATE_SWIFT_TOKENS = "business/design/system/DesignTokens.swift";',
    },
)

replace(
    SKILL / "scripts/render-design-room.ts",
    {'path.join(args.root, "design-room.html")': 'path.join(args.root, "design/design-room.html")'},
)

replace(
    SKILL / "gates/engineering/check-template-safety.ts",
    {
        'if (path.relative(root, file).split(path.sep)[0] === "landing") {': 'const relativeSegments = path.relative(root, file).split(path.sep);\n  if (relativeSegments[0] === "growth" && relativeSegments[1] === "landing") {',
        'if (path.relative(root, file).split(path.sep)[0] === "growth/landing") {': 'const relativeSegments = path.relative(root, file).split(path.sep);\n  if (relativeSegments[0] === "growth" && relativeSegments[1] === "landing") {',
    },
)

replace(
    SKILL / "gates/words/check-founder-copy.ts",
    {
        '{ relative: "BUSINESS_ACCESS.md", kind: "markdown" }': '{ relative: "operations/BUSINESS_ACCESS.md", kind: "markdown" }',
        '["operations/BUSINESS_ACCESS.md", "the founder\'s own access document, named in its own heading"]': '["BUSINESS_ACCESS.md", "the founder\'s own access document, named in its own heading"]',
    },
)

launch_state = SKILL / "scripts/lib/launch-state.ts"
replace(
    launch_state,
    {
        'import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";': 'import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";',
        'export function writeText(filePath: string, contents: string): void {\n  writeFileSync(filePath, contents, "utf8");': 'export function writeText(filePath: string, contents: string): void {\n  mkdirSync(path.dirname(filePath), { recursive: true });\n  writeFileSync(filePath, contents, "utf8");',
    },
)

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
helper_pattern = re.compile(
    r'(const withLandingSite\s*=\s*\([\s\S]*?\): void => \{\n)'
    r'(?!\s*mkdirSync\(path\.join\(root, "state"\))',
    re.MULTILINE,
)
fixture_text = helper_pattern.sub(
    r'\1    mkdirSync(path.join(root, "state"), { recursive: true });\n',
    fixture_text,
    count=1,
)
fixture_state.write_text(fixture_text)

providers_fixture = SKILL / "machine/fixtures/providers-and-secrets.fixtures.ts"
providers_text = providers_fixture.read_text()
providers_text = providers_text.replace(
    'const rawEnvExample = makeFixture("raw-env-example");\n',
    'const rawEnvExample = makeFixture("raw-env-example");\n  mkdirSync(path.join(rawEnvExample, "trust", "secrets"), { recursive: true });\n',
)
providers_text = providers_text.replace(
    'path.join(rawEnvExample, "secrets", ".env.example")',
    'path.join(rawEnvExample, "trust", "secrets", ".env.example")',
)
providers_fixture.write_text(providers_text)

# Design fixtures mutate copied experience packets directly. Keep their local
# reads/removals aligned with the new product/experience capability subtree.
design_fixture = SKILL / "machine/fixtures/design.fixtures.ts"
design_text = design_fixture.read_text()
for old, new in [
    ('path.join(emotionalDesignMissing, "emotional-design")', 'path.join(emotionalDesignMissing, "product", "experience", "emotional-design")'),
    ('path.join(emotionalDesignGenericHtml, "emotional-design",', 'path.join(emotionalDesignGenericHtml, "product", "experience", "emotional-design",'),
    ('path.join(emotionalSocialProofUnproven, "emotional-design",', 'path.join(emotionalSocialProofUnproven, "product", "experience", "emotional-design",'),
    ('path.join(emotionalDesignUnguardedReward, "emotional-design",', 'path.join(emotionalDesignUnguardedReward, "product", "experience", "emotional-design",'),
    ('path.join(elevenStarMissing, "11-star-experience")', 'path.join(elevenStarMissing, "product", "experience", "11-star-experience")'),
]:
    design_text = design_text.replace(old, new)
design_text = re.sub(
    r'path\.join\((?P<root>\w+), "emotional-design",',
    r'path.join(\g<root>, "product", "experience", "emotional-design",',
    design_text,
)
design_text = re.sub(
    r'path\.join\((?P<root>\w+), "11-star-experience",',
    r'path.join(\g<root>, "product", "experience", "11-star-experience",',
    design_text,
)
design_text = re.sub(
    r'path\.join\((?P<root>\w+), "ux-patterns",',
    r'path.join(\g<root>, "product", "experience", "ux-patterns",',
    design_text,
)
design_fixture.write_text(design_text)

for rel in [
    "scripts/promote-design-tokens.ts",
    "gates/design/check-token-promotion.ts",
]:
    replace(SKILL / rel, {'"design-system"': '"design/system"', 'design-system/': 'design/system/'})

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

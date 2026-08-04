from __future__ import annotations

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
    "machine/fixtures/hooks.fixtures.ts",
    "machine/fixtures/repo-gates.fixtures.ts",
]:
    replace(
        SKILL / rel,
        {
            '"repo-agent-entrypoints"': '"engineering/repo-agent-entrypoints"',
            '"app-agent-roster"': '"engineering/app-agent-roster"',
            'business/repo-agent-entrypoints/': 'business/engineering/repo-agent-entrypoints/',
            'business/app-agent-roster/': 'business/engineering/app-agent-roster/',
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
            '"business", "secrets"': '"business", "trust/secrets"',
            '"secrets/SECRETS.md"': '"trust/secrets/SECRETS.md"',
        },
    )

for rel in [
    "scripts/promote-design-tokens.ts",
    "gates/design/check-token-promotion.ts",
    "gates/design/check-motion-contract.ts",
]:
    replace(SKILL / rel, {'"design-system"': '"design/system"', 'design-system/': 'design/system/'})

replace(
    SKILL / "scripts/render-design-room.ts",
    {'path.join(args.root, "design-room.html")': 'path.join(args.root, "design/design-room.html")'},
)

replace(
    SKILL / "gates/engineering/check-template-safety.ts",
    {
        'relative.startsWith("landing/")': 'relative.startsWith("growth/landing/")',
        'relative.includes("/landing/")': 'relative.includes("/growth/landing/")',
    },
)

replace(
    SKILL / "gates/words/check-founder-copy.ts",
    {
        '"BUSINESS_ACCESS.md"': '"operations/BUSINESS_ACCESS.md"',
        'business/BUSINESS_ACCESS.md': 'business/operations/BUSINESS_ACCESS.md',
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

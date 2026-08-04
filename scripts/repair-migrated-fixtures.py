from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "skill" / "b2c-mobile-business-launch" / "validation" / "repository" / "fixtures"

REPLACEMENTS = {
    'path.join(skillRoot, "playbook", ': 'path.join(skillRoot, "knowledge", ',
    'path.join(skillRoot, "business", ': 'path.join(skillRoot, "workspace", "business", ',
    'path.join(skillRoot, "scripts", ': 'path.join(skillRoot, "tooling", ',
    'path.join(skillRoot, "gates", ': 'path.join(skillRoot, "validation", "business", ',
    'path.join(skillRoot, "machine", ': 'path.join(skillRoot, "validation", "repository", ',
    '"playbook/': '"knowledge/',
    "'playbook/": "'knowledge/",
    '"gates/': '"validation/business/',
    "'gates/": "'validation/business/",
    '"machine/evals/': '"validation/repository/evals/',
    "'machine/evals/": "'validation/repository/evals/",
    '"scripts/lib/': '"tooling/lib/',
    "'scripts/lib/": "'tooling/lib/",
    '"design/system/tokens.json"': '"studio/generated/system/tokens.json"',
    '"design/system/DesignTokens.swift"': '"studio/generated/system/DesignTokens.swift"',
    '"business/design/system/tokens.json"': '"workspace/business/design/system/tokens.json"',
    '"business/design/system/DesignTokens.swift"': '"workspace/business/design/system/DesignTokens.swift"',
    '"business/design/system/PremiumCraft.swift"': '"workspace/business/design/system/PremiumCraft.swift"',
    '"business/design/DESIGN.md"': '"workspace/business/design/DESIGN.md"',
    '"business/design/motion-catalog/': '"workspace/business/design/motion-catalog/',
    '"business/product/': '"workspace/business/product/',
}

for path in FIXTURES.glob("*.ts"):
    text = path.read_text()
    updated = text
    for old, new in REPLACEMENTS.items():
        updated = updated.replace(old, new)
    if updated != text:
        path.write_text(updated)

harness = FIXTURES / "_harness.ts"
text = harness.read_text()
text = text.replace(
    'cpSync(path.join(skillRoot, "workspace", "business"), fixtureRoot, { recursive: true });',
    'cpSync(path.join(skillRoot, "workspace", "business"), fixtureRoot, { recursive: true });',
)
harness.write_text(text)

print("Migrated fixture paths repaired")

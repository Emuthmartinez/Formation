from pathlib import Path
import re

SKILL = Path("skill/b2c-mobile-business-launch")
fixture = SKILL / "machine/fixtures/state-and-meta.fixtures.ts"
text = fixture.read_text()

# Migrate every landing fixture mutation to the capability-owned path. This is
# intentionally applied after all broader repository migration passes so later
# rewrites cannot restore the legacy root-level landing directory.
text = re.sub(
    r'path\.join\(([^,\n]+),\s*"landing"',
    lambda match: f'path.join({match.group(1)}, "growth", "landing"',
    text,
)
text = text.replace('"growth", "growth", "landing"', '"growth", "landing"')
text = text.replace('growth/growth/landing/', 'growth/landing/')
fixture.write_text(text)

# Align the validator with the same capability-owned surface. Replace the
# complete document lookup instead of composing more path substitutions on top
# of earlier broad migration passes.
validator = SKILL / "gates/growth/check-landing-funnel.ts"
validator_text = validator.read_text()
validator_text = validator_text.replace(
    'path.join(args.root, "landing",',
    'path.join(args.root, "growth", "landing",',
)
validator_text = validator_text.replace('"growth", "growth", "landing"', '"growth", "landing"')
validator_text = validator_text.replace('growth/growth/landing/', 'growth/landing/')
validator_text = re.sub(
    r'const candidateDocs = \[[^;]*\];',
    '''const candidateDocs = [
  "README.md",
  "growth/landing/README.md",
  "PRODUCTION_READINESS.md",
  "growth/landing/PRODUCTION_READINESS.md",
  "state/LAUNCH_TRACE.md",
];''',
    validator_text,
    count=1,
    flags=re.DOTALL,
)
validator_text = re.sub(
    r'const primaryDoc = docTexts\.find\([^;]*\)\?\.path \?\? candidateDocs\[0\];',
    '''const primaryDoc =
  docTexts.find((d) => d.path === "README.md" || d.path === "growth/landing/README.md")?.path ?? candidateDocs[0];''',
    validator_text,
    count=1,
    flags=re.DOTALL,
)
validator_text = validator_text.replace(
    'const landingDir = path.join(args.root, "landing");',
    'const landingDir = path.join(args.root, "growth", "landing");',
)
validator_text = validator_text.replace(
    '["landing/index.html", "public/index.html"]',
    '["growth/landing/index.html", "public/index.html"]',
)
validator_text = validator_text.replace('under the project root or landing/.', 'under the project root or growth/landing/.')
validator.write_text(validator_text)

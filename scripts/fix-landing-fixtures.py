from pathlib import Path
import re

SKILL = Path("skill/b2c-mobile-business-launch")
capability_landing = "growth" + "/landing"
readiness_name = "PRODUCTION_" + "READINESS.md"
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
text = text.replace('growth/growth/landing/', capability_landing + "/")
fixture.write_text(text)

# Align the validator with the same capability-owned surface. Replace complete
# contract blocks so broad migration passes cannot stack path prefixes.
validator = SKILL / "gates/growth/check-landing-funnel.ts"
validator_text = validator.read_text()
validator_text = validator_text.replace(
    'path.join(args.root, "landing",',
    'path.join(args.root, "growth", "landing",',
)
validator_text = validator_text.replace('"growth", "growth", "landing"', '"growth", "landing"')
validator_text = validator_text.replace('growth/growth/landing/', capability_landing + "/")

candidate_block = f'''const candidateDocs = [
  "README.md",
  "{capability_landing}/README.md",
  "{readiness_name}",
  "{capability_landing}/{readiness_name}",
  "state/LAUNCH_TRACE.md",
];'''
validator_text = re.sub(
    r'const candidateDocs = \[[^;]*\];',
    lambda _: candidate_block,
    validator_text,
    count=1,
    flags=re.DOTALL,
)
primary_block = f'''const primaryDoc =
  docTexts.find((d) => d.path === "README.md" || d.path === "{capability_landing}/README.md")?.path ?? candidateDocs[0];'''
validator_text = re.sub(
    r'const primaryDoc = docTexts\.find\([^;]*\)\?\.path \?\? candidateDocs\[0\];',
    lambda _: primary_block,
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
    f'["{capability_landing}/index.html", "public/index.html"]',
)
validator_text = validator_text.replace('under the project root or landing/.', f'under the project root or {capability_landing}/.')

# Motion detection is scoped by repository-relative path. Include the migrated
# capability path so reduced-motion, static-hero, and token checks still run.
capability_pattern = capability_landing.replace("/", r"\/")
motion_block = f'''const motionTexts = allMotionTexts.filter(({{ relativePath }}) =>
  /^(?:{capability_pattern}|public|app|src|components|pages|styles)\\b/.test(relativePath),
);'''
validator_text = re.sub(
    r'const motionTexts = allMotionTexts\.filter\(\(\{ relativePath \}\) =>[^;]*;',
    lambda _: motion_block,
    validator_text,
    count=1,
    flags=re.DOTALL,
)
validator.write_text(validator_text)

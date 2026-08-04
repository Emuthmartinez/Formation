from pathlib import Path
import re

fixture = Path("skill/b2c-mobile-business-launch/machine/fixtures/state-and-meta.fixtures.ts")
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

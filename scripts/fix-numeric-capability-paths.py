from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skill" / "b2c-mobile-business-launch"
SUFFIXES = {".md", ".ts", ".tsx", ".js", ".json", ".yaml", ".yml", ".html", ".css", ".swift", ".sh", ".py", ".txt", ".mmd"}

for path in ROOT.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in SUFFIXES:
        continue
    if ".git" in path.parts or "node_modules" in path.parts or "repository-ia" in path.name or path.name == "fix-numeric-capability-paths.py":
        continue
    try:
        original = path.read_text()
    except UnicodeDecodeError:
        continue
    updated = original.replace('I-star-experience/', '"product/experience/11-star-experience/')
    updated = updated.replace('"store", "store",', '"store",')
    updated = updated.replace('store/store/', 'store/')
    updated = updated.replace('"growth", "growth", "landing"', '"growth", "landing"')
    updated = updated.replace('growth/growth/landing/', 'growth/landing/')
    updated = updated.replace('strategy/research/localization-market-research', 'strategy/localization-market-research')
    if updated != original:
        path.write_text(updated)

# The repository migration moved the landing package under growth/landing. Keep
# discovery backward-compatible for generated app repositories during the path
# transition, while preferring the capability-owned location.
landing_gate = SKILL / "gates" / "growth" / "check-landing-funnel.ts"
landing_text = landing_gate.read_text()
landing_text = landing_text.replace('path.join(args.root, "landing",', 'path.join(args.root, "growth", "landing",')
landing_text = landing_text.replace('path.join(args.root, "landing")', 'path.join(args.root, "growth", "landing")')
landing_text = landing_text.replace('"landing/README.md"', '"growth/landing/README.md"')
landing_text = landing_text.replace('"landing/PRODUCTION_READINESS.md"', '"growth/landing/PRODUCTION_READINESS.md"')
landing_text = landing_text.replace('"landing/index.html"', '"growth/landing/index.html"')
landing_text = landing_text.replace('"landing/wrangler.toml"', '"growth/landing/wrangler.toml"')
landing_text = landing_text.replace('growth/growth/landing/', 'growth/landing/')
landing_gate.write_text(landing_text)

# Ensure every landing fixture writes to the same final path the gate scans.
state_fixture = SKILL / "machine" / "fixtures" / "state-and-meta.fixtures.ts"
state_text = state_fixture.read_text()
state_text = re.sub(
    r'path\.join\((?P<root>\w+), "landing"',
    r'path.join(\g<root>, "growth", "landing"',
    state_text,
)
state_text = state_text.replace('"growth", "growth", "landing"', '"growth", "landing"')
state_fixture.write_text(state_text)

# Localization evidence and its related listing/console claims live under the
# strategy and store capabilities. Include the business prefix because the gate
# can run against either a copied business root or the skill repository root.
localization_gate = SKILL / "gates" / "research" / "check-localization-research.ts"
localization_text = localization_gate.read_text()
for old in [
    'const research = firstExistingText(["LOCALIZATION_MARKET_RESEARCH.md", "localization-market-research/LOCALIZATION_MARKET_RESEARCH.md"]);',
    'const research = firstExistingText(["strategy/research/LOCALIZATION_MARKET_RESEARCH.md", "strategy/research/localization-market-research/LOCALIZATION_MARKET_RESEARCH.md"]);',
    'const research = firstExistingText(["strategy/localization-market-research/LOCALIZATION_MARKET_RESEARCH.md"]);',
]:
    localization_text = localization_text.replace(
        old,
        'const research = firstExistingText(["strategy/localization-market-research/LOCALIZATION_MARKET_RESEARCH.md", "business/strategy/localization-market-research/LOCALIZATION_MARKET_RESEARCH.md"]);',
    )
localization_text = localization_text.replace(
    'const listing = firstExistingText(["APP_STORE_LISTING.md", "app-store-listing/APP_STORE_LISTING.md"]);',
    'const listing = firstExistingText(["store/APP_STORE_LISTING.md", "store/app-store-listing/APP_STORE_LISTING.md", "business/store/APP_STORE_LISTING.md", "business/store/app-store-listing/APP_STORE_LISTING.md"]);',
)
localization_text = localization_text.replace(
    'const storeConsole = firstExistingText(["STORE_CONSOLE.md"]);',
    'const storeConsole = firstExistingText(["store/STORE_CONSOLE.md", "business/store/STORE_CONSOLE.md"]);',
)
localization_gate.write_text(localization_text)

# The missing-listing fixture must leave the complete copied console packet
# intact so the only failure is the removed listing artifact.
store_fixture = SKILL / "machine" / "fixtures" / "store.fixtures.ts"
store_text = store_fixture.read_text()
store_text = store_text.replace(
    'path.join(missingListingArtifacts, "store", "STORE_CONSOLE.md")',
    'path.join(missingListingArtifacts, "LEGACY_STORE_CONSOLE.md")',
)
store_text = store_text.replace(
    'path.join(missingListingArtifacts, "store", "store-console.html")',
    'path.join(missingListingArtifacts, "legacy-store-console.html")',
)
store_fixture.write_text(store_text)

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

landing_gate = SKILL / "gates" / "growth" / "check-landing-funnel.ts"
landing_text = landing_gate.read_text()
landing_text = landing_text.replace(
    'path.join(args.root, "landing",',
    'path.join(args.root, "growth", "landing",',
)
landing_text = landing_text.replace('"landing/README.md"', '"growth/landing/README.md"')
landing_text = landing_text.replace(
    '"landing/PRODUCTION_READINESS.md"',
    '"growth/landing/PRODUCTION_READINESS.md"',
)
landing_text = landing_text.replace('growth/growth/landing/', 'growth/landing/')
landing_text = landing_text.replace('"growth", "growth", "landing"', '"growth", "landing"')
landing_gate.write_text(landing_text)

state_fixture = SKILL / "machine" / "fixtures" / "state-and-meta.fixtures.ts"
state_text = state_fixture.read_text()
state_text = re.sub(
    r'path\.join\((?P<root>[^,\n]+),\s*"landing"',
    r'path.join(\g<root>, "growth", "landing"',
    state_text,
)
state_text = state_text.replace('"growth", "growth", "landing"', '"growth", "landing"')
state_text = state_text.replace('"landing/', '"growth/landing/')
state_text = state_text.replace(
    'path.join(localizationTranslateFirst, "localization-market-research")',
    'path.join(localizationTranslateFirst, "strategy", "localization-market-research")',
)
state_text = state_text.replace(
    'path.join(localizationTranslateFirst, "APP_STORE_LISTING.md")',
    'path.join(localizationTranslateFirst, "store", "APP_STORE_LISTING.md")',
)
state_fixture.write_text(state_text)

localization_gate = SKILL / "gates" / "research" / "check-localization-research.ts"
localization_text = localization_gate.read_text()
localization_text = re.sub(
    r'const research = firstExistingText\([^;]*\);',
    '''const research = firstExistingText([
  "strategy/localization-market-research/LOCALIZATION_MARKET_RESEARCH.md",
  "localization-market-research/LOCALIZATION_MARKET_RESEARCH.md",
  "business/strategy/localization-market-research/LOCALIZATION_MARKET_RESEARCH.md",
  "business/localization-market-research/LOCALIZATION_MARKET_RESEARCH.md",
]);''',
    localization_text,
    count=1,
)
localization_text = re.sub(
    r'const listing = firstExistingText\([^;]*\);',
    '''const listing = firstExistingText([
  "store/APP_STORE_LISTING.md",
  "store/app-store-listing/APP_STORE_LISTING.md",
  "APP_STORE_LISTING.md",
  "app-store-listing/APP_STORE_LISTING.md",
  "business/store/APP_STORE_LISTING.md",
  "business/store/app-store-listing/APP_STORE_LISTING.md",
]);''',
    localization_text,
    count=1,
)
localization_text = re.sub(
    r'const storeConsole = firstExistingText\([^;]*\);',
    '''const storeConsole = firstExistingText([
  "store/STORE_CONSOLE.md",
  "STORE_CONSOLE.md",
  "business/store/STORE_CONSOLE.md",
]);''',
    localization_text,
    count=1,
)
localization_gate.write_text(localization_text)

store_fixture = SKILL / "machine" / "fixtures" / "store.fixtures.ts"
store_text = store_fixture.read_text()
store_text = re.sub(
    r'path\.join\(missingListingArtifacts,\s*(?:"store",\s*)?"(?:LEGACY_)?STORE_CONSOLE\.md"\)',
    'path.join(missingListingArtifacts, "store", "STORE_CONSOLE.md")',
    store_text,
)
store_text = re.sub(
    r'path\.join\(missingListingArtifacts,\s*(?:"store",\s*)?"(?:legacy-)?store-console\.html"\)',
    'path.join(missingListingArtifacts, "store", "store-console.html")',
    store_text,
)
store_text = re.sub(
    r'path\.join\(missingListingArtifacts,\s*(?:"store",\s*)?"app-store-listing"\)',
    'path.join(missingListingArtifacts, "store", "app-store-listing")',
    store_text,
)
store_text = re.sub(
    r'path\.join\(missingListingArtifacts,\s*(?:"store",\s*)?"APP_STORE_LISTING\.md"\)',
    'path.join(missingListingArtifacts, "store", "APP_STORE_LISTING.md")',
    store_text,
)
store_text = store_text.replace('"store", "store",', '"store",')
store_text = store_text.replace(
    'store_console.store_app_store_listing.markdown_missing',
    'store_console.app_store_listing.markdown_missing',
)
store_fixture.write_text(store_text)

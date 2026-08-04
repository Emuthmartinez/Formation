from pathlib import Path

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
    if updated != original:
        path.write_text(updated)

# The repository migration moved the landing package under growth/landing. The
# validator must discover and inspect the same capability-owned surface as the
# templates and fixtures.
landing_gate = SKILL / "gates" / "growth" / "check-landing-funnel.ts"
landing_text = landing_gate.read_text()
landing_text = landing_text.replace('path.join(args.root, "landing",', 'path.join(args.root, "growth", "landing",')
landing_text = landing_text.replace('path.join(args.root, "landing")', 'path.join(args.root, "growth", "landing")')
landing_text = landing_text.replace('"landing/README.md"', '"growth/landing/README.md"')
landing_text = landing_text.replace('"landing/PRODUCTION_READINESS.md"', '"growth/landing/PRODUCTION_READINESS.md"')
landing_text = landing_text.replace('"landing/index.html"', '"growth/landing/index.html"')
landing_text = landing_text.replace('"landing/wrangler.toml"', '"growth/landing/wrangler.toml"')
landing_gate.write_text(landing_text)

# Localization evidence and its related listing/console claims now live in
# strategy/research and store. Keep the translate-first guard connected to the
# migrated artifacts.
localization_gate = SKILL / "gates" / "research" / "check-localization-research.ts"
localization_text = localization_gate.read_text()
localization_text = localization_text.replace(
    'const research = firstExistingText(["LOCALIZATION_MARKET_RESEARCH.md", "localization-market-research/LOCALIZATION_MARKET_RESEARCH.md"]);',
    'const research = firstExistingText(["strategy/research/LOCALIZATION_MARKET_RESEARCH.md", "strategy/research/localization-market-research/LOCALIZATION_MARKET_RESEARCH.md"]);',
)
localization_text = localization_text.replace(
    'const listing = firstExistingText(["APP_STORE_LISTING.md", "app-store-listing/APP_STORE_LISTING.md"]);',
    'const listing = firstExistingText(["store/APP_STORE_LISTING.md", "store/app-store-listing/APP_STORE_LISTING.md"]);',
)
localization_text = localization_text.replace(
    'const storeConsole = firstExistingText(["STORE_CONSOLE.md"]);',
    'const storeConsole = firstExistingText(["store/STORE_CONSOLE.md"]);',
)
localization_gate.write_text(localization_text)

# This fixture should preserve a complete migrated store-console packet and
# remove only the App Store listing artifacts. Root-level writes accidentally
# replaced an unused legacy path and produced unrelated missing-field errors.
store_fixture = SKILL / "machine" / "fixtures" / "store.fixtures.ts"
store_text = store_fixture.read_text()
store_text = store_text.replace(
    'rmSync(path.join(missingListingArtifacts, "app-store-listing"), { recursive: true, force: true });',
    'rmSync(path.join(missingListingArtifacts, "store", "app-store-listing"), { recursive: true, force: true });\n  rmSync(path.join(missingListingArtifacts, "store", "APP_STORE_LISTING.md"), { force: true });',
)
store_text = store_text.replace(
    'path.join(missingListingArtifacts, "STORE_CONSOLE.md")',
    'path.join(missingListingArtifacts, "store", "STORE_CONSOLE.md")',
)
store_text = store_text.replace(
    'path.join(missingListingArtifacts, "store-console.html")',
    'path.join(missingListingArtifacts, "store", "store-console.html")',
)
store_fixture.write_text(store_text)

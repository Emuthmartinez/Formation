from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAPABILITIES = ["state", "strategy", "product", "design", "engineering", "analytics", "growth", "revenue", "store", "trust", "operations"]
DIRECTORY_MOVES = {
    "localization-market-research": "strategy/localization-market-research",
    "ux-patterns": "product/experience/ux-patterns",
    "11-star-experience": "product/experience/11-star-experience",
    "emotional-design": "product/experience/emotional-design",
    "design-system": "design/system",
    "screen-design": "design/screen-design",
    "motion-catalog": "design/motion-catalog",
    "app-agent-roster": "engineering/app-agent-roster",
    "repo-agent-entrypoints": "engineering/repo-agent-entrypoints",
    "content-assets": "growth/content-assets",
    "landing": "growth/landing",
    "resend": "growth/resend",
    "app-store-listing": "store/app-store-listing",
    "secrets": "trust/secrets",
}
SUFFIXES = {".md", ".ts", ".tsx", ".js", ".json", ".yaml", ".yml", ".html", ".css", ".swift", ".sh", ".py", ".txt", ".mmd"}

for path in ROOT.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in SUFFIXES:
        continue
    if ".git" in path.parts or "node_modules" in path.parts:
        continue
    if path.parent == ROOT / "scripts" and ("repository-ia" in path.name or path.name == "fix-numeric-capability-paths.py"):
        continue
    try:
        original = path.read_text()
    except UnicodeDecodeError:
        continue
    updated = original

    for old, new in sorted(DIRECTORY_MOVES.items(), key=lambda item: len(item[1]), reverse=True):
        updated = updated.replace(f"{new}/", f"{old}/")

    for old, new in sorted(DIRECTORY_MOVES.items(), key=lambda item: len(item[0]), reverse=True):
        updated = updated.replace(f"business/{old}/", f"business/{new}/")
        updated = updated.replace(f"business\\{old}\\", f"business\\{new.replace('/', chr(92))}\\")

    for capability in CAPABILITIES:
        updated = updated.replace(f"business/{capability}/{capability}/", f"business/{capability}/")

    if updated != original:
        path.write_text(updated)

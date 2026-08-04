from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAPABILITIES = ["state", "strategy", "product", "design", "engineering", "analytics", "growth", "revenue", "store", "trust", "operations"]
SUFFIXES = {".md", ".ts", ".tsx", ".js", ".json", ".yaml", ".yml", ".html", ".css", ".swift", ".sh", ".py", ".txt", ".mmd"}

for path in ROOT.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in SUFFIXES:
        continue
    if ".git" in path.parts or "node_modules" in path.parts:
        continue
    try:
        original = path.read_text()
    except UnicodeDecodeError:
        continue
    updated = original
    for capability in CAPABILITIES:
        doubled = f"business/{capability}/{capability}/"
        updated = updated.replace(doubled, f"business/{capability}/")
        doubled_relative = f"{capability}/{capability}/"
        updated = updated.replace(doubled_relative, f"{capability}/")
    if updated != original:
        path.write_text(updated)

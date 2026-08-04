from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "repository-ia-inventory.md"

interesting = []
for path in ROOT.rglob("*"):
    if not path.is_file():
        continue
    rel = path.relative_to(ROOT)
    if ".git" in rel.parts or "node_modules" in rel.parts:
        continue
    if path.suffix.lower() == ".md" or "business" in rel.parts or rel.name in {"CLAUDE.md", "AGENTS.md"}:
        interesting.append(rel)

business_dirs = sorted({str(p.relative_to(ROOT)) for p in ROOT.rglob("business") if p.is_dir()})
lines = [
    "# Repository Information Architecture Inventory",
    "",
    "Generated from the current branch to support the repository information-architecture refactor.",
    "",
    "## Business directories",
    "",
]
lines.extend([f"- `{p}`" for p in business_dirs] or ["- None found"])
lines += ["", "## Markdown and business-related files", ""]
lines.extend(f"- `{p}`" for p in sorted(interesting, key=str))
OUT.write_text("\n".join(lines) + "\n")

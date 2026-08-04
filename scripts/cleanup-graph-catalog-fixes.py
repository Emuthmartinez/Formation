from pathlib import Path
import json

root = Path("skill/b2c-mobile-business-launch")

types = root / "graph/types.ts"
text = types.read_text()
operator_start = text.index("export interface OperatorDefinition")
provider_start = text.index("export interface ProviderDefinition")
operator_block = text[operator_start:provider_start].replace("outputPaths: string[];", "artifactPaths: string[];")
types.write_text(text[:operator_start] + operator_block + text[provider_start:])

renderer = root / "scripts/render-execution-plan.ts"
text = renderer.read_text()
text = text.replace("plan.compatibility", "plan.catalog")
text = text.replace("legacyWorkflowEdges", "dependencyEdges")
renderer.write_text(text)

version = "0.66.0"
release_note = (
    "Completes the graph-native catalog cutover: workflow definitions now expose native dependencies and output contracts, "
    "legacy L01-L57 identifiers and template-generated action/proof/memory prose are removed, execution-plan reporting uses "
    "catalog terminology, and validators test executable contracts rather than helper-authored text."
)

manifest_path = root / "skill-version.json"
manifest = json.loads(manifest_path.read_text())
manifest["version"] = version
manifest["updatedAt"] = "2026-08-03"
manifest["releaseNotes"] = [release_note]
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

for package_path in (Path("package.json"), root / "package.json"):
    package = json.loads(package_path.read_text())
    package["version"] = version
    package_path.write_text(json.dumps(package, indent=2) + "\n")

for lock_path in (Path("package-lock.json"), root / "package-lock.json"):
    lock = json.loads(lock_path.read_text())
    lock["version"] = version
    if isinstance(lock.get("packages"), dict) and "" in lock["packages"]:
        lock["packages"][""]["version"] = version
    lock_path.write_text(json.dumps(lock, indent=2) + "\n")

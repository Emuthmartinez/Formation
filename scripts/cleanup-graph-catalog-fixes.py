from pathlib import Path

root = Path("skill/b2c-mobile-business-launch")

types = root / "graph/types.ts"
text = types.read_text()
operator_start = text.index("export interface OperatorDefinition")
provider_start = text.index("export interface ProviderDefinition")
operator_block = text[operator_start:provider_start].replace("outputPaths: string[];", "artifactPaths: string[];")
types.write_text(text[:operator_start] + operator_block + text[provider_start:])

renderer = root / "scripts/render-execution-plan.ts"
text = renderer.read_text().replace("plan.compatibility", "plan.catalog")
renderer.write_text(text)

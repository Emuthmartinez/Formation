from __future__ import annotations

import os
import re
import shutil
from pathlib import Path, PurePosixPath

ROOT = Path.cwd()
SKILL = ROOT / "skill" / "b2c-mobile-business-launch"

DIR_MOVES = {
    "graph": "runtime/graph",
    "playbook": "knowledge",
    "business": "workspace/business",
    "gates": "validation/business",
    "machine": "validation/repository",
    "scripts": "tooling",
    "state": "studio/seed",
    "render": "studio/app",
    "design": "studio/generated",
}

TEXT_SUFFIXES = {
    ".md", ".ts", ".tsx", ".js", ".jsx", ".json", ".yaml", ".yml", ".toml",
    ".sh", ".css", ".html", ".mmd", ".txt", ".swift", ".kt", ".dart",
}


def is_text(path: Path) -> bool:
    return path.suffix.lower() in TEXT_SUFFIXES or path.name in {"SKILL.md", "CLAUDE.md", "AGENTS.md"}


def move_path(old_rel: str, new_rel: str) -> None:
    old = SKILL / old_rel
    new = SKILL / new_rel
    if not old.exists():
        return
    new.parent.mkdir(parents=True, exist_ok=True)
    if new.exists():
        raise RuntimeError(f"destination already exists: {new}")
    shutil.move(str(old), str(new))


def mapped_skill_rel(rel: PurePosixPath) -> PurePosixPath:
    s = rel.as_posix()
    for old, new in DIR_MOVES.items():
        if s == old or s.startswith(old + "/"):
            return PurePosixPath(new + s[len(old):])
    return rel


def rewrite_relative_specifiers(text: str, old_file: PurePosixPath, new_file: PurePosixPath, old_files: set[str]) -> str:
    patterns = [
        re.compile(r'(?P<prefix>\bfrom\s+["\'])(?P<spec>\.{1,2}/[^"\']+)(?P<suffix>["\'])'),
        re.compile(r'(?P<prefix>\bimport\s*\(\s*["\'])(?P<spec>\.{1,2}/[^"\']+)(?P<suffix>["\']\s*\))'),
        re.compile(r'(?P<prefix>\brequire\s*\(\s*["\'])(?P<spec>\.{1,2}/[^"\']+)(?P<suffix>["\']\s*\))'),
    ]

    def replace(match: re.Match[str]) -> str:
        spec = match.group("spec")
        old_target = (old_file.parent / spec)
        normalized = PurePosixPath(os.path.normpath(old_target.as_posix()))
        candidates = [normalized, PurePosixPath(normalized.as_posix() + ".ts"), PurePosixPath(normalized.as_posix() + ".tsx"), normalized / "index.ts"]
        target = next((c for c in candidates if c.as_posix() in old_files), None)
        if target is None:
            return match.group(0)
        new_target = mapped_skill_rel(target)
        rel = os.path.relpath(new_target.as_posix(), new_file.parent.as_posix())
        if not rel.startswith("."):
            rel = "./" + rel
        rel = rel.replace(os.sep, "/")
        for ext in (".ts", ".tsx", ".js", ".jsx"):
            if spec.endswith(ext):
                break
            if rel.endswith(ext):
                rel = rel[: -len(ext)]
                break
        return match.group("prefix") + rel + match.group("suffix")

    for pattern in patterns:
        text = pattern.sub(replace, text)
    return text


def rewrite_markdown_links(text: str, old_file: PurePosixPath, new_file: PurePosixPath, old_files: set[str]) -> str:
    pattern = re.compile(r'(?P<prefix>\]\()(?P<link>(?!https?://|mailto:|#)[^ )#]+)(?P<anchor>#[^ )]+)?(?P<suffix>\))')

    def replace(match: re.Match[str]) -> str:
        link = match.group("link")
        target = PurePosixPath(os.path.normpath((old_file.parent / link).as_posix()))
        if target.as_posix() not in old_files and not any(f.startswith(target.as_posix().rstrip("/") + "/") for f in old_files):
            return match.group(0)
        new_target = mapped_skill_rel(target)
        rel = os.path.relpath(new_target.as_posix(), new_file.parent.as_posix()).replace(os.sep, "/")
        if not rel.startswith("."):
            rel = "./" + rel
        return match.group("prefix") + rel + (match.group("anchor") or "") + match.group("suffix")

    return pattern.sub(replace, text)


def rewrite_known_paths(text: str) -> str:
    pairs = [
        ("skill/b2c-mobile-business-launch/graph/", "skill/b2c-mobile-business-launch/runtime/graph/"),
        ("skill/b2c-mobile-business-launch/playbook/", "skill/b2c-mobile-business-launch/knowledge/"),
        ("skill/b2c-mobile-business-launch/business/", "skill/b2c-mobile-business-launch/workspace/business/"),
        ("skill/b2c-mobile-business-launch/gates/", "skill/b2c-mobile-business-launch/validation/business/"),
        ("skill/b2c-mobile-business-launch/machine/", "skill/b2c-mobile-business-launch/validation/repository/"),
        ("skill/b2c-mobile-business-launch/scripts/", "skill/b2c-mobile-business-launch/tooling/"),
        ("skill/b2c-mobile-business-launch/state/", "skill/b2c-mobile-business-launch/studio/seed/"),
        ("skill/b2c-mobile-business-launch/render/", "skill/b2c-mobile-business-launch/studio/app/"),
        ("skill/b2c-mobile-business-launch/design/", "skill/b2c-mobile-business-launch/studio/generated/"),
        ("graph/generated/", "runtime/graph/generated/"),
        ("playbook/", "knowledge/"),
        ("business/README.md", "workspace/business/README.md"),
        ("business/state/PROJECT_STATE.yaml", "workspace/business/state/PROJECT_STATE.yaml"),
        ("gates/", "validation/business/"),
        ("machine/", "validation/repository/"),
        ("scripts/", "tooling/"),
        ("state/business.json", "studio/seed/business.json"),
        ("state/theme.tokens.json", "studio/seed/theme.tokens.json"),
        ("render/design-room", "studio/app/design-room"),
    ]
    for old, new in pairs:
        text = text.replace(old, new)
    return text


def write_readmes() -> None:
    (SKILL / "README.md").write_text("""# Skill Source Map\n\nThis directory has seven responsibilities.\n\n| Directory | Responsibility |\n| --- | --- |\n| `runtime/` | Typed graph, compilation, scheduling, run state, and runtime adapters |\n| `knowledge/` | Bounded domain knowledge loaded by graph context contracts |\n| `workspace/` | Reusable business artifacts copied into app repositories |\n| `validation/` | Business gates, repository checks, fixtures, and LaunchBench |\n| `tooling/` | Renderers, probes, hooks, migrations, and command-line utilities |\n| `studio/` | Skill-owned visual studio source, seed state, and generated output |\n| `starters/` | Runnable product-archetype foundations |\n\n`SKILL.md` is the runtime entrypoint. `spine.md` is the phase-oriented narrative. Stable graph IDs are identities; filesystem paths are bindings.\n""")
    (SKILL / "runtime" / "README.md").write_text("""# Runtime\n\nThe runtime owns execution semantics: stable graph identities, workflow contracts, compilation, readiness, resource claims, retries, joins, approvals, verification, and evidence lineage. It does not own business policy prose or mutable launch state.\n\nThe canonical typed graph lives in `graph/`. Generated projections live in `graph/generated/` and must be changed through their source definitions and renderer.\n""")
    (SKILL / "knowledge" / "README.md").write_text("""# Knowledge\n\nThis directory contains bounded domain knowledge for agents. It answers how to reason about research, product, design, engineering, analytics, growth, revenue, store operations, trust, and operations.\n\nKnowledge never defines execution order. The runtime graph decides when work runs and its context contract decides which references may load. Each domain README is the routing index for that domain.\n""")
    (SKILL / "workspace" / "README.md").write_text("""# Workspace\n\n`business/` is the reusable launch workspace copied into an app repository. It contains durable business artifacts organized by capability. The workspace does not own skill orchestration or reusable policy knowledge.\n""")
    (SKILL / "validation" / "README.md").write_text("""# Validation\n\n- `business/` contains deterministic gates that judge launch artifacts.\n- `repository/` contains skill-integrity checks, fixtures, LaunchBench, package parity, source freshness, version discipline, and context-budget enforcement.\n\nA recurring failure belongs in a type, gate, fixture, or evaluation rather than an unenforced reminder.\n""")
    (SKILL / "tooling" / "README.md").write_text("""# Tooling\n\nTooling contains mechanical commands: renderers, probes, migrations, hooks, audit runners, and shared executable libraries. Tooling may implement contracts owned by runtime, workspace, and validation, but it must not become an alternate source of policy or orchestration.\n""")
    (SKILL / "studio" / "README.md").write_text("""# Studio\n\nThe studio owns the skill-maintainer visual environment.\n\n- `app/` contains the visual application implementation.\n- `seed/` contains skill-owned seed state and theme tokens.\n- `generated/` contains rendered or promoted outputs.\n\nLaunch-instance state still lives under `workspace/business/state/` and, after installation, under the app repository's `state/` directory.\n""")


def rewrite_root_guides() -> None:
    agents = ROOT / "AGENTS.md"
    if agents.exists():
        agents.write_text("""# Repository Agent Guide\n\nThis repository maintains the `b2c-mobile-business-launch` skill. These instructions govern the skill source repository, not app repositories created by the skill.\n\n## Read order\n\n1. `README.md` for product scope\n2. `skill/b2c-mobile-business-launch/README.md` for the source map\n3. `docs/architecture.md` for system boundaries\n4. `skill/b2c-mobile-business-launch/SKILL.md` for runtime contracts\n5. the owning directory README and directly relevant files\n\n## Source layers\n\n| Layer | Owns | Must not own |\n| --- | --- | --- |\n| `runtime/` | graph identities, contracts, compilation, scheduling, run state, adapters | business policy prose or mutable launch state |\n| `knowledge/` | bounded reasoning guidance and official-source-backed doctrine | scheduling or generated business artifacts |\n| `workspace/` | reusable launch artifacts copied into app repositories | skill execution topology |\n| `validation/` | launch gates, repository checks, fixtures, and LaunchBench | orchestration policy |\n| `tooling/` | renderers, probes, hooks, migrations, and runners | untestable durable policy |\n| `studio/` | maintainer visual app, seed state, and generated visual outputs | launch-instance canonical state |\n| `starters/` | runnable product-archetype foundations | alternate orchestration systems |\n\nDependencies point from runtime orchestration into bounded knowledge and workspace artifacts, then into deterministic validation. Filesystem proximity never creates an execution edge.\n\n## Authored and generated boundaries\n\n- Edit runtime graph definitions, not `runtime/graph/generated/`.\n- Edit authored Markdown, JSON, or source components, not generated HTML.\n- Every generated file needs an owning renderer and a freshness check.\n- Stable graph IDs survive path moves. Paths are bindings, not identity.\n- App state belongs in `workspace/business/state/`; studio seed state belongs in `studio/seed/`.\n\n## Change contract\n\nStructural or behavioral changes must update definitions, workspace artifacts, validators, fixtures or LaunchBench scenarios, generated projections, version metadata, and current documentation together. Archive completed plans under `docs/history/`.\n\n## Commands\n\n```bash\nnpm install\nnpm run audit\nnpm run audit:ci\nnpm run launchbench\nnpm run check:skill-graph\nnpm run render:skill-graph -- --check\nnpm pack --dry-run --json\n```\n\nSubagents may mutate bounded disjoint scopes. The orchestrator owns integration, git, canonical state, shared provider changes, public actions, spend, destructive actions, and release. Never commit secrets.\n""")

    claude = ROOT / "CLAUDE.md"
    if claude.exists():
        claude.write_text("""# Claude Runtime Guide\n\nOperate this repository through the typed graph and the ownership boundaries in `AGENTS.md`. Load only the context required by the active graph node.\n\n## Start here\n\n1. Read `skill/b2c-mobile-business-launch/README.md`.\n2. Read `skill/b2c-mobile-business-launch/SKILL.md`.\n3. Inspect the relevant runtime graph node and its context contract.\n4. Load the named knowledge references and workspace artifacts only.\n\n## Execution\n\n- Use the compiled graph for readiness and ordering.\n- Parallelize only nodes without data, state, or resource conflicts.\n- Give verifiers fresh context.\n- Treat `workspace/business/state/PROJECT_STATE.yaml` as canonical business state and mutate it only through the orchestrator-owned reducer.\n- Keep stable graph IDs unchanged when paths move.\n- Do not edit generated projections directly.\n\n## Repository responsibilities\n\n`runtime` executes, `knowledge` explains, `workspace` persists the business, `validation` proves, `tooling` performs mechanics, `studio` renders maintainer visuals, and `starters` bootstrap apps.\n""")


def main() -> None:
    old_files = {
        p.relative_to(SKILL).as_posix()
        for p in SKILL.rglob("*")
        if p.is_file()
    }
    snapshots: dict[str, str] = {}
    for rel in old_files:
        p = SKILL / rel
        if is_text(p):
            try:
                snapshots[rel] = p.read_text()
            except UnicodeDecodeError:
                pass

    for old, new in DIR_MOVES.items():
        move_path(old, new)

    for old_rel, text in snapshots.items():
        old_file = PurePosixPath(old_rel)
        new_file = mapped_skill_rel(old_file)
        dest = SKILL / new_file
        if not dest.exists():
            continue
        text = rewrite_relative_specifiers(text, old_file, new_file, old_files)
        if dest.suffix.lower() == ".md":
            text = rewrite_markdown_links(text, old_file, new_file, old_files)
        text = rewrite_known_paths(text)
        dest.write_text(text)

    # Repository-wide full-path and documentation references.
    for path in ROOT.rglob("*"):
        if not path.is_file() or ".git" in path.parts or "node_modules" in path.parts or not is_text(path):
            continue
        try:
            text = path.read_text()
        except UnicodeDecodeError:
            continue
        new_text = rewrite_known_paths(text)
        if new_text != text:
            path.write_text(new_text)

    write_readmes()
    rewrite_root_guides()

    # Version this as a structural minor release.
    manifest = SKILL / "skill-version.json"
    if manifest.exists():
        text = manifest.read_text()
        text = re.sub(r'"version"\s*:\s*"[^"]+"', '"version": "0.68.0"', text, count=1)
        manifest.write_text(text)
    for package in [ROOT / "package.json", SKILL / "package.json"]:
        if package.exists():
            text = package.read_text()
            text = re.sub(r'"version"\s*:\s*"[^"]+"', '"version": "0.68.0"', text, count=1)
            package.write_text(text)

    print("Source layout migration complete")


if __name__ == "__main__":
    main()

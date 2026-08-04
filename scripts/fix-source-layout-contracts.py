from pathlib import Path
import os
import re

ROOT = Path.cwd()
SKILL = ROOT / "skill" / "b2c-mobile-business-launch"
replacements = {
    'graph/**/*.ts': 'runtime/graph/**/*.ts',
    'graph/**/*.tsx': 'runtime/graph/**/*.tsx',
    'gates/**/*.ts': 'validation/business/**/*.ts',
    'machine/**/*.ts': 'validation/repository/**/*.ts',
    'scripts/**/*.ts': 'tooling/**/*.ts',
    'graph/**/*.json': 'runtime/graph/**/*.json',
    'playbook/**/*.md': 'knowledge/**/*.md',
    'business/**/*.md': 'workspace/business/**/*.md',
}

for path in ROOT.rglob('*'):
    if not path.is_file() or '.git' in path.parts or 'node_modules' in path.parts:
        continue
    if path.suffix.lower() not in {'.json', '.yaml', '.yml', '.md', '.ts', '.tsx'}:
        continue
    try:
        text = path.read_text()
    except UnicodeDecodeError:
        continue
    new = text
    for old, replacement in replacements.items():
        new = new.replace(old, replacement)

    if path.suffix.lower() in {'.ts', '.tsx'} and SKILL in path.parents:
        def fix_graph_import(match: re.Match[str]) -> str:
            rest = match.group('rest')
            target = SKILL / 'runtime' / 'graph' / rest
            rel = os.path.relpath(target, path.parent).replace(os.sep, '/')
            if not rel.startswith('.'):
                rel = './' + rel
            return match.group('quote') + rel + match.group('quote')

        new = re.sub(
            r'(?P<quote>["\'])(?:\.{1,2}/)+graph/(?P<rest>[^"\']+)(?P=quote)',
            fix_graph_import,
            new,
        )

    if new != text:
        path.write_text(new)

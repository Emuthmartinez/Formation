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
    'skillRoot, "business"': 'skillRoot, "workspace", "business"',
    "skillRoot, 'business'": "skillRoot, 'workspace', 'business'",
    'SKILL_ROOT, "business"': 'SKILL_ROOT, "workspace", "business"',
    "SKILL_ROOT, 'business'": "SKILL_ROOT, 'workspace', 'business'",
}
TARGET_ROOTS = {
    'graph': ('runtime', 'graph'),
    'runtime/graph': ('runtime', 'graph'),
    'scripts': ('tooling',),
    'tooling': ('tooling',),
    'gates': ('validation', 'business'),
    'validation/business': ('validation', 'business'),
    'machine': ('validation', 'repository'),
    'validation/repository': ('validation', 'repository'),
    'playbook': ('knowledge',),
    'knowledge': ('knowledge',),
    'business': ('workspace', 'business'),
    'workspace/business': ('workspace', 'business'),
    'render': ('studio', 'app'),
    'studio/app': ('studio', 'app'),
    'state': ('studio', 'seed'),
    'studio/seed': ('studio', 'seed'),
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
        import_pattern = re.compile(r'(?P<quote>["\'])(?P<spec>(?:\.{1,2}/)+[^"\']+)(?P=quote)')

        def fix_import(match: re.Match[str]) -> str:
            spec = match.group('spec')
            normalized = spec.replace('\\', '/')
            chosen = None
            rest = ''
            for marker, target_parts in sorted(TARGET_ROOTS.items(), key=lambda item: len(item[0]), reverse=True):
                token = marker + '/'
                idx = normalized.find(token)
                if idx >= 0:
                    chosen = target_parts
                    rest = normalized[idx + len(token):]
                    break
            if chosen is None:
                return match.group(0)
            target = SKILL.joinpath(*chosen, rest)
            rel = os.path.relpath(target, path.parent).replace(os.sep, '/')
            if not rel.startswith('.'):
                rel = './' + rel
            return match.group('quote') + rel + match.group('quote')

        new = import_pattern.sub(fix_import, new)

    if new != text:
        path.write_text(new)

from pathlib import Path

ROOT = Path.cwd()
replacements = {
    '"graph/**/*.ts"': '"runtime/graph/**/*.ts"',
    '"graph/**/*.tsx"': '"runtime/graph/**/*.tsx"',
    '"gates/**/*.ts"': '"validation/business/**/*.ts"',
    '"machine/**/*.ts"': '"validation/repository/**/*.ts"',
    '"scripts/**/*.ts"': '"tooling/**/*.ts"',
    '"graph/**/*.json"': '"runtime/graph/**/*.json"',
    '"playbook/**/*.md"': '"knowledge/**/*.md"',
    '"business/**/*.md"': '"workspace/business/**/*.md"',
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
    if new != text:
        path.write_text(new)

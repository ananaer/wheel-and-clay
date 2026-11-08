"""发布前校验两位独立审核者的明确结论与实际交付文件哈希。"""
from pathlib import Path
import hashlib
import json
import sys

root = Path(__file__).resolve().parents[1]
scope = sys.argv[1] if len(sys.argv) > 1 else 'all'
if scope not in ('web', 'film', 'all'):
    raise SystemExit('Use: python3 tools/check_release_gate.py [web|film|all]')
targets = {'web': root / 'Wheel-and-Clay.html',
           'film': root / 'qa' / 'film-v5' / 'Wheel-and-Clay-Motion-V5.mp4'}
required = list(targets) if scope == 'all' else [scope]
errors = []
for reviewer in ('visual', 'motion'):
    manifest = root / 'qa' / 'integration' / (reviewer + '-signoff.json')
    try:
        record = json.loads(manifest.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        errors.append(reviewer + ': missing or invalid independent sign-off')
        continue
    for name in required:
        signoff = record.get(name, {})
        if signoff.get('status') != 'PASS':
            errors.append(reviewer + '/' + name + ': not approved')
            continue
        if not targets[name].is_file():
            errors.append(name + ': delivery file missing')
            continue
        actual = hashlib.sha256(targets[name].read_bytes()).hexdigest()
        if actual != signoff.get('sha256'):
            errors.append(reviewer + '/' + name + ': file changed after independent review')
if errors:
    print('RELEASE BLOCKED\n' + '\n'.join(errors))
    raise SystemExit(1)
print('PASS: both independent reviewers approved the exact ' + scope + ' delivery files.')

"""发布前校验两位独立审核者的明确结论与实际交付文件哈希。"""
from pathlib import Path
import hashlib
import json
import sys

root = Path(__file__).resolve().parents[1]
scope = sys.argv[1] if len(sys.argv) > 1 else 'all'
if scope not in ('web', 'site', 'film', 'all'):
    raise SystemExit('Use: python3 tools/check_release_gate.py [web|site|film|all]')
targets = {'web': root / 'Wheel-and-Clay.html',
           'site': root / 'deploy' / 'pages-manifest.json',
           'film': root / 'media' / 'wheel-and-clay-intro.mp4'}
required = list(targets) if scope == 'all' else [scope]
errors = []
if 'site' in required:
    try:
        sys.path.insert(0, str(root / 'deploy'))
        from prepare_pages import verify_site
        site_manifest = json.loads(targets['site'].read_text())
        verify_site(root / 'deploy' / 'pages-site', site_manifest)
        if site_manifest['source_sha256'] != hashlib.sha256(targets['web'].read_bytes()).hexdigest():
            errors.append('site: source changed after split build')
    except (OSError, ValueError, KeyError) as exc:
        errors.append('site: invalid deployment manifest: ' + str(exc))
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

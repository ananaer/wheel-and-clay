"""把已批准的单文件版拆成小首页与原字节静态资源，不执行网络部署。"""
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'deploy' / 'pages-site'
MANIFEST = ROOT / 'deploy' / 'pages-manifest.json'
INDEX_LIMIT = 32768
PROJECT_ID = '1453297a-e446-4298-a8dd-a46da2c48e94'
PARTS = re.compile(r'<style>(.*?)</style>|<script([^>]*)>(.*?)</script>', re.S)


class PageCheck(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_head = False
        self.proofs = []

    def handle_starttag(self, tag, attrs):
        if tag == 'head':
            self.in_head = True
        attrs = dict(attrs)
        if tag == 'meta' and attrs.get('name') == 'squeekchain-project':
            self.proofs.append((self.in_head, attrs.get('content')))

    def handle_endtag(self, tag):
        if tag == 'head':
            self.in_head = False


def package(page, license_bytes):
    source = page.decode('utf-8')
    outputs, replacements = {}, []
    counts = {'style': 0, 'script': 0}

    def extract(match):
        kind = 'style' if match[1] is not None else 'script'
        text = match[1] if kind == 'style' else match[3]
        attrs = '' if kind == 'style' else match[2]
        if kind == 'script' and attrs not in ('', ' type="module"'):
            raise ValueError('存在未审查的 script 属性，停止拆分。')
        content = text.encode('utf-8')
        suffix = 'css' if kind == 'style' else 'js'
        name = f'assets/{kind}-{counts[kind]:02d}-{sha256(content).hexdigest()[:16]}.{suffix}'
        counts[kind] += 1
        outputs[name] = content
        tag = (f'<link rel="stylesheet" href="{name}">' if kind == 'style'
               else f'<script{attrs} src="{name}"></script>')
        replacements.append((tag, match[0]))
        return tag

    small = PARTS.sub(extract, source)
    if counts != {'style': 7, 'script': 3}:
        raise ValueError('入口资源数量改变，需要重新审查。')
    restored = small
    for tag, original in replacements:
        restored = restored.replace(tag, original, 1)
    if restored.encode('utf-8') != page:
        raise ValueError('外置资源不能逐字节还原原页面。')
    if len(small.encode('utf-8')) > INDEX_LIMIT:
        raise ValueError('首页超过32KiB发布预算。')
    check = PageCheck()
    check.feed(small)
    if check.proofs != [(True, PROJECT_ID)]:
        raise ValueError('首页缺失或重复官方 head 验证标签。')
    outputs.update({'index.html': small.encode('utf-8'),
                    'THREE-LICENSE.txt': license_bytes,
                    'CNAME': b'wheel-and-clay.shop\n', '.nojekyll': b''})
    manifest = {'format': 1, 'source_sha256': sha256(page).hexdigest(),
                'index_limit_bytes': INDEX_LIMIT,
                'files': {name: {'bytes': len(data), 'sha256': sha256(data).hexdigest()}
                          for name, data in sorted(outputs.items())}}
    return outputs, manifest


def verify_site(directory, manifest):
    directory = Path(directory)
    files = manifest['files']
    for name in files:
        path = Path(name)
        if path.is_absolute() or '..' in path.parts or str(path) != name:
            raise ValueError('清单包含不安全路径。')
    if directory.is_symlink() or any(p.is_symlink() for p in directory.rglob('*')):
        raise ValueError('发布目录不允许符号链接。')
    actual = {p.relative_to(directory).as_posix() for p in directory.rglob('*') if p.is_file()}
    if actual != set(files):
        raise ValueError('发布文件集合与审核清单不一致。')
    for name, expected in files.items():
        data = (directory / name).read_bytes()
        if len(data) != expected['bytes'] or sha256(data).hexdigest() != expected['sha256']:
            raise ValueError('文件与审核清单不一致：' + name)
    if len((directory / 'index.html').read_bytes()) > INDEX_LIMIT:
        raise ValueError('首页超过大小预算。')


def prepare():
    page = (ROOT / 'Wheel-and-Clay.html').read_bytes()
    outputs, manifest = package(page, (ROOT / 'vendor' / 'THREE-LICENSE.txt').read_bytes())
    if SITE.exists():
        if not MANIFEST.is_file():
            raise SystemExit('已有未记录的发布目录，停止覆盖。')
        previous = json.loads(MANIFEST.read_text())
        verify_site(SITE, previous)
        # 只移除上一份本工具清单中已核对的过期构建产物。
        for name in set(previous['files']) - set(outputs):
            (SITE / name).unlink()
    SITE.mkdir(parents=True, exist_ok=True)
    for name, data in outputs.items():
        path = SITE / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + '\n')
    verify_site(SITE, manifest)
    print(f'Prepared {len(outputs)} files; index.html {len(outputs["index.html"])} bytes '
          f'(was {len(page)}). Nothing deployed.')


if __name__ == '__main__':
    prepare()

"""静态发布拆包与拒绝错误产物的回归检查；不访问网络。"""
from pathlib import Path
from tempfile import TemporaryDirectory
import importlib.util
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('prepare_pages', ROOT / 'deploy' / 'prepare_pages.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fixture():
    styles = ''.join(f'<style>.s{i}{{color:red}}</style>' for i in range(9))
    scripts = '<script>window.a=1;</script><script>window.b=2;</script><script type="module">const c=3;</script>'
    return ('<!doctype html><html><head><meta name="squeekchain-project" content="' +
            module.PROJECT_ID + '">' + styles + '</head><body><h1>Pottery</h1>' + scripts + '</body></html>').encode()


class PagesBuildTests(unittest.TestCase):
    def test_rebuild_original_bytes_in_original_order(self):
        import re
        outputs, manifest = module.package(fixture(), b'license')
        html = outputs['index.html'].decode()
        html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                      lambda m: '<style>' + outputs[m[1]].decode() + '</style>', html)
        html = re.sub(r'<script( type="module")? src="([^"]+)"></script>',
                      lambda m: '<script' + (m[1] or '') + '>' + outputs[m[2]].decode() + '</script>', html)
        self.assertEqual(html.encode(), fixture())
        self.assertEqual(len(manifest['files']), 16)
        self.assertLessEqual(len(outputs['index.html']), 32768)

    def test_changed_script_execution_is_rejected(self):
        with self.assertRaises(ValueError):
            module.package(fixture().replace(b'<script>', b'<script async>', 1), b'license')

    def test_missing_or_duplicate_proof_is_rejected(self):
        for page in (fixture().replace(module.PROJECT_ID.encode(), b'wrong'),
                     fixture().replace(b'</head>', b'<meta name="squeekchain-project" content="x"></head>')):
            with self.subTest(page=page[-30:]), self.assertRaises(ValueError):
                module.package(page, b'license')

    def test_large_document_is_rejected(self):
        with self.assertRaises(ValueError):
            module.package(fixture().replace(b'<h1>', b'x' * 32768 + b'<h1>'), b'license')

    def test_asset_drift_is_rejected(self):
        with TemporaryDirectory() as tmp:
            outputs, manifest = module.package(fixture(), b'license')
            root = Path(tmp)
            for name, data in outputs.items():
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
            module.verify_site(root, manifest)
            (root / 'index.html').write_bytes(b'changed')
            with self.assertRaises(ValueError):
                module.verify_site(root, manifest)

    def test_unlisted_private_file_is_rejected(self):
        with TemporaryDirectory() as tmp:
            outputs, manifest = module.package(fixture(), b'license')
            root = Path(tmp)
            for name, data in outputs.items():
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
            (root / '.env').write_text('DO_NOT_PUBLISH')
            with self.assertRaises(ValueError):
                module.verify_site(root, manifest)

    def test_symlink_is_rejected(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'linked').symlink_to(ROOT / 'README.md')
            with self.assertRaises(ValueError):
                module.verify_site(root, {'files': {}})

    def test_unsafe_manifest_path_is_rejected(self):
        with TemporaryDirectory() as tmp, self.assertRaises(ValueError):
            module.verify_site(Path(tmp), {'files': {'../outside': {}}})


if __name__ == '__main__':
    unittest.main()

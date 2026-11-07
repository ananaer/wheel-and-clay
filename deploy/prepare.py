"""只准备可公开的静态文件；不登录、不部署、不读取凭据。"""
from hashlib import sha256
from pathlib import Path
import os

DEPLOY = Path(__file__).resolve().parent
ROOT = DEPLOY.parent
PUBLIC = DEPLOY / "public"
ALLOWED = {"index.html", "THREE-LICENSE.txt", "_headers"}
HEADERS = """/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Cache-Control: no-cache
"""


def prepare():
    page = (ROOT / "Wheel-and-Clay.html").read_bytes()
    text = page.decode("utf-8")
    if "<script type=\"module\" src=\"app.js\">" in text:
        raise SystemExit("HTML 尚未打包。请先在项目目录运行 python3 build.py。")
    for forbidden in ("QA fixture", "NOT LIVE DATA", "/Users/", "/workspace/", "file://"):
        if forbidden in text:
            raise SystemExit(f"停止：公开页面含有禁止发布的标记 {forbidden!r}。")
    PUBLIC.mkdir(exist_ok=True)
    unexpected = sorted(p.name for p in PUBLIC.iterdir() if p.name not in ALLOWED)
    if unexpected:
        raise SystemExit("停止：public 出现白名单以外的文件：" + ", ".join(unexpected))
    outputs = {
        "index.html": page,
        "THREE-LICENSE.txt": (ROOT / "vendor" / "THREE-LICENSE.txt").read_bytes(),
        "_headers": HEADERS.encode("utf-8"),
    }
    for name, content in outputs.items():
        destination = PUBLIC / name
        temporary = PUBLIC / ("." + name + ".tmp")
        temporary.write_bytes(content)
        os.replace(temporary, destination)
        print(f"{name}: {len(content)} bytes; sha256 {sha256(content).hexdigest()}")
    assert {p.name for p in PUBLIC.iterdir()} == ALLOWED
    assert (PUBLIC / "index.html").read_bytes() == page
    print("Prepared exactly 3 public files. Nothing deployed.")


if __name__ == "__main__":
    prepare()

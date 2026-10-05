#!/usr/bin/env python3
"""
打包发布产物：只含源码，不含 node_modules / .next。
产出：toolbox-v<X.Y.Z>.zip 和 .tar.gz，放到 release/ 与工作区根目录。

用法：python3 scripts/package.py
"""
import os
import shutil
import subprocess
import sys
import tarfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WS = os.path.dirname(ROOT)                     # 工作区根目录
OUT_DIRS = [os.path.join(WS, "release"), WS]

EXCLUDE_DIRS = {"node_modules", ".next", ".git", "release"}
EXCLUDE_FILES = {"next-env.d.ts"}
EXCLUDE_EXT = {".tsbuildinfo", ".zip", ".tar.gz"}


def version():
    import json
    with open(os.path.join(ROOT, "package.json"), encoding="utf-8") as f:
        return json.load(f)["version"]


def collect():
    out = []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDE_DIRS)
        for name in sorted(files):
            if name in EXCLUDE_FILES or os.path.splitext(name)[1] in EXCLUDE_EXT:
                continue
            full = os.path.join(base, name)
            rel = os.path.relpath(full, os.path.dirname(ROOT))
            out.append((full, rel))
    return out


def main():
    ver = version()
    files = collect()
    base = f"toolbox-v{ver}"
    print(f"版本 {ver}，共 {len(files)} 个文件")

    for out_dir in OUT_DIRS:
        os.makedirs(out_dir, exist_ok=True)

    # zip
    for out_dir in OUT_DIRS:
        path = os.path.join(out_dir, f"{base}.zip")
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            for full, rel in files:
                z.write(full, rel)
        print(f"  ✓ {path}  ({os.path.getsize(path)/1024:.1f} KB)")

    # tar.gz
    for out_dir in OUT_DIRS:
        path = os.path.join(out_dir, f"{base}.tar.gz")
        with tarfile.open(path, "w:gz") as t:
            for full, rel in files:
                t.add(full, arcname=rel)
        print(f"  ✓ {path}  ({os.path.getsize(path)/1024:.1f} KB)")

    # 完整性校验
    for out_dir in OUT_DIRS:
        zp = os.path.join(out_dir, f"{base}.zip")
        z = zipfile.ZipFile(zp)
        bad = z.testzip()
        names = z.namelist()
        print(f"\n校验 {zp}: {'通过' if bad is None else '损坏于 ' + bad}，{len(names)} 个文件")

        must = ["toolbox/package.json", "toolbox/src/lib/core/registry.ts", "toolbox/README.md"]
        missing = [m for m in must if m not in names]
        print(f"关键文件: {'✓ 齐全' if not missing else '✗ 缺少 ' + str(missing)}")

        leaked = [n for n in names if "node_modules" in n or "/.next/" in n]
        print(f"大目录泄漏: {'✗ ' + str(leaked[:3]) if leaked else '✓ 无'}")

    print("\n✅ 打包完成")


if __name__ == "__main__":
    main()

"""Convert the Grok holiday PNGs to small WebP files for the TV page, then check every output.

Usage: py -3 tests/holiday/convert_images.py <src_dir> <dst_dir>
Main pictures become 512x512, sprite-* files 256x256. Each output must be RGBA, at most 100 KB,
with transparent corners. Exits non-zero if any check fails.
"""
import os
import sys
from PIL import Image

MAX_KB = 100


def convert(src, dst, size, quality):
    im = Image.open(src).convert("RGBA").resize((size, size), Image.LANCZOS)
    im.save(dst, "WEBP", quality=quality, method=6)


def check(path):
    im = Image.open(path)
    if im.mode != "RGBA":
        return f"mode {im.mode}, expected RGBA"
    w, h = im.size
    a = im.getchannel("A")
    if any(a.getpixel(p) >= 10 for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]):
        return "corners not transparent"
    kb = os.path.getsize(path) / 1024
    if kb > MAX_KB:
        return f"{kb:.0f} KB, over {MAX_KB} KB"
    return None


def main(src_dir, dst_dir):
    os.makedirs(dst_dir, exist_ok=True)
    failed = 0
    for name in sorted(f for f in os.listdir(src_dir) if f.lower().endswith(".png")):
        size = 256 if name.startswith("sprite-") else 512
        out = os.path.join(dst_dir, os.path.splitext(name)[0] + ".webp")
        quality = 82
        convert(os.path.join(src_dir, name), out, size, quality)
        while (problem := check(out)) and "KB" in problem and quality > 50:   # too big: step quality down
            quality -= 5
            convert(os.path.join(src_dir, name), out, size, quality)
        status = problem or "OK"
        failed += bool(problem)
        print(f"{os.path.basename(out):28} {size}px q{quality:<3} {os.path.getsize(out) // 1024:4} KB  {status}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

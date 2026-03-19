"""Generate wallpapers manifest for GitHub Pages static hosting.

Why:
- GitHub Pages can't list directories at runtime.
- The frontend will fetch `assets/wallpapers/manifest.json` to discover
  wallpapers (images + videos) automatically.

Usage (PowerShell):
    python scripts\\gen_wallpaper_manifest.py

Commit these files:
- assets/wallpapers/manifest.json
- any added/removed wallpaper media files

Expected folder layout (do NOT rename):
- assets/wallpapers/*.png|jpg|jpeg|webp
- assets/wallpapers/videos/*.mp4|webm
- assets/wallpapers/posters/*.(jpg|png|webp)  (optional)
"""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WALLPAPERS = ROOT / "assets" / "wallpapers"
VIDEOS = WALLPAPERS / "videos"
POSTERS = WALLPAPERS / "posters"
OUT = WALLPAPERS / "manifest.json"

IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
VID_EXTS = {".mp4", ".webm"}
POSTER_EXTS = {".jpg", ".png", ".webp"}


def natural_key(s: str):
    # Split into digit / non-digit chunks for natural sorting (01,02,10...)
    return [int(p) if p.isdigit() else p.lower() for p in re.split(r"(\d+)", s)]


def rel_posix(p: Path) -> str:
    # manifest paths should be web paths, starting with assets/...
    return p.relative_to(ROOT).as_posix()


def find_poster(video_file: Path) -> str | None:
    stem = video_file.stem
    for ext in sorted(POSTER_EXTS):
        cand = POSTERS / f"{stem}{ext}"
        if cand.exists():
            return rel_posix(cand)
    return None


def main() -> int:
    if not WALLPAPERS.exists():
        raise SystemExit(f"Wallpapers folder not found: {WALLPAPERS}")

    images = []
    for p in WALLPAPERS.iterdir():
        if p.is_file() and p.suffix.lower() in IMG_EXTS:
            images.append(p)

    images.sort(key=lambda x: natural_key(x.name))

    videos = []
    if VIDEOS.exists():
        for p in VIDEOS.iterdir():
            if p.is_file() and p.suffix.lower() in VID_EXTS:
                videos.append(p)

    videos.sort(key=lambda x: natural_key(x.name))

    manifest = {
        "images": [rel_posix(p) for p in images],
        "videos": [],
    }

    for v in videos:
        entry = {"src": rel_posix(v)}
        poster = find_poster(v)
        if poster:
            entry["poster"] = poster
        manifest["videos"].append(entry)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} ({len(manifest['images'])} images, {len(manifest['videos'])} videos)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

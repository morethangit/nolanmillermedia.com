#!/usr/bin/env bash
#
# build-images.sh — generate web-ready derivatives from the originals in images/.
#
# The originals are 86MB of unoptimized 4K PNGs and full-res iPhone JPEGs. They are the
# source of truth and stay in git, but they are never served. This script produces
# images/opt/<slug>-<width>.jpg, which is what the pages reference via srcset.
#
# Uses only `sips` (built into macOS) — no npm install, no homebrew.
#
# JPEG ONLY, deliberately. sips *can* write AVIF, and we shipped that first, but it
# encodes anything non-trivial as a TILED GRID (a `grid` derived item over N `av01`
# tiles — 6 tiles at 1200px, 12 at 2000px). Chrome reads the dimensions off those
# files, reports a non-zero naturalWidth, and then paints nothing at all. The
# single-tile outputs render fine, which is why smaller derivatives worked and the
# 2000px ones silently rendered as black boxes on the deployed site. Worse, <picture>
# has no decode-failure fallback: once the browser picks the AVIF source it will not
# fall back to the JPEG. ffmpeg decodes the same files happily, so this is specific to
# the sips grid output.
#
# If AVIF/WebP is wanted later, generate it with something that writes single-item
# files (sharp/libvips, cwebp, avifenc) and verify it actually PAINTS in a browser —
# checking naturalWidth is not sufficient.
#
# Usage:  ./tools/build-images.sh            # build everything
#         ./tools/build-images.sh --force    # rebuild even if up to date
#
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=images
OUT=images/opt
FORCE=${1:-}
mkdir -p "$OUT"

JPEG_Q=76      # visually transparent on dark photographic material

native_width() { sips -g pixelWidth "$1" | awk '/pixelWidth/{print $2}'; }

# derive <source> <slug> <rotation-degrees> <width...>
derive() {
  local src="$1" slug="$2" rot="$3"; shift 3
  [ -f "$src" ] || { echo "  !! missing: $src" >&2; return 1; }

  local native; native=$(native_width "$src")
  local work="$src"

  # Rotation is baked into a temp file so every derivative inherits it.
  if [ "$rot" != "0" ]; then
    work=$(mktemp -t nmm).${src##*.}
    cp "$src" "$work"
    sips -r "$rot" "$work" >/dev/null
    native=$(native_width "$work")
  fi

  for w in "$@"; do
    # Never upscale — cap the request at the source's native width.
    local target=$w
    [ "$w" -gt "$native" ] && target=$native

    local jpg="$OUT/$slug-$w.jpg"

    if [ -z "$FORCE" ] && [ -f "$jpg" ] && [ "$jpg" -nt "$src" ]; then
      echo "  -- $slug-$w (up to date)"
      continue
    fi

    sips --resampleWidth "$target" "$work" \
         -s format jpeg -s formatOptions "$JPEG_Q" \
         --out "$jpg" >/dev/null

    printf "  ok %-22s %5spx  jpg %s\n" "$slug-$w" "$target" "$(du -h "$jpg" | cut -f1)"
  done

  [ "$rot" != "0" ] && rm -f "$work"
  return 0
}

echo "== Cinematography — 16:9 frames =="
derive "$SRC/ysuc2.png"    ysuc-still    0 1200 2000
derive "$SRC/ysuc.png"     ysuc-wide     0 1200 2000
derive "$SRC/db.png"       dead-bent     0 1200 2000
derive "$SRC/psg.png"      poolside      0 1200 2000   # real Poolside art; site had hero s2 here
derive "$SRC/topher.jpg"   threshold     0 1200 2000
derive "$SRC/hs.png"       horsesitter   0 1200 2000
derive "$SRC/Image.png"    frame-01      0 1200 2000   # 6144x2592 ultrawide, 48.8MB source
derive "$SRC/Image 2.png"  frame-02      0 1200 2000   # was never referenced anywhere
derive "$SRC/Image 3.png"  frame-03      0 1200 2000
derive "$SRC/Image 4.png"  frame-04      0 1200 2000

echo "== Lighting — 4:5 portraits and stage plates =="
derive "$SRC/0F1996B0-0F42-43E7-8F30-2877B13487C0.jpg" room-01 0  800 1179
derive "$SRC/DB34BE0D-4994-4509-99BF-A980AA6D227B.jpg" room-02 0  800 1179
# Note: IMG_3384/IMG_4113 carry an EXIF orientation flag that sips bakes in on resample,
# so these need no explicit rotation — adding one double-rotates them.
derive "$SRC/IMG_3384.jpeg" room-03 0 1200 2000
derive "$SRC/IMG_4113.jpeg" room-04  0 1200 2000

echo
echo "total: $(du -sh "$OUT" | cut -f1) across $(ls "$OUT" | wc -l | tr -d ' ') files"

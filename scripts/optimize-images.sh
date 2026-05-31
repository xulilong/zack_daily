#!/usr/bin/env bash
# 将 assets/images 下的 PNG 压缩为 WebP（保留原 PNG 作回退）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/assets/images"
command -v cwebp >/dev/null || { echo "需要 cwebp：brew install webp"; exit 1; }

webp() {
  local src="$1" max_w="${2:-0}" max_h="${3:-0}" q="${4:-82}"
  local base="${src%.png}"
  if [[ "$max_w" -gt 0 && "$max_h" -gt 0 ]]; then
    cwebp -quiet -q "$q" "$src" -resize "$max_w" "$max_h" -o "${base}.webp"
  elif [[ "$max_w" -gt 0 ]]; then
    cwebp -quiet -q "$q" "$src" -resize "$max_w" 0 -o "${base}.webp"
  elif [[ "$max_h" -gt 0 ]]; then
    cwebp -quiet -q "$q" "$src" -resize 0 "$max_h" -o "${base}.webp"
  else
    cwebp -quiet -q "$q" "$src" -o "${base}.webp"
  fi
}

for f in "$DIR"/bg_*_sky.png; do
  [[ -f "$f" ]] || continue
  webp "$f" 8800 0 80
done

for f in hero.png hero_jump.png hero_run.png prop_badge.png; do
  [[ -f "$DIR/$f" ]] && webp "$DIR/$f" 512 512 85
done

for f in ui_sign_bus.png ui_sign_coffee.png; do
  [[ -f "$DIR/$f" ]] && webp "$DIR/$f" 256 256 82
done

[[ -f "$DIR/index.png" ]] && webp "$DIR/index.png" 1920 0 82

echo "Done. PNG vs WebP sizes:"
du -sh "$DIR"/*.png "$DIR"/*.webp 2>/dev/null | sort -hr | head -20

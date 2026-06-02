#!/usr/bin/env bash
# Sync AuroraGPT-2B figures from the Megatron-DeepSpeed repo into the
# 2026-06-03 talk's public/ assets. Only copies files whose hash differs;
# safe to run any time the source is regenerated.
#
# Source plots are matplotlib SVGs with `rasterized=True` on the scatter
# layer — vector axes/labels + embedded PNG point cloud, ~300KB each.
# (Earlier full-vector renders ballooned to 28MB / 163K SVG <use> elements
# and locked the browser; that's been fixed at the source.)
#
# Usage:
#   ./scripts/sync-2b-mds-figures.sh

set -euo pipefail

SRC="${HOME}/projects/saforem2/Megatron-DeepSpeed/ALCF/AuroraGPT/2B/assets"
DST="${HOME}/projects/saforem2/sam.onl/web/public/talks/2026-06-03/figures/2b-mds"

if [ ! -d "$SRC" ]; then
    echo "source dir missing: $SRC" >&2
    exit 1
fi

mkdir -p "$DST/light" "$DST/dark"

copied=0
skipped=0

for variant in light dark; do
    [ -d "$SRC/$variant" ] || continue
    for svg in "$SRC/$variant"/*.svg; do
        base=$(basename "$svg")
        out="$DST/$variant/$base"
        if [ -f "$out" ]; then
            srcH=$(shasum "$svg" | cut -d' ' -f1)
            dstH=$(shasum "$out" | cut -d' ' -f1)
            if [ "$srcH" = "$dstH" ]; then
                skipped=$((skipped + 1))
                continue
            fi
        fi
        cp -f "$svg" "$out"
        copied=$((copied + 1))
        echo "copied $variant/$base"
    done
done

# Sweep any leftover PNG rasterizations from when we still needed them.
for stale in "$DST"/light/iter_time_vs_runtime{,_zoom}.png "$DST"/dark/iter_time_vs_runtime{,_zoom}.png; do
    [ -f "$stale" ] || continue
    rm -f "$stale"
    echo "removed stale raster $(echo "$stale" | sed "s|$DST/||")"
done

echo
echo "summary: $copied copied, $skipped unchanged"
echo "total size: $(du -sh "$DST" | cut -f1)"

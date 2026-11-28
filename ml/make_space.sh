#!/bin/sh
# Assembles the plan reader's Hugging Face Space in ml/space_build/: the Space's Dockerfile and README,
# the reader code, and the trained model (98 MB, kept out of git). Upload that folder to the Space.
#   sh ml/make_space.sh [path/to/best.pt]
set -e
cd "$(dirname "$0")"
MODEL="${1:-runs/v2/best.pt}"
[ -f "$MODEL" ] || { echo "No model at $MODEL"; exit 1; }
rm -rf space_build && mkdir -p space_build/model
cp space/Dockerfile space/README.md requirements-serve.txt serve.py space_build/
cp -R archetech_ml space_build/
find space_build -name __pycache__ -prune -exec rm -rf {} +
cp "$MODEL" space_build/model/best.pt
printf '*.pt filter=lfs diff=lfs merge=lfs -text\n' > space_build/.gitattributes
echo "Ready: ml/space_build ($(du -sh space_build | cut -f1))"

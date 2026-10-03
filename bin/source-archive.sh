#!/bin/bash
# Builds the complete corresponding source archive served at
# /source/sts-street-source.tar.gz (AGPL-3.0 section 13).
# Run from the repository root at build/deploy time.
set -euo pipefail
OUT_DIR="build/source"
NAME="sts-street-source.tar.gz"
COMMIT="${SOURCE_COMMIT:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"
mkdir -p "$OUT_DIR"
if git rev-parse HEAD >/dev/null 2>&1; then
  git archive --format=tar.gz --prefix="sts-street-${COMMIT:0:12}/" -o "$OUT_DIR/$NAME" HEAD
else
  # Not a git checkout (e.g. inside a Docker build context): archive the tree,
  # excluding dependencies, build output, secrets and runtime data.
  tar --exclude='./node_modules' --exclude='./*/node_modules' --exclude='./build' \
      --exclude='./.env' --exclude='./data' --exclude='./.parcel-cache' \
      --exclude='./docs/build' --exclude='./docs/node_modules' \
      -czf "$OUT_DIR/$NAME" --transform "s,^\./,sts-street-${COMMIT:0:12}/," .
fi
echo "$COMMIT" > "$OUT_DIR/COMMIT"
echo "Wrote $OUT_DIR/$NAME ($(du -h "$OUT_DIR/$NAME" | cut -f1)) for commit $COMMIT"

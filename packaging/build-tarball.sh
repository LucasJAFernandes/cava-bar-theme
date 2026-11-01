#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PACKAGE="cava-bar-theme"
VERSION="${VERSION:-1.0.0}"
OUTPUT_DIR="${OUTPUT_DIR:-dist}"
ARCHIVE="$OUTPUT_DIR/${PACKAGE}-${VERSION}.tar.gz"

mkdir -p "$OUTPUT_DIR"
tar --exclude='./.git' \
    --exclude='./dist' \
    --exclude='./__pycache__' \
    --exclude='./bin/__pycache__' \
    --exclude='*.pyc' \
    -czf "$ARCHIVE" \
    --transform="s,^\.,${PACKAGE}-${VERSION}," \
    .
echo "Built $ARCHIVE"
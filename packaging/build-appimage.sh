#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PACKAGE="cava-bar-theme"
VERSION="${VERSION:-1.0.0}"
OUTPUT_DIR="${OUTPUT_DIR:-dist}"
BUILD_DIR="$(mktemp -d)"
APP_DIR="$BUILD_DIR/${PACKAGE}.AppDir"

cleanup() {
  rm -rf "$BUILD_DIR"
}
trap cleanup EXIT

command -v appimagetool >/dev/null 2>&1 || {
  echo "Error: appimagetool is required to build the AppImage." >&2
  exit 1
}

mkdir -p "$APP_DIR/usr/share/$PACKAGE"
cp -R bin config demo gnome-extension templates README.md LICENSE install.sh \
  "$APP_DIR/usr/share/$PACKAGE/"

cat > "$APP_DIR/AppRun" <<'EOF'
#!/bin/sh
set -eu
APP_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ "$#" -eq 0 ]; then
  set -- --autostart
fi
exec "$APP_DIR/usr/share/cava-bar-theme/install.sh" "$@"
EOF
chmod 755 "$APP_DIR/AppRun"

mkdir -p "$OUTPUT_DIR"
ARCH="${ARCH:-$(uname -m)}"
appimagetool "$APP_DIR" "$OUTPUT_DIR/${PACKAGE}-${VERSION}-${ARCH}.AppImage"
echo "Built $OUTPUT_DIR/${PACKAGE}-${VERSION}-${ARCH}.AppImage"
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PACKAGE="cava-bar-theme"
VERSION="${VERSION:-1.0.0}"
ARCH="all"
OUTPUT_DIR="${OUTPUT_DIR:-dist}"
BUILD_DIR="$(mktemp -d)"
ROOT="$BUILD_DIR/${PACKAGE}_${VERSION}_${ARCH}"

cleanup() {
  rm -rf "$BUILD_DIR"
}
trap cleanup EXIT

command -v dpkg-deb >/dev/null 2>&1 || {
  echo "Error: dpkg-deb is required to build the package." >&2
  exit 1
}

mkdir -p "$ROOT/DEBIAN" "$ROOT/usr/share/$PACKAGE" "$ROOT/usr/bin"

cp -R bin config demo gnome-extension templates README.md LICENSE install.sh \
  "$ROOT/usr/share/$PACKAGE/"

cat > "$ROOT/usr/bin/cava-bar-install" <<'EOF'
#!/bin/sh
exec /usr/share/cava-bar-theme/install.sh "$@"
EOF
chmod 755 "$ROOT/usr/bin/cava-bar-install"

cat > "$ROOT/DEBIAN/control" <<EOF
Package: $PACKAGE
Version: $VERSION
Section: sound
Priority: optional
Architecture: $ARCH
Maintainer: cava-bar-theme contributors
Depends: bash, python3, python3-gi, python3-gi-cairo, gir1.2-gtk-4.0, cava, jq, libnotify-bin, ffmpeg, pulseaudio-utils, playerctl
Suggests: imagemagick, mpvpaper, matugen
Description: Wayland audio visualizer and automatic wallpaper theme
 Cava Bar Theme displays an audio visualizer, changes wallpapers and generates
 application colours from the current wallpaper. It supports layer-shell
 compositors and includes a GNOME Shell extension for GNOME 45+.
EOF

mkdir -p "$OUTPUT_DIR"
dpkg-deb --build --root-owner-group "$ROOT" "$OUTPUT_DIR/${PACKAGE}_${VERSION}_${ARCH}.deb" >/dev/null
echo "Built $OUTPUT_DIR/${PACKAGE}_${VERSION}_${ARCH}.deb"
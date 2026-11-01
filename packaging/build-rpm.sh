#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PACKAGE="cava-bar-theme"
VERSION="${VERSION:-1.0.0}"
OUTPUT_DIR="${OUTPUT_DIR:-dist}"
BUILD_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$BUILD_DIR"
}
trap cleanup EXIT

command -v rpmbuild >/dev/null 2>&1 || {
  echo "Error: rpmbuild is required to build the package." >&2
  echo "Debian/Ubuntu/Pop!_OS: sudo apt install rpm" >&2
  echo "Fedora: sudo dnf install rpm-build rpmdevtools" >&2
  exit 1
}

./packaging/build-tarball.sh
mkdir -p "$BUILD_DIR"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}
cp "$OUTPUT_DIR/${PACKAGE}-${VERSION}.tar.gz" "$BUILD_DIR/SOURCES/"
cp packaging/cava-bar-theme.spec "$BUILD_DIR/SPECS/"

rpmbuild -ba packaging/cava-bar-theme.spec \
  --define "_topdir $BUILD_DIR" \
  --define "_sourcedir $BUILD_DIR/SOURCES" \
  --define "_rpmdir $BUILD_DIR/RPMS" \
  --define "_srcrpmdir $BUILD_DIR/SRPMS" \
  --define "version $VERSION" >/dev/null

mkdir -p "$OUTPUT_DIR"
find "$BUILD_DIR/RPMS" -type f -name '*.rpm' -exec cp {} "$OUTPUT_DIR/" \;
echo "Built RPM package(s) in $OUTPUT_DIR"
#!/usr/bin/env bash
# Usage: ./install.sh [--autostart] | ./install.sh --uninstall
set -e
cd "$(dirname "$0")"

BIN=~/.local/bin
APPS=~/.local/share/applications
AUTO=~/.config/autostart
PROGS=(cava-bar cava-nowplaying cava-bar-settings next-wallpaper)
GNOME_EXTENSION_ID=cava-bar@local
GNOME_EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$GNOME_EXTENSION_ID"

is_gnome_session() {
  [[ "${XDG_CURRENT_DESKTOP,,}:${XDG_SESSION_DESKTOP,,}" == *gnome* ]]
}

if [[ $1 == --uninstall ]]; then
  for p in "${PROGS[@]}"; do rm -f "$BIN/$p"; done
  rm -f $APPS/cava-bar-settings.desktop \
        $AUTO/cava-bar.desktop $AUTO/cava-nowplaying.desktop $AUTO/cava-bar-wallpaper.desktop
  if command -v gnome-extensions >/dev/null 2>&1; then
    gnome-extensions disable "$GNOME_EXTENSION_ID" >/dev/null 2>&1 || true
  fi
  rm -rf "$GNOME_EXTENSION_DIR"
  echo "Removed. Config files in ~/.config/cava-bar* remain (delete manually if you want)."
  exit 0
fi

mkdir -p $BIN $APPS ~/.config/cava-bar ~/.config/cava-bar-theme \
         ~/.config/matugen/templates ~/Pictures/Wallpapers

if [[ -d gnome-extension ]]; then
  mkdir -p "$GNOME_EXTENSION_DIR"
  cp -R gnome-extension/. "$GNOME_EXTENSION_DIR/"
  if [[ -d "$GNOME_EXTENSION_DIR/schemas" ]] && command -v glib-compile-schemas >/dev/null 2>&1; then
    glib-compile-schemas "$GNOME_EXTENSION_DIR/schemas"
  fi
fi

copy_new() { [[ -e $2 ]] || cp "$1" "$2"; }   # do not overwrite existing files

# Install only the programs that exist in bin/ (next-wallpaper may be missing)
for p in "${PROGS[@]}"; do
  if [[ -f bin/$p ]]; then
    install -m755 "bin/$p" "$BIN/$p"
  else
    echo "Warning: bin/$p does not exist, ignored."
  fi
done

copy_new config/cava.conf             ~/.config/cava-bar/config
copy_new config/style.conf.example    ~/.config/cava-bar/style.conf
copy_new config/settings.conf.example ~/.config/cava-bar-theme/config
copy_new config/matugen.toml          ~/.config/matugen/config.toml
for t in templates/*; do copy_new "$t" ~/.config/matugen/templates/"$(basename "$t")"; done

# Old configs: ensure new keys exist
grep -q '^show_audio_status' ~/.config/cava-bar-theme/config || echo 'show_audio_status=true' >> ~/.config/cava-bar-theme/config

cat > $APPS/cava-bar-settings.desktop <<DESK
[Desktop Entry]
Type=Application
Name=Cava Bar Theme
Comment=Viewer settings, the «Now playing» widget and the automatic theme
Exec=$HOME/.local/bin/cava-bar-settings
Icon=preferences-desktop-wallpaper
Categories=Settings;GTK;
Terminal=false
DESK

if [[ $1 == --autostart ]]; then
  mkdir -p $AUTO
  if is_gnome_session; then
    rm -f "$AUTO/cava-bar.desktop" "$AUTO/cava-nowplaying.desktop"
    if command -v gnome-extensions >/dev/null 2>&1; then
      gnome-extensions enable "$GNOME_EXTENSION_ID" >/dev/null 2>&1 || \
        echo "Warning: enable '$GNOME_EXTENSION_ID' from GNOME Extensions."
    else
      echo "GNOME detected: enable '$GNOME_EXTENSION_ID' from GNOME Extensions."
    fi
  else
    printf '[Desktop Entry]\nType=Application\nName=cava-bar\nExec=%s/.local/bin/cava-bar\nX-GNOME-Autostart-Delay=3\n' "$HOME" > $AUTO/cava-bar.desktop
    printf '[Desktop Entry]\nType=Application\nName=cava-nowplaying\nExec=%s/.local/bin/cava-nowplaying\nX-GNOME-Autostart-Delay=3\n' "$HOME" > $AUTO/cava-nowplaying.desktop
  fi
  if [[ -f bin/next-wallpaper ]]; then
    printf '[Desktop Entry]\nType=Application\nName=cava-bar wallpaper\nExec=%s/.local/bin/next-wallpaper restore\nX-GNOME-Autostart-Delay=3\n' "$HOME" > $AUTO/cava-bar-wallpaper.desktop
  fi
  if is_gnome_session; then
    echo "Automatic startup created (GNOME extension and wallpaper)."
  else
    echo "Automatic startup created (cava-bar, cava-nowplaying and wallpaper)."
  fi
fi

for cmd in cava matugen jq pactl playerctl; do
  command -v "$cmd" >/dev/null || echo "Warning: '$cmd' not found (see README)."
done
python3 -c "import gi" 2>/dev/null || echo "Warning: python3-gi not found."
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) echo "Warning: ~/.local/bin not in PATH." ;; esac

echo
echo "Installed."
echo "  1. Put wallpapers in ~/Pictures/Wallpapers"
echo "  2. Open the settings:  cava-bar-settings   (or search for 'Cava Bar Theme' in apps)"
echo "  3. Test:               cava-bar &  cava-nowplaying &  next-wallpaper"

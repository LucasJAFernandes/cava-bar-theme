# cava-bar-theme

An on‑screen audio visualizer built with [cava](https://github.com/karlstav/cava) and an automatic theme: a key changes the wallpaper (image, GIF or video) and the system and viewer colours adjust themselves. A settings window lets you configure everything without editing files.

![demo](demo/Kooha-2026-10-29-15-48-33.gif)

> **Requirements:** a Wayland environment with `layer-shell` support (COSMIC, Hyprland, Sway, river...), or GNOME Shell 45+ with the included GNOME extension. The settings window and wallpaper/theme switching work on any environment.

## What it includes

| File | Purpose |
|---|---|
| `bin/cava-bar` | Visualizer. Appears when there is sound and hides after a few seconds of silence. 5 styles, gradient, height and number of bars configurable. |
| `bin/next-wallpaper` | Next/previous/random. Applies the wallpaper (including GIFs and videos), generates the theme with matugen and updates the visualizer colour. |
| `bin/cava-nowplaying` | «Now playing» widget in the top‑right corner (cover, title, artist, progress). Uses `playerctl`, the colour from `style.conf` and appears only when music is playing. |
| `bin/cava-bar-settings` | GTK4 settings window. |
| `gnome-extension/` | GNOME Shell visualizer and «Now playing» overlay. |

The parts communicate only through text files, so you can use just the visualizer if you prefer.

### Where the configuration files live

| File | Controls | Applies |
|---|---|---|
| `~/.config/cava-bar/style.conf` | visualizer appearance (style, colours, gradient, opacity, gap, silence, height, bars) | **All seconds**, except `height` and `bars` (only after restarting `cava-bar`). This is the file the settings window edits. |
| `~/.config/cava-bar-theme/config` | wallpaper, colour, animation, backend, themes, autostart | **All changes** apply live (as `next-wallpaper` re-reads the file). |
| `~/.config/cava-bar/config` | base cava configuration (number of bars, framerate, input) | **All seconds** (the `cava-bar` recreates the cava config file each second, applying the `bars` from `style.conf`). |
| `~/.config/matugen/config.toml` | app templates and CSS module | Each time the theme is applied (`next-wallpaper` / Settings → Apply theme now). |
| `~/.config/matugen/templates/*` | app template files (kitty.conf, colors.css) | Each time a theme is applied. |

- The settings window (`cava-bar-settings`) edits `style.conf` and `config` **live**: the visualizer rereads the file every second, so almost everything applies without restart.
- `height` and `bars` in `style.conf` only apply after a **restart** of `cava-bar` (the **Restart visualizer** button in the settings window does this).
- You can edit these files directly in `~/.config` if you want; `install.sh` never overwrites them (uses copy‑new).

## How to use

The parts communicate only through text files, so you can use just the visualizer if you prefer.

## Installation

### 1. Dependencies (Ubuntu / Pop!_OS)

```bash
sudo apt install cava imagemagick jq libnotify-bin wev ffmpeg pulseaudio-utils playerctl \\
  python3-gi python3-gi-cairo python3-cairo gir1.2-gtk-4.0
sudo apt install cargo && cargo install matugen
echo 'export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"' >> ~/.profile
```

### 2. gtk4-layer-shell (only for the visualizer outside GNOME)

If your distribution does not provide the package, compile it:

```bash
sudo apt install git build-essential meson ninja-build pkg-config \\
  libgtk-4-dev libwayland-dev wayland-protocols \\
  gobject-introspection libgirepository1.0-dev

git clone https://github.com/wmww/gtk4-layer-shell.git
cd gtk4-layer-shell
meson setup build -Dexamples=false -Ddocs=false -Dtests=false
ninja -C build && sudo ninja -C build install && sudo ldconfig
```

### 3. mpvpaper (optional, for animating GIFs and videos)

```bash
sudo apt install git meson ninja-build pkg-config libmpv-dev libwayland-dev \\
  wayland-protocols libegl-dev
git clone --single-branch https://github.com/GhostNaN/mpvpaper
cd mpvpaper
meson setup build --prefix=/usr/local
ninja -C build && sudo ninja -C build install
```

> mpvpaper is built for wlroots‑based compositors. COSMIC implements the same `layer-shell` protocol, but combining with `cosmic-bg` can vary. If animation does not appear, choose "Only the first frame" in the settings.

### 4. Install the project

```bash
./install.sh --autostart
```

Copies the binaries to `~/.local/bin`, creates the configuration files (without overwriting existing ones), adds an entry to the app menu, and with `--autostart` creates desktop autostart entries for the visualizer, the «Now playing» widget and the wallpaper in `~/.config/autostart`. On Hyprland/Sway, add equivalent `exec-once`/`exec` entries manually if your compositor does not process XDG autostart. To remove: `./install.sh --uninstall`.

### Debian package

Release packages can be built with:

```bash
./packaging/build-deb.sh
sudo apt install ./dist/cava-bar-theme_1.0.0_all.deb
cava-bar-install --autostart
```

The package installs the project under `/usr/share/cava-bar-theme`; `cava-bar-install` then creates the per-user configuration, autostart entries and GNOME extension without changing existing configuration files.

### RPM-based distributions

Build an RPM with `rpmbuild`:

```bash
./packaging/build-rpm.sh
sudo dnf install ./dist/cava-bar-theme-1.0.0-1.*.rpm
cava-bar-install --autostart
```

### Arch Linux

Create the source archive first, place it beside `packaging/PKGBUILD`, then build with `makepkg`:

```bash
./packaging/build-tarball.sh
cp dist/cava-bar-theme-1.0.0.tar.gz .
makepkg -p packaging/PKGBUILD
sudo pacman -U ./cava-bar-theme-1.0.0-1-any.pkg.tar.zst
cava-bar-install --autostart
```

### AppImage installer

The AppImage is a portable installer, not a fully self-contained replacement for GTK, PyGObject, cava and layer-shell system libraries. Build it with `appimagetool` and run it on a system with the documented dependencies:

```bash
./packaging/build-appimage.sh
./dist/cava-bar-theme-1.0.0-$(uname -m).AppImage
```

It installs the project for the current user, just like `install.sh --autostart`.

### Portable archive

For distributions without `.deb` support, build and extract the portable archive:

```bash
./packaging/build-tarball.sh
tar -xf dist/cava-bar-theme-1.0.0.tar.gz
cd cava-bar-theme-1.0.0
./install.sh --autostart
```

### GNOME Shell

On GNOME Shell 45 or newer, `./install.sh --autostart` installs the `cava-bar@local` extension and enables it when `gnome-extensions` is available. The extension draws the visualizer and the «Now playing» overlay directly in GNOME Shell, so `gtk4-layer-shell` is not required. If it was not enabled automatically, open the Extensions app or run:

```bash
gnome-extensions enable cava-bar@local
```

The GNOME extension reads the same `~/.config/cava-bar/style.conf` and `~/.config/cava-bar-theme/config` files. It uses `cava`, `pactl`, `playerctl` and the selected `player` setting. Its «Now playing» overlay shows the title, artist and progress; album artwork remains available in the GTK widget used by compositors with `layer-shell` support. The standalone `cava-bar` and `cava-nowplaying` programs remain intended for those compositors.

## How to use

The parts communicate only through text files, so you can use just the visualizer if you prefer.

## Binding the Copilot key

The key usually sends Super+Shift+F23. Confirm with `wev`.

- **COSMIC:** Settings → Keyboard → Custom shortcuts, command `~/.local/bin/next-wallpaper`, assign to the key.
- **Hyprland:**
  ```bash
  bind = SUPER SHIFT, F23, exec, ~/.local/bin/next-wallpaper
  bind = SUPER SHIFT CTRL, F23, exec, ~/.local/bin/next-wallpaper prev
  exec-once = ~/.local/bin/cava-bar
  exec-once = ~/.local/bin/cava-nowplaying
  exec-once = ~/.local/bin/next-wallpaper restore
  ```
- **Sway:**
  ```bash
  bindsym Mod4+Shift+F23 exec ~/.local/bin/next-wallpaper
  bindsym Mod4+Shift+Ctrl+F23 exec ~/.local/bin/next-wallpaper prev
  exec ~/.local/bin/cava-bar
  exec ~/.local/bin/cava-nowplaying
  ```

### Command line

```bash
next-wallpaper            # next (or random if order=random)
next-wallpaper prev       # previous (always in the order of names)
next-wallpaper random     # a random one
next-wallpaper restore    # reapply the current one (use on startup; does not generate theme)
next-wallpaper reapply    # reapply the current one and generate the theme again
```

### `~/.config/cava-bar/style.conf` (visualizer)

| Key | Values | Notes |
|---|---|---|
| `style` | `rounded` `bars` `wave` `line` `dots` | |
| `color`, `color2` | `#RRGGBB` | `color2` only counts when `gradient=true` |
| `gradient` | `true` / `false` | gradient from bottom (colour) to top (colour2) |
| `opacity` | `0.1`–`1.0` | |
| `gap` | `0`–`20` | gap between bars |
| `silence` | seconds | hides after this time of silence |
| `height` | `20`–`1000` | needs restart |
| `bars` | `4`–`512` | needs restart |

### `~/.config/cava-bar-theme/config` (wallpaper and theme)

| Key | Values | Default |
|---|---|---|
| `wallpaper_dir` | path | `~/Pictures/Wallpapers` |
| `order` | `sequential` / `random` | `sequential` |
| `mode` | `dark` / `light` | `dark` |
| `theme` | `on` / `off` | `on` |
| `color_mode` | `auto` / `fixed` / `music` | `auto` | In `auto`, the system theme now follows the colour of the bars. |
| `contrast` | `high` / `low` | `high` | Forces high contrast between the bars and the wallpaper. If the wallpaper is very dark or very light, it inverts or reduces the colour of the bars so they are always visible. `fixed` ignores this option. |
| `animated` | `mpvpaper` / `frame` | `mpvpaper` |
| `pause_on_battery` | `true` / `false` | `true` |
| `backend` | `auto` `cosmic` `swww` `swaybg` `hyprpaper` `gnome` `none` | `auto` |
| `disabled_templates` | comma-separated names | empty |
| `show_audio_status` | `true` / `false` | `true` | Shows or hides the «Now playing» (`cava-nowplaying`). Applies live. |
| `player` | player name | empty | Fixes a MPRIS player (`spotify`, `firefox`...). Empty = any. List with `playerctl -l`. |

## Tematizing the apps

Matugen only changes apps that have a template. Each template is a file with variables like `{{colors.primary.default.hex}}`, registered in `~/.config/matugen/config.toml`. Two examples are included:

- **kitty:** adds `include colors.conf` to `kitty.conf`.
- **css:** generates `~/.config/cava-bar-theme/colors.css` with the colours as variables. It is `@import`'d from waybar, GTK, etc.

To add another app, create a template in `~/.config/matugen/templates/`, add a `[templates.name]` block to the `config.toml` of matugen, and it appears in the **Theme** tab.

## Common problems

- **The visualizer does not appear:** outside GNOME, run `cava-bar` in a terminal and check for missing `gtk4-layer-shell` or an environment without `layer-shell`. On GNOME, check `gnome-extensions list`, enable `cava-bar@local`, and confirm that `cava` and `pactl` are installed. It only appears when there is sound.
- **The colour does not change:** `matugen image x.jpg --json hex --dry-run | jq` shows the JSON. Without matugen, the average colour of the image is used.
- **The wallpaper does not change in COSMIC:** it compares `~/.config/cosmic/com.system76.CosmicBackground/v1/all` with what COSMIC writes when you change from Settings. The format can vary between versions.
- **The GIF does not animate:** confirm `mpvpaper` is installed (`command -v mpvpaper`) and "GIF and videos" is set to "Animate".
- **Manual restart:** `pkill -f 'cava-bar$'; cava-bar &` (the `$` avoids killing the settings window). The same for `cava-nowplaying`.
- **The «Now playing» widget does not appear:** confirm `playerctl` is installed and `playerctl metadata` returns something with music playing. If you have `player=` set, it must be a name from `playerctl -l`.

## Structure

```
cava-bar-theme/
├── bin/            cava-bar, cava-nowplaying, next-wallpaper, cava-bar-settings
├── config/         cava.conf, style.conf.example, settings.conf.example, matugen.toml
├── templates/      kitty.conf, colors.css
├── gnome-extension/ GNOME Shell extension
├── packaging/      Debian, RPM, Arch, AppImage and archive builders
├── demo/           demo GIF
├── install.sh
├── LICENSE
└── README.md
```

## License

MIT. Wallpapers are not included; use images you have the right to use.

## How the colour works

The `cava-bar` draws with the colours defined in `style.conf` (`color` and `color2`).
`next-wallpaper` calculates these colours from the wallpaper (with `matugen`, or the average colour if `matugen` is unavailable).

By default, the colour of the bars is **always readable** relative to the wallpaper:
- if the calculated colour is dark (luminance < 128), the RGB channels are inverted;
- if it is light, it is slightly desaturated.

This way a black wallpaper generates white bars (not black), and a light wallpaper generates dark bars. If you prefer to keep the original colour of the wallpaper, set `contrast=low` in `~/.config/cava-bar-theme/config`.

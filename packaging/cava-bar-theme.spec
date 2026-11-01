Name:           cava-bar-theme
Version:        1.0.0
Release:        1%{?dist}
Summary:        Wayland audio visualizer and automatic wallpaper theme
License:        MIT
Source0:        %{name}-%{version}.tar.gz
BuildArch:      noarch

Requires:       bash
Requires:       python3
Requires:       python3-gobject
Requires:       gtk4
Requires:       cava
Requires:       jq
Requires:       libnotify
Requires:       ffmpeg
Requires:       pulseaudio-utils
Requires:       playerctl
Suggests:       ImageMagick

%description
Cava Bar Theme displays an audio visualizer, changes wallpapers and generates
application colours from the current wallpaper. It supports layer-shell
compositors and includes a GNOME Shell extension for GNOME 45+.

%prep
%autosetup

%build

%install
install -d %{buildroot}%{_datadir}/cava-bar-theme
cp -a bin config demo gnome-extension templates README.md LICENSE install.sh \
  %{buildroot}%{_datadir}/cava-bar-theme/
install -d %{buildroot}%{_bindir}
cat > %{buildroot}%{_bindir}/cava-bar-install <<'EOF'
#!/bin/sh
exec /usr/share/cava-bar-theme/install.sh "$@"
EOF
chmod 755 %{buildroot}%{_bindir}/cava-bar-install

%files
%license LICENSE
%doc README.md
%{_bindir}/cava-bar-install
%{_datadir}/cava-bar-theme

%changelog
* Sun Nov 01 2026 cava-bar-theme contributors - 1.0.0-1
- Initial package
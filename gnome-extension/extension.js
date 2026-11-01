import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const STYLE_FILE = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'cava-bar', 'style.conf']);
const CAVA_CONFIG = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'cava-bar', 'config']);
const THEME_CONFIG = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'cava-bar-theme', 'config']);
const TEMP_CONFIG = GLib.build_filenamev([GLib.get_tmp_dir(), `cava-bar-gnome-${GLib.get_user_name()}.conf`]);

const DEFAULT_STYLE = {
    style: 'rounded', color: '#FF0000', color2: '#FF0000', gradient: 'false',
    opacity: '0.85', gap: '4', height: '180', bars: '64', silence: '2',
};

function readKeyValue(path, defaults = {}) {
    const data = {...defaults};
    try {
        const [ok, bytes] = GLib.file_get_contents(path);
        if (!ok)
            return data;
        const text = new TextDecoder().decode(bytes);
        for (const line of text.split('\n')) {
            const value = line.trim();
            if (!value || value.startsWith('#') || !value.includes('='))
                continue;
            const [key, ...parts] = value.split('=');
            data[key.trim()] = parts.join('=').trim().replace(/^"|"$/g, '');
        }
    } catch (error) {
        logError(error, `Could not read ${path}`);
    }
    return data;
}

function numberSetting(settings, key, fallback, min, max) {
    const value = Number.parseFloat(settings[key] ?? fallback);
    if (!Number.isFinite(value))
        return fallback;
    return Math.min(max, Math.max(min, value));
}

function boolSetting(settings, key, fallback = false) {
    return ['1', 'true', 'on', 'yes'].includes(String(settings[key] ?? fallback).toLowerCase());
}

function colorSetting(value, fallback) {
    const match = String(value ?? '').trim().match(/^#?([0-9a-f]{6})$/i);
    if (!match)
        return fallback;
    return [
        Number.parseInt(match[1].slice(0, 2), 16) / 255,
        Number.parseInt(match[1].slice(2, 4), 16) / 255,
        Number.parseInt(match[1].slice(4, 6), 16) / 255,
    ];
}

function buildCavaConfig(bars, source) {
    let text = '';
    try {
        const [ok, bytes] = GLib.file_get_contents(CAVA_CONFIG);
        if (ok)
            text = new TextDecoder().decode(bytes);
    } catch (error) {
        logError(error, `Could not read ${CAVA_CONFIG}`);
    }
    if (!text)
        text = '[general]\nframerate = 60\n\n[output]\nmethod = raw\nraw_target = /dev/stdout\ndata_format = ascii\nascii_max_range = 100\nbar_delimiter = 59\nframe_delimiter = 10\n';

    text = text.replace(/^\s*bars\s*=.*$/gim, '');
    if (/^\[general\]\s*$/im.test(text))
        text = text.replace(/^\[general\]\s*$/im, `[general]\nbars = ${bars}`);
    else
        text = `[general]\nbars = ${bars}\n${text}`;
    if (source)
        text += `\n[input]\nmethod = pulse\nsource = ${source}\n`;
    return text;
}

function monitorSource() {
    try {
        const [ok, stdout] = GLib.spawn_command_line_sync('pactl list short sources');
        if (!ok)
            return null;
        const text = new TextDecoder().decode(stdout);
        const line = text.split('\n').find(value => value.includes('.monitor'));
        return line?.split('\t')[1] ?? null;
    } catch (error) {
        logError(error, 'Could not detect a PulseAudio/PipeWire monitor');
        return null;
    }
}

export default class CavaBarExtension extends Extension {
    enable() {
        this._values = [];
        this._lastSound = 0;
        this._styleMtime = 0;
        this._cava = null;
        this._lineReader = null;
        this._monitorSignal = Main.layoutManager.connect('monitors-changed', () => this._position());
        this._styleTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._reloadStyle();
            this._pollNowPlaying();
            return GLib.SOURCE_CONTINUE;
        });
        this._createNowPlaying();
        this._reloadStyle();
    }

    disable() {
        if (this._styleTimer) {
            GLib.source_remove(this._styleTimer);
            this._styleTimer = 0;
        }
        if (this._monitorSignal) {
            Main.layoutManager.disconnect(this._monitorSignal);
            this._monitorSignal = 0;
        }
        this._stopCava();
        this._area?.destroy();
        this._area = null;
        this._nowPlayingProcess?.force_exit();
        this._nowPlayingProcess = null;
        this._nowPlaying?.destroy();
        this._nowPlaying = null;
        try {
            GLib.unlink(TEMP_CONFIG);
        } catch (_) {
            // The temporary file may not exist yet.
        }
    }

    _reloadStyle() {
        let mtime = 0;
        try {
            mtime = GLib.file_test(STYLE_FILE, GLib.FileTest.EXISTS) ? GLib.get_real_time() : 0;
        } catch (_) {
            mtime = 0;
        }
        const settings = readKeyValue(STYLE_FILE, DEFAULT_STYLE);
        const next = {
            style: settings.style,
            color: colorSetting(settings.color, [1, 0, 0]),
            color2: colorSetting(settings.color2, colorSetting(settings.color, [1, 0, 0])),
            gradient: boolSetting(settings, 'gradient'),
            opacity: numberSetting(settings, 'opacity', 0.85, 0, 1),
            gap: numberSetting(settings, 'gap', 4, 0, 100),
            height: numberSetting(settings, 'height', 180, 20, 1000),
            bars: numberSetting(settings, 'bars', 64, 4, 512),
            silence: numberSetting(settings, 'silence', 2, 0.2, 120),
        };
        const changed = !this._settings || JSON.stringify(this._settings) !== JSON.stringify(next);
        this._settings = next;
        if (changed) {
            this._ensureArea();
            this._area.queue_repaint();
            this._restartCava();
        }
        this._styleMtime = mtime;
    }

    _ensureArea() {
        if (!this._area) {
            this._area = new St.DrawingArea({reactive: false});
            this._area.connect('repaint', area => this._paint(area));
            Main.layoutManager.addChrome(this._area, {trackFullscreen: false});
        }
        this._area.set_size(Main.layoutManager.primaryMonitor?.width ?? 1920, this._settings.height);
        this._position();
    }

    _position() {
        if (!this._area || !this._settings)
            return;
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return;
        this._area.set_size(monitor.width, this._settings.height);
        this._area.set_position(monitor.x, monitor.y + monitor.height - this._settings.height);
        if (this._nowPlaying) {
            this._nowPlaying.set_position(monitor.x + monitor.width - 304, monitor.y + 50);
            this._nowPlaying.set_size(280, -1);
        }
    }

    _paint(area) {
        const cr = area.get_context();
        const [width, height] = area.get_surface_size();
        const values = this._values;
        if (!values.length)
            return;
        const settings = this._settings;
        const barWidth = width / values.length;
        const [r, g, b] = settings.color;
        const [r2, g2, b2] = settings.color2;
        const alpha = settings.opacity;
        if (settings.gradient) {
            const gradient = cr.createLinearGradient(0, height, 0, 0);
            gradient.addColorStopRGBA(0, r, g, b, alpha);
            gradient.addColorStopRGBA(1, r2, g2, b2, alpha);
            cr.setSource(gradient);
        } else {
            cr.setSourceRGBA(r, g, b, alpha);
        }
        if (settings.style === 'line' || settings.style === 'wave') {
            const points = values.map((value, index) => [
                (index + 0.5) * barWidth,
                height - Math.max(2, value / 100 * height * 0.95),
            ]);
            if (points.length < 2)
                return;
            cr.moveTo(...points[0]);
            for (const point of points.slice(1))
                cr.lineTo(...point);
            if (settings.style === 'wave') {
                cr.lineTo(width, height);
                cr.lineTo(0, height);
                cr.closePath();
                cr.setSourceRGBA(r, g, b, alpha * 0.35);
                cr.fillPreserve();
                cr.setSourceRGBA(r, g, b, alpha);
            }
            cr.setLineWidth(3);
            cr.stroke();
            return;
        }
        for (const [index, value] of values.entries()) {
            const barHeight = Math.max(2, value / 100 * height);
            const gap = settings.gap;
            const x = index * barWidth + gap / 2;
            const w = Math.max(1, barWidth - gap);
            if (settings.style === 'dots') {
                const size = Math.max(4, w);
                const step = size + gap;
                const count = Math.max(1, Math.floor(value / 100 * height / step));
                for (let dot = 0; dot < count; dot++) {
                    cr.arc(x + w / 2, height - size / 2 - dot * step, size / 2, 0, 2 * Math.PI);
                    cr.fill();
                }
            } else if (settings.style === 'rounded') {
                const radius = Math.min(w / 2, barHeight / 2);
                cr.arc(x + radius, height - barHeight + radius, radius, Math.PI, 1.5 * Math.PI);
                cr.arc(x + w - radius, height - barHeight + radius, radius, 1.5 * Math.PI, 2 * Math.PI);
                cr.arc(x + w - radius, height - radius, radius, 0, 0.5 * Math.PI);
                cr.arc(x + radius, height - radius, radius, 0.5 * Math.PI, Math.PI);
                cr.closePath();
                cr.fill();
            } else {
                cr.rectangle(x, height - barHeight, w, barHeight);
                cr.fill();
            }
        }
    }

    _restartCava() {
        this._stopCava();
        const source = monitorSource();
        const config = buildCavaConfig(Math.round(this._settings.bars), source);
        try {
            GLib.file_set_contents(TEMP_CONFIG, config);
            this._cava = Gio.Subprocess.new(
                ['cava', '-p', TEMP_CONFIG],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE,
            );
            this._lineReader = new Gio.DataInputStream({base_stream: this._cava.get_stdout_pipe()});
            this._readLine();
        } catch (error) {
            logError(error, 'Could not start cava for the GNOME extension');
        }
    }

    _readLine() {
        if (!this._lineReader)
            return;
        this._lineReader.read_line_async(GLib.PRIORITY_DEFAULT, null, (stream, result) => {
            try {
                const [line] = stream.read_line_finish_utf8(result);
                if (!line) {
                    this._readLine();
                    return;
                }
                const values = line.split(';').filter(Boolean).map(Number).filter(Number.isFinite);
                if (values.length) {
                    this._values = values;
                    this._lastSound = GLib.get_monotonic_time() / 1e6;
                    this._area?.queue_repaint();
                }
                this._readLine();
            } catch (error) {
                logError(error, 'Could not read cava output');
            }
        });
    }

    _stopCava() {
        this._lineReader = null;
        if (this._cava) {
            this._cava.force_exit();
            this._cava = null;
        }
        this._values = [];
    }

    _createNowPlaying() {
        this._nowPlaying = new St.BoxLayout({vertical: true, reactive: false});
        this._nowPlaying.set_style('padding: 10px; background-color: rgba(0, 0, 0, 0.45); border-radius: 12px;');
        this._nowPlayingTitle = new St.Label({text: ''});
        this._nowPlayingTitle.set_style('color: white; font-weight: bold; font-size: 16px;');
        this._nowPlayingArtist = new St.Label({text: ''});
        this._nowPlayingArtist.set_style('color: rgba(255,255,255,0.85); font-size: 13px;');
        this._nowPlayingProgress = new St.ProgressBar();
        this._nowPlayingProgress.set_style('margin-top: 8px;');
        this._nowPlaying.add_child(this._nowPlayingTitle);
        this._nowPlaying.add_child(this._nowPlayingArtist);
        this._nowPlaying.add_child(this._nowPlayingProgress);
        this._nowPlaying.visible = false;
        Main.layoutManager.addChrome(this._nowPlaying, {trackFullscreen: false});
        this._position();
    }

    _pollNowPlaying() {
        if (!this._nowPlaying || this._nowPlayingProcess)
            return;
        const settings = readKeyValue(THEME_CONFIG, {show_audio_status: 'true', player: ''});
        if (!boolSetting(settings, 'show_audio_status', true)) {
            this._nowPlaying.visible = false;
            return;
        }
        try {
            const format = '{{status}}|||{{title}}|||{{artist}}|||{{mpris:length}}|||{{position}}';
            const player = String(settings.player ?? '').trim();
            const command = ['playerctl'];
            if (player)
                command.push('-p', player);
            command.push('metadata', '--format', format);
            this._nowPlayingProcess = Gio.Subprocess.new(
                command,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE,
            );
            this._nowPlayingProcess.communicate_utf8_async(null, null, (process, result) => {
                this._nowPlayingProcess = null;
                try {
                    const [, stdout] = process.communicate_utf8_finish(result);
                    this._updateNowPlaying(stdout.trim());
                } catch (_) {
                    this._updateNowPlaying('');
                }
            });
        } catch (_) {
            this._updateNowPlaying('');
        }
    }

    _updateNowPlaying(value) {
        const parts = value.split('|||');
        if (parts.length < 5 || parts[0] !== 'Playing' || !parts[1]) {
            this._nowPlaying.visible = false;
            return;
        }
        const length = Number.parseFloat(parts[3]) / 1000000;
        const position = Number.parseFloat(parts[4]) / 1000000;
        this._nowPlayingTitle.set_text(parts[1]);
        this._nowPlayingArtist.set_text(parts[2] || '');
        this._nowPlayingProgress.set_value(Number.isFinite(length) && length > 0 ? Math.min(1, position / length) : 0);
        this._nowPlaying.visible = true;
    }
}
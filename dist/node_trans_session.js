"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeTransSession = void 0;
const fs_1 = __importDefault(require("fs"));
const node_core_logger_1 = require("./node_core_logger");
const node_ffmpeg_session_1 = require("./node_ffmpeg_session");
const dateformat_1 = __importDefault(require("dateformat"));
const mkdirp = require('mkdirp');
const isHlsFile = (filename) => filename.endsWith('.ts') || filename.endsWith('.m3u8');
const isTemFiles = (filename) => filename.endsWith('.tmp');
const isDashFile = (filename) => filename.endsWith('.mpd') || filename.endsWith('.m4s');
class NodeTransSession extends node_ffmpeg_session_1.NodeFfmpegSession {
    constructor(conf) {
        super(conf, '127.0.0.1', 'trans');
    }
    run() {
        const vc = this.getConfig('vc') || 'copy';
        const ac = this.getConfig('ac') || 'copy';
        const isRtmp = this.getConfig('rtmp');
        const isMp4 = this.getConfig('mp4');
        const isHls = this.getConfig('hls');
        const isDash = this.getConfig('dash');
        const streamApp = this.getConfig('streamApp');
        const streamPath = this.getConfig('streamPath');
        const streamName = this.getConfig('streamName');
        const mediaroot = this.getConfig('mediaroot');
        const rtmpPort = this.getConfig('rtmpPort') || '1935';
        const inPath = `rtmp://${this.remoteIp}:${rtmpPort}${streamPath}`;
        const ouPath = `${mediaroot}/${streamApp}/${streamName}`;
        let mapStr = '';
        if (isRtmp) {
            const rtmpApp = this.getConfig('rtmpApp');
            if (rtmpApp) {
                if (rtmpApp === streamApp) {
                    node_core_logger_1.Logger.error('[Transmuxing RTMP] Cannot output to the same app.');
                }
                else {
                    let rtmpOutput = `rtmp://127.0.0.1:${rtmpPort}/${rtmpApp}/${streamName}`;
                    mapStr += `[f=flv]${rtmpOutput}|`;
                    node_core_logger_1.Logger.log(`[Transmuxing RTMP] ${streamPath} to ${rtmpOutput}`);
                }
            }
        }
        if (isMp4) {
            const mp4Flags = this.getConfig('mp4Flags') || '';
            let mp4FileName = (0, dateformat_1.default)('yyyy-mm-dd-HH-MM-ss') + '.mp4';
            let mapMp4 = `${mp4Flags}${ouPath}/${mp4FileName}|`;
            mapStr += mapMp4;
            node_core_logger_1.Logger.log(`[Transmuxing MP4] ${streamPath} to ${ouPath}/${mp4FileName}`);
        }
        if (isHls) {
            const hlsFlags = this.getConfig('hlsFlags') || '';
            let hlsFileName = 'index.m3u8';
            let mapHls = `${hlsFlags}${ouPath}/${hlsFileName}|`;
            mapStr += mapHls;
            node_core_logger_1.Logger.log(`[Transmuxing HLS] ${streamPath} to ${ouPath}/${hlsFileName}`);
        }
        if (isDash) {
            const dashFlags = this.getConfig('dashFlags');
            let dashFileName = 'index.mpd';
            let mapDash = `${dashFlags}${ouPath}/${dashFileName}`;
            mapStr += mapDash;
            node_core_logger_1.Logger.log(`[Transmuxing DASH] ${streamPath} to ${ouPath}/${dashFileName}`);
        }
        mkdirp.sync(ouPath);
        const vcParam = this.getConfig('vcParam');
        const acParam = this.getConfig('acParam');
        let argv = [
            '-y',
            '-i', inPath,
            '-c:v', vc,
            ...(vcParam || []),
            '-c:a', ac,
            ...(acParam || []),
            '-f', 'tee',
            '-map', '0:a?', '-map', '0:v?',
            mapStr
        ];
        let self = this;
        this.on('end', (id) => {
            self.cleanTempFiles(ouPath);
            self.deleteHlsFiles(ouPath);
        });
        node_core_logger_1.Logger.log('[trans]', `id=${this.id}`, 'cmd=ffmpeg', argv.join(' '));
        super.run(argv);
    }
    end() {
        this.ffmpeg_exec.kill();
    }
    deleteHlsFiles(ouPath) {
        if ((!ouPath && !this.getConfig('hls')) || this.getConfig('hlsKeep'))
            return;
        fs_1.default.readdir(ouPath, function (err, files) {
            if (err)
                return;
            files.filter((filename) => isHlsFile(filename)).forEach((filename) => {
                fs_1.default.unlinkSync(`${ouPath}/${filename}`);
            });
        });
    }
    cleanTempFiles(ouPath) {
        if (!ouPath)
            return;
        let self = this;
        fs_1.default.readdir(ouPath, function (err, files) {
            if (err)
                return;
            if (self.getConfig('dashKeep')) {
                files.filter((filename) => isTemFiles(filename)).forEach((filename) => {
                    fs_1.default.unlinkSync(`${ouPath}/${filename}`);
                });
            }
            else {
                files.filter((filename) => isTemFiles(filename) || isDashFile(filename)).forEach((filename) => {
                    fs_1.default.unlinkSync(`${ouPath}/${filename}`);
                });
            }
        });
    }
}
exports.NodeTransSession = NodeTransSession;

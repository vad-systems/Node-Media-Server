import dateFormat from 'dateformat';
import fs, { PathLike } from 'fs';
import { Logger } from './core/index.js';
import { NodeFfmpegSession } from './node_ffmpeg_session.js';
import { TransSessionConfig } from './types.js';
import * as mkdirp from 'mkdirp';

const isHlsFile = (filename: string) => filename.endsWith('.ts') || filename.endsWith('.m3u8');
const isTemFiles = (filename: string) => filename.endsWith('.tmp');
const isDashFile = (filename: string) => filename.endsWith('.mpd') || filename.endsWith('.m4s');

class NodeTransSession extends NodeFfmpegSession<object, TransSessionConfig> {
    constructor(conf: TransSessionConfig) {
        super(conf, '127.0.0.1', 'trans');
    }

    run() {
        const vc: string = this.getConfig('vc') || 'copy';
        const ac: string = this.getConfig('ac') || 'copy';

        const isRtmp: boolean = this.getConfig('rtmp');
        const isMp4: boolean = this.getConfig('mp4');
        const isHls: boolean = this.getConfig('hls');
        const isDash: boolean = this.getConfig('dash');

        const streamApp: string = this.getConfig('streamApp');
        const streamPath: string = this.getConfig('streamPath');
        const streamName: string = this.getConfig('streamName');
        const mediaroot: PathLike = this.getConfig('mediaroot');

        const rtmpPort = this.getConfig('rtmpPort') || '1935';
        const inPath = `rtmp://${this.remoteIp}:${rtmpPort}${streamPath}`;
        const ouPath = `${mediaroot}/${streamApp}/${streamName}`;
        let mapStr = '';

        if (isRtmp) {
            const rtmpApp = this.getConfig('rtmpApp');

            if (rtmpApp) {
                if (rtmpApp === streamApp) {
                    Logger.error('[Transmuxing RTMP] Cannot output to the same app.');
                } else {
                    let rtmpOutput = `rtmp://127.0.0.1:${rtmpPort}/${rtmpApp}/${streamName}`;
                    mapStr += `[f=flv]${rtmpOutput}|`;
                    Logger.log(`[Transmuxing RTMP] ${streamPath} to ${rtmpOutput}`);
                }
            }
        }

        if (isMp4) {
            const mp4Flags = this.getConfig('mp4Flags') || '';
            let mp4FileName = dateFormat('yyyy-mm-dd-HH-MM-ss') + '.mp4';
            let mapMp4 = `${mp4Flags}${ouPath}/${mp4FileName}|`;
            mapStr += mapMp4;
            Logger.log(`[Transmuxing MP4] ${streamPath} to ${ouPath}/${mp4FileName}`);
        }

        if (isHls) {
            const hlsFlags = this.getConfig('hlsFlags') || '';
            let hlsFileName = 'index.m3u8';
            let mapHls = `${hlsFlags}${ouPath}/${hlsFileName}|`;
            mapStr += mapHls;
            Logger.log(`[Transmuxing HLS] ${streamPath} to ${ouPath}/${hlsFileName}`);
        }

        if (isDash) {
            const dashFlags = this.getConfig('dashFlags');
            let dashFileName = 'index.mpd';
            let mapDash = `${dashFlags}${ouPath}/${dashFileName}`;
            mapStr += mapDash;
            Logger.log(`[Transmuxing DASH] ${streamPath} to ${ouPath}/${dashFileName}`);
        }

        mkdirp.sync(ouPath);

        const vcParam = this.getConfig('vcParam') as string[];
        const acParam = this.getConfig('acParam') as string[];
        let argv = [
            '-y',
            '-i', inPath,
            '-c:v', vc,
            ...(
                vcParam || []
            ),
            '-c:a', ac,
            ...(
                acParam || []
            ),
            '-f', 'tee',
            '-map', '0:a?', '-map', '0:v?',
            mapStr,
        ];

        let self = this;
        this.on('end', (id) => {
            Logger.log('[trans]', `id=${id}`, 'end');
            self.cleanTempFiles(ouPath);
            self.deleteHlsFiles(ouPath);
        });

        Logger.log('[trans]', `id=${this.id}`, 'cmd=ffmpeg', argv.join(' '));
        super.run(argv);
    }

    end() {
        this.ffmpeg_exec.kill();
    }

    deleteHlsFiles(ouPath: PathLike) {
        if ((
            !ouPath && !this.getConfig('hls')
        ) || this.getConfig('hlsKeep')) {
            return;
        }

        fs.readdir(ouPath, function (err, files) {
            if (err) {
                return;
            }
            files.filter((filename) => isHlsFile(filename)).forEach((filename) => {
                fs.unlinkSync(`${ouPath}/${filename}`);
            });
        });
    }

    cleanTempFiles(ouPath: PathLike) {
        if (!ouPath) {
            return;
        }
        let self = this;
        fs.readdir(ouPath, function (err, files) {
            if (err) {
                return;
            }
            if (self.getConfig('dashKeep')) {
                files.filter((filename) => isTemFiles(filename)).forEach((filename) => {
                    fs.unlinkSync(`${ouPath}/${filename}`);
                });
            } else {
                files.filter((filename) => isTemFiles(filename) || isDashFile(filename)).forEach((filename) => {
                    fs.unlinkSync(`${ouPath}/${filename}`);
                });
            }
        });
    }
}

export { NodeTransSession };

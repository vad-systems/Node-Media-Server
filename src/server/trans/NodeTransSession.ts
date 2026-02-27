import dateFormat from 'dateformat';
import fs, { PathLike } from 'fs';
import * as mkdirp from 'mkdirp';
import { TransSessionConfig } from '../../types/index.js';
import { NodeFfmpegSession } from '../NodeFfmpegSession.js';

const isHlsFile = (filename: string) => filename.endsWith('.ts') || filename.endsWith('.m3u8');
const isTempFiles = (filename: string) => filename.endsWith('.tmp');
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

        const rtmpPort = this.getConfig<number | string>('rtmpPort') || '1935';
        const inPath = this.getRtmpInputPath(rtmpPort, streamPath);
        const ouPath = `${mediaroot}/${streamApp}/${streamName}`;
        let mapStr = '';

        if (isRtmp) {
            const rtmpApp = this.getConfig('rtmpApp');

            if (rtmpApp) {
                if (rtmpApp === streamApp) {
                    this.logger.error('[Transmuxing RTMP] Cannot output to the same app.');
                } else {
                    let rtmpOutput = `rtmp://127.0.0.1:${rtmpPort}/${rtmpApp}/${streamName}`;
                    mapStr += `[f=flv]${rtmpOutput}|`;
                    this.logger.log(`[Transmuxing RTMP] ${streamPath} to ${rtmpOutput}`);
                }
            }
        }

        if (isMp4) {
            const mp4Flags = this.getConfig('mp4Flags') || '';
            let mp4FileName = dateFormat('yyyy-mm-dd-HH-MM-ss') + '.mp4';
            let mapMp4 = `${mp4Flags}${ouPath}/${mp4FileName}|`;
            mapStr += mapMp4;
            this.logger.log(`[Transmuxing MP4] ${streamPath} to ${ouPath}/${mp4FileName}`);
        }

        if (isHls) {
            const hlsFlags = this.getConfig('hlsFlags') || '';
            let hlsFileName = 'index.m3u8';
            let mapHls = `${hlsFlags}${ouPath}/${hlsFileName}|`;
            mapStr += mapHls;
            this.logger.log(`[Transmuxing HLS] ${streamPath} to ${ouPath}/${hlsFileName}`);
        }

        if (isDash) {
            const dashFlags = this.getConfig('dashFlags');
            let dashFileName = 'index.mpd';
            let mapDash = `${dashFlags}${ouPath}/${dashFileName}`;
            mapStr += mapDash;
            this.logger.log(`[Transmuxing DASH] ${streamPath} to ${ouPath}/${dashFileName}`);
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
            this.logger.log('end');
            self.cleanTempFiles(ouPath);
            self.deleteHlsFiles(ouPath);
        });

        this.logger.log('cmd=ffmpeg', argv.join(' '));
        super.run(argv);
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
                files.filter((filename) => isTempFiles(filename)).forEach((filename) => {
                    fs.unlinkSync(`${ouPath}/${filename}`);
                });
            } else {
                files.filter((filename) => isTempFiles(filename) || isDashFile(filename)).forEach((filename) => {
                    fs.unlinkSync(`${ouPath}/${filename}`);
                });
            }
        });
    }
}

export { NodeTransSession };

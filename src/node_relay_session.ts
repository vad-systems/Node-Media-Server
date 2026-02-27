import { Logger } from './core/index.js';
import { NodeFfmpegSession } from './node_ffmpeg_session.js';
import { RelaySessionConfig, RtspTransport } from './types.js';

class NodeRelaySession extends NodeFfmpegSession<never, RelaySessionConfig> {
    ts = null;

    constructor(conf: RelaySessionConfig) {
        super(conf, '127.0.0.1', 'relay');
        this.ts = Date.now() / 1000 | 0;
    }

    run() {
        let format = this.conf.ouPath.startsWith('rtsp://') ? 'rtsp' : 'flv';
        let argv = [
            '-re',
            '-i', this.conf.inPath,
            '-c:v', 'h264',
            '-c:a', 'copy',
            ...(
                this.conf.rescale ? ['-vf', `scale=${this.conf.rescale}`] : []
            ),
            '-f', format,
            this.conf.ouPath,
        ];

        if (this.conf.inPath[0] === '/' || this.conf.inPath[1] === ':') {
            argv.unshift('-1');
            argv.unshift('-stream_loop');
        }

        if (this.conf.inPath.startsWith('rtsp://') && this.conf.rtsp_transport) {
            if (Object.values(RtspTransport).indexOf(this.conf.rtsp_transport) > -1) {
                argv.unshift(this.conf.rtsp_transport);
                argv.unshift('-rtsp_transport');
            }
        }

        Logger.log('[relay]', `id=${this.id}`, 'cmd=ffmpeg', argv.join(' '));
        super.run(argv);
    }
}

export { NodeRelaySession };

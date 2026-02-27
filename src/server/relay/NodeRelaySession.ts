import { RelaySessionConfig, RtspTransport } from '../../types/index.js';
import { NodeFfmpegSession } from '../NodeFfmpegSession.js';

class NodeRelaySession extends NodeFfmpegSession<never, RelaySessionConfig> {
    constructor(conf: RelaySessionConfig) {
        super(conf, '127.0.0.1', 'relay');
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

        this.logger.log('cmd=ffmpeg', argv.join(' '));
        super.run(argv);
    }
}

export { NodeRelaySession };

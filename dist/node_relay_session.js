"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeRelaySession = void 0;
const node_ffmpeg_session_1 = require("./node_ffmpeg_session");
const node_core_logger_1 = require("./node_core_logger");
const types_1 = require("./types");
class NodeRelaySession extends node_ffmpeg_session_1.NodeFfmpegSession {
    constructor(conf) {
        super(conf, '127.0.0.1', 'relay');
        this.ts = null;
        this.ts = Date.now() / 1000 | 0;
    }
    run() {
        let format = this.conf.ouPath.startsWith('rtsp://') ? 'rtsp' : 'flv';
        let argv = [
            '-re',
            '-i', this.conf.inPath,
            '-c:v', 'h264',
            '-c:a', 'copy',
            ...(this.conf.rescale ? ['-vf', `scale=${this.conf.rescale}`] : []),
            '-f', format,
            this.conf.ouPath
        ];
        if (this.conf.inPath[0] === '/' || this.conf.inPath[1] === ':') {
            argv.unshift('-1');
            argv.unshift('-stream_loop');
        }
        if (this.conf.inPath.startsWith('rtsp://') && this.conf.rtsp_transport) {
            if (Object.values(types_1.RtspTransport).indexOf(this.conf.rtsp_transport) > -1) {
                argv.unshift(this.conf.rtsp_transport);
                argv.unshift('-rtsp_transport');
            }
        }
        node_core_logger_1.Logger.log('[relay]', `id=${this.id}`, 'cmd=ffmpeg', argv.join(' '));
        super.run(argv);
    }
}
exports.NodeRelaySession = NodeRelaySession;

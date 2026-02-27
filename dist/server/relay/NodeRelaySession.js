"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeRelaySession = void 0;
const index_js_1 = require("../../types/index.js");
const NodeFfmpegSession_js_1 = require("../NodeFfmpegSession.js");
class NodeRelaySession extends NodeFfmpegSession_js_1.NodeFfmpegSession {
    constructor(conf) {
        super(conf, '127.0.0.1', 'relay');
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
            this.conf.ouPath,
        ];
        if (this.conf.inPath[0] === '/' || this.conf.inPath[1] === ':') {
            argv.unshift('-1');
            argv.unshift('-stream_loop');
        }
        if (this.conf.inPath.startsWith('rtsp://') && this.conf.rtsp_transport) {
            if (Object.values(index_js_1.RtspTransport).indexOf(this.conf.rtsp_transport) > -1) {
                argv.unshift(this.conf.rtsp_transport);
                argv.unshift('-rtsp_transport');
            }
        }
        this.logger.debug('cmd=ffmpeg', argv.join(' '));
        super.run(argv);
    }
}
exports.NodeRelaySession = NodeRelaySession;

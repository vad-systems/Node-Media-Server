"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeRelaySession = void 0;
const nms_shared_1 = require("../../shared");
const nms_server_1 = require("../../server");
class NodeRelaySession extends nms_server_1.NodeFfmpegSession {
    constructor(conf) {
        super(conf, '127.0.0.1', 'relay');
    }
    run() {
        let format = this.conf.ouPath.startsWith('rtsp://') ? 'rtsp' : 'flv';
        let ouPath = this.conf.ouPath;
        if (ouPath.startsWith('rtmp://127.0.0.1') || ouPath.startsWith('rtmp://localhost')) {
            ouPath += (ouPath.includes('?') ? '&' : '?') + `parentId=${this.id}`;
        }
        let argv = [
            '-re',
            '-i', this.conf.inPath,
            '-c:v', 'h264',
            '-c:a', 'copy',
            ...(this.conf.rescale ? ['-vf', `scale=${this.conf.rescale}`] : []),
            '-f', format,
            ouPath,
        ];
        if (this.conf.inPath[0] === '/' || this.conf.inPath[1] === ':') {
            argv.unshift('-1');
            argv.unshift('-stream_loop');
        }
        if (this.conf.inPath.startsWith('rtsp://') && this.conf.rtsp_transport) {
            if (Object.values(nms_shared_1.RtspTransport).indexOf(this.conf.rtsp_transport) > -1) {
                argv.unshift(this.conf.rtsp_transport);
                argv.unshift('-rtsp_transport');
            }
        }
        this.logger.debug('cmd=ffmpeg', argv.join(' '));
        super.run(argv);
    }
}
exports.NodeRelaySession = NodeRelaySession;

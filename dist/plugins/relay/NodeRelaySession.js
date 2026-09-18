"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeRelaySession = void 0;
const nms_shared_1 = require("../../shared");
const nms_server_1 = require("../../server");
class NodeRelaySession extends nms_server_1.NodeFfmpegSession {
    constructor(conf) {
        super(conf, '127.0.0.1', 'relay');
    }
    start(...args) {
        let format = this.conf.ouPath.startsWith('rtsp://') ? 'rtsp' : 'flv';
        let ouPath = this.conf.ouPath;
        if (ouPath.startsWith('rtmp://127.0.0.1') || ouPath.startsWith('rtmp://localhost')) {
            ouPath += (ouPath.includes('?') ? '&' : '?') + `parentId=${this.id}`;
        }
        const vc = this.conf.vc;
        const isVaapi = vc === 'h264_vaapi';
        const vaapiDevice = this.conf.vaapi_device || this.conf.vaapiDevice || '/dev/dri/renderD128';
        let vcodecArgs = [];
        if (isVaapi) {
            vcodecArgs = [
                '-c:v',
                'h264_vaapi',
                '-force_key_frames',
                'expr:gte(t,n_forced*2)',
                ...(this.conf.rescale ? ['-vf', `scale_vaapi=${this.conf.rescale.replace('x', ':')}`] : []),
                ...(this.conf.vcParam || []),
            ];
        }
        else if (this.conf.rescale) {
            vcodecArgs = [
                '-c:v',
                vc || 'libx264',
                '-force_key_frames',
                'expr:gte(t,n_forced*2)',
                '-vf',
                `scale=${this.conf.rescale}`,
                ...(this.conf.vcParam || []),
            ];
        }
        else if (vc) {
            vcodecArgs = [
                '-c:v',
                vc,
                ...(this.conf.vcParam || []),
            ];
        }
        else {
            vcodecArgs = ['-c:v', 'copy'];
        }
        let argv = [
            ...(isVaapi ? ['-hwaccel', 'vaapi', '-hwaccel_device', vaapiDevice, '-hwaccel_output_format', 'vaapi'] : []),
            '-re',
            '-i', this.conf.inPath,
            ...vcodecArgs,
            '-c:a', this.conf.ac || 'copy',
            ...(this.conf.acParam || []),
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
        this.logger.debug(`[Relay] ffmpeg cmd: ${argv.join(' ')}`);
        super.start(argv);
    }
}
exports.NodeRelaySession = NodeRelaySession;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeStaticSession = void 0;
const NodeFfmpegSession_js_1 = require("../../server/base/NodeFfmpegSession.js");
class NodeStaticSession extends NodeFfmpegSession_js_1.NodeFfmpegSession {
    constructor(conf) {
        super(conf, '127.0.0.1', 'Static');
        this.streamPath = conf.streamPath;
        this.streamApp = conf.app;
        this.streamName = conf.name;
    }
    run() {
        const port = this.conf.rtmpPort || 1935;
        const outPath = `rtmp://127.0.0.1:${port}${this.streamPath}`;
        const isVaapi = this.conf.vc === 'h264_vaapi';
        const vaapiDevice = this.conf.vaapi_device || this.conf.vaapiDevice || '/dev/dri/renderD128';
        let vf = 'scale=1920:1080';
        if (this.conf.textPath) {
            vf += `,drawtext=textfile=${this.conf.textPath}:fontcolor=white:y=850-(text_h/2):x=(w-text_w)/2:fontsize=36:line_spacing=10:reload=60`;
        }
        if (isVaapi) {
            vf += ',format=nv12,hwupload';
        }
        const argv = [
            ...(isVaapi ? ['-vaapi_device', vaapiDevice] : []),
            '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
            '-loop', '1', '-re', '-i', this.conf.input,
            '-force_key_frames', 'expr:gte(t,n_forced*2)',
            '-c:v', this.conf.vc || 'libx264',
            ...(this.conf.vcParam || []),
            '-r', '25',
            ...(isVaapi ? [] : ['-pix_fmt', 'yuv420p']),
            '-vf', vf,
            '-c:a', 'aac',
            '-f', 'flv',
            outPath,
        ];
        this.start(argv);
    }
}
exports.NodeStaticSession = NodeStaticSession;

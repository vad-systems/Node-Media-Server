"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeFissionSession = void 0;
const node_ffmpeg_session_1 = require("./node_ffmpeg_session");
const node_core_logger_1 = require("./node_core_logger");
class NodeFissionSession extends node_ffmpeg_session_1.NodeFfmpegSession {
    constructor(conf) {
        super(conf, '127.0.0.1', 'fission');
    }
    run() {
        let inPath = `rtmp://${this.remoteIp}:${this.conf.rtmpPort}${this.conf.streamPath}`;
        let argv = ['-i', inPath];
        for (let m of this.conf.model) {
            let x264 = ['-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-maxrate', m.vb, '-bufsize', m.vb, '-g', (parseInt(m.vf) * 2).toString(), '-r', m.vf, '-s', m.vs];
            let aac = ['-c:a', 'aac', '-b:a', m.ab];
            let outPath = ['-f', 'flv', `rtmp://127.0.0.1:${this.conf.rtmpPort}/${this.conf.streamApp}/${this.conf.streamName}_${m.vs.split('x')[1]}`];
            argv = [
                ...argv,
                ...x264,
                ...aac,
                ...outPath,
            ];
        }
        node_core_logger_1.Logger.log('[fission]', `id=${this.id}`, 'cmd=ffmpeg', argv.join(' '));
        super.run(argv);
    }
}
exports.NodeFissionSession = NodeFissionSession;

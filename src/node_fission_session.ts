import {NodeFfmpegSession} from './node_ffmpeg_session';
import {Logger} from "./node_core_logger";
import {FissionSessionConfig} from "./types";

class NodeFissionSession extends NodeFfmpegSession<object, FissionSessionConfig> {
    constructor(conf: FissionSessionConfig) {
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

        Logger.log('[fission]', `id=${this.id}`, 'cmd=ffmpeg', argv.join(' '));
        super.run(argv);
    }
}

export { NodeFissionSession };

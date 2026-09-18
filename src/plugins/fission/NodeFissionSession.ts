import { FissionSessionConfig } from '@vad-systems/nms-shared';
import { NodeFfmpegSession } from '@vad-systems/nms-server';

class NodeFissionSession extends NodeFfmpegSession<object, FissionSessionConfig> {
    constructor(conf: FissionSessionConfig) {
        super(conf, '127.0.0.1', 'fission');
    }

    start(...args: any[]) {
        let inPath = this.getRtmpInputPath(this.conf.rtmpPort, this.conf.streamPath);
        let argv = ['-i', inPath];
        for (let m of this.conf.model) {
            const vc = m.vc || this.conf.vc || 'libx264';
            const vcParam = m.vcParam || this.conf.vcParam || (
                vc === 'libx264' ? ['-preset', 'veryfast', '-tune', 'zerolatency'] : []
            );
            const ac = m.ac || this.conf.ac || 'aac';
            const acParam = m.acParam || this.conf.acParam || ['-b:a', m.ab];

            let video = [
                '-c:v',
                vc,
                ...vcParam,
                '-maxrate',
                m.vb,
                '-bufsize',
                m.vb,
                '-g',
                (
                    parseInt(m.vf) * 2
                ).toString(),
                '-r',
                m.vf,
                '-s',
                m.vs,
            ];
            let audio = ['-c:a', ac, ...acParam];
            let outPathStr = `rtmp://127.0.0.1:${this.conf.rtmpPort}/${this.conf.streamApp}/${this.conf.streamName}_${m.vs.split('x')[1]}?parentId=${this.id}`;
            let outPath = [
                '-f',
                'flv',
                outPathStr,
            ];
            argv = [
                ...argv,
                ...video,
                ...audio,
                ...outPath,
            ];
        }

        this.logger.debug(`[Fission] ffmpeg cmd: ${argv.join(' ')}`);
        super.start(argv);
    }
}

export { NodeFissionSession };

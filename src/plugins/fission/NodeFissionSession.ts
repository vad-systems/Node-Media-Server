import { FissionSessionConfig } from '@vad-systems/nms-shared';
import { NodeFfmpegSession } from '@vad-systems/nms-server';

class NodeFissionSession extends NodeFfmpegSession<object, FissionSessionConfig> {
    constructor(conf: FissionSessionConfig) {
        super(conf, '127.0.0.1', 'fission');
    }

    start(...args: any[]) {
        const taskVc = this.conf.vc;
        const taskVcParam = this.conf.vcParam || [];
        const hasVaapi = this.conf.model.some((m) => (m.vc || taskVc) === 'h264_vaapi') || taskVc === 'h264_vaapi';
        const vaapiDevice = this.conf.vaapi_device || this.conf.vaapiDevice || '/dev/dri/renderD128';

        let inPath = this.getRtmpInputPath(this.conf.rtmpPort, this.conf.streamPath);
        let argv = [
            ...(hasVaapi ? ['-hwaccel', 'vaapi', '-hwaccel_device', vaapiDevice, '-hwaccel_output_format', 'vaapi'] : []),
            '-i', inPath,
        ];
        for (let m of this.conf.model) {
            const mVc = m.vc || taskVc || 'libx264';
            const isVaapi = mVc === 'h264_vaapi';
            const mVcParam = m.vcParam || taskVcParam;

            let vcodecArgs: string[] = [];
            if (isVaapi) {
                let vfStr = `scale_vaapi=${m.vs.replace('x', ':')}`;
                vcodecArgs = [
                    '-c:v',
                    'h264_vaapi',
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
                    '-vf',
                    vfStr,
                    ...mVcParam,
                ];
            } else {
                vcodecArgs = [
                    '-c:v',
                    mVc,
                    '-preset',
                    'veryfast',
                    '-tune',
                    'zerolatency',
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
                    ...mVcParam,
                ];
            }
            let aac = ['-c:a', 'aac', '-b:a', m.ab];
            let outPathStr = `rtmp://127.0.0.1:${this.conf.rtmpPort}/${this.conf.streamApp}/${this.conf.streamName}_${m.vs.split('x')[1]}?parentId=${this.id}`;
            let outPath = [
                '-f',
                'flv',
                outPathStr,
            ];
            argv = [
                ...argv,
                ...vcodecArgs,
                ...aac,
                ...outPath,
            ];
        }

        this.logger.debug(`[Fission] ffmpeg cmd: ${argv.join(' ')}`);
        super.start(argv);
    }
}

export { NodeFissionSession };

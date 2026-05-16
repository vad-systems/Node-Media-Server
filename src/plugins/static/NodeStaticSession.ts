import { NodeFfmpegSession } from '../../server/base/NodeFfmpegSession.js';
import { StaticSessionConfig } from '../../shared/types/config/static.js';

export class NodeStaticSession extends NodeFfmpegSession<never, StaticSessionConfig> {
    constructor(conf: StaticSessionConfig) {
        super(conf, '127.0.0.1', 'Static');
        this.streamPath = conf.streamPath;
        this.streamApp = conf.app;
        this.streamName = conf.name;
    }

    run() {
        const port = this.conf.rtmpPort || 1935;
        const outPath = `rtmp://127.0.0.1:${port}${this.streamPath}`;

        const argv = [
            '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
            '-loop', '1', '-re', '-i', this.conf.input,
            '-force_key_frames', '50',
            '-c:v', 'libx264',
            '-r', '25',
            '-pix_fmt', 'yuv420p',
        ];

        let vf = 'scale=1920:1080';
        if (this.conf.textPath) {
            vf += `,drawtext=textfile=${this.conf.textPath}:fontcolor=white:y=850-(text_h/2):x=(w-text_w)/2:fontsize=36:line_spacing=10:reload=60`;
        }
        argv.push('-vf', vf);

        argv.push(
            '-c:a', 'aac',
            '-f', 'flv',
            outPath
        );

        this.start(argv);
    }
}

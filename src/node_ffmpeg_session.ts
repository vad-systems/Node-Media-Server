import {FfmpegSessionConfig} from './types';
import {spawn, ChildProcess} from 'child_process';
import {NodeSession} from './node_session';
import {Logger} from './node_core_logger';

abstract class NodeFfmpegSession<A, T extends FfmpegSessionConfig<A>> extends NodeSession<A, T> {
    ffmpeg_exec: ChildProcess = null;

    protected constructor(conf: T, remoteIp: string, tag: string) {
        super(conf, remoteIp, tag);
    }

    run(argv: string[]) {
        let argumentList = argv.filter(Boolean);
        this.ffmpeg_exec = spawn(this.conf.ffmpeg, argumentList);
        this.ffmpeg_exec.on('error', (e: any) => {
            Logger.ffdebug(`[ffmpeg error] ${this.id}: ${e}`);
        });

        this.ffmpeg_exec.stdout.on('data', (data: any) => {
            Logger.ffdebug(`[ffmpeg stdout] ${this.id}: ${data}`);
        });

        this.ffmpeg_exec.stderr.on('data', (data: any) => {
            Logger.ffdebug(`[ffmpeg stderr] ${this.id}: ${data}`);
        });

        this.ffmpeg_exec.on('close', (code: any) => {
            Logger.log(`[ffmpeg end] ${this.id}`);
            this.emit('end', this.id);
        });
    }

    end() {
        this.ffmpeg_exec.kill();
    }

    stop() {
        this.end();
    }
}

export { NodeFfmpegSession };

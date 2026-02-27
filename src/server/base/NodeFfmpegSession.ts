import { ChildProcess, spawn } from 'child_process';
import { Buffer } from 'node:buffer';
import { context } from '@vad-systems/nms-core';
import { FfmpegSessionConfig } from '@vad-systems/nms-shared';
import { NodeSession } from './NodeSession.js';

abstract class NodeFfmpegSession<A, T extends FfmpegSessionConfig<A>> extends NodeSession<A, T> {
    private ffmpeg_exec: ChildProcess = null;

    protected constructor(conf: T, remoteIp: string, tag: string) {
        super(conf, remoteIp, tag);
    }

    public isFfmpegTask() {
        return true;
    }

    protected getRtmpInputPath(port: number | string, streamPath: string): string {
        return `rtmp://127.0.0.1:${port}${streamPath}`;
    }

    run(argv: string[]) {
        let argumentList = argv.filter(Boolean);
        this.ffmpeg_exec = spawn(this.conf.ffmpeg, argumentList);
        this.startTime = Date.now();
        context.idlePlayers.delete(this.id);
        this.ffmpeg_exec.on('error', (e: any) => {
            this.logger.ffdebug(`[ffmpeg error] ${e}`);
        });

        this.ffmpeg_exec.stdout.on('data', (data: any) => {
            this.logger.ffdebug(`[ffmpeg stdout] ${data}`);
        });

        this.ffmpeg_exec.stderr.on('data', (data: any) => {
            this.logger.ffdebug(`[ffmpeg stderr] ${data}`);
        });

        this.ffmpeg_exec.on('close', (code: any) => {
            this.logger.log(`[ffmpeg end]`);
            this.emit('end', this.id);
            context.nodeEvent.emit('doneConnect', this);
            this.cleanup();
        });
        context.nodeEvent.emit('postConnect', this);
    }

    end() {
        this.ffmpeg_exec.kill();
    }

    stop() {
        this.end();
    }

    public sendBuffer(buffer: Buffer) {
        this.outBytes += buffer.length;
    }
}

export { NodeFfmpegSession };

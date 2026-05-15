import { ChildProcess, spawn } from 'child_process';
import { Buffer } from 'node:buffer';
import { context } from '@vad-systems/nms-core';
import { AVPacket } from '@vad-systems/nms-protocol';
import { FfmpegSessionConfig, SessionState } from '@vad-systems/nms-shared';
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

    start(argv: string[]) {
        super.start();
        let argumentList = argv.filter(Boolean);
        this.ffmpeg_exec = spawn(this.conf.ffmpeg, argumentList);
        this.startTime = Date.now();
        this.state = SessionState.RUNNING;
        context.idlePlayers.delete(this.id);
        this.ffmpeg_exec.on('error', (e: any) => {
            this.logger.ffdebug(`[ffmpeg] error: ${e}`);
        });

        this.ffmpeg_exec.stdout.on('data', (data: any) => {
            this.logger.ffdebug(`[ffmpeg] stdout: ${data}`);
        });

        this.ffmpeg_exec.stderr.on('data', (data: any) => {
            this.logger.ffdebug(`[ffmpeg] stderr: ${data}`);
        });

        this.ffmpeg_exec.on('close', (code: any) => {
            this.logger.log(`[ffmpeg] closed: code=${code}`);
            this.ffmpeg_exec = null;
            this.emit('end', this.id);
            this.didStop();
            if (!this.isManualStop) {
                this.cleanup();
            }
        });
    }

    end() {
        this.logger.log(`[ffmpeg] kill SIGTERM: id=${this.id}`);
        if (this.ffmpeg_exec) {
            if (!this.ffmpeg_exec.kill("SIGTERM")) {
                this.logger.warn(`[ffmpeg] kill SIGKILL: id=${this.id}`);
                this.ffmpeg_exec.kill("SIGKILL");
            }
        } else {
            this.logger.warn(`[ffmpeg] already terminated or never started: id=${this.id}`);
            this.emit('end', this.id);
            this.didStop();
            if (!this.isManualStop) {
                this.cleanup();
            }
        }
    }

    stop(manual: boolean = false) {
        if (this.state === SessionState.STOPPED || this.state === SessionState.STOPPING) {
            return;
        }
        this.logger.log(`[ffmpeg] session stop: id=${this.id} manual=${manual}`);
        super.stop(manual);
        this.endTime = Date.now();
        this.end();
    }


    public sendBuffer(buffer: Buffer | AVPacket) {
        if (Buffer.isBuffer(buffer)) {
            this.outBytes += buffer.length;
        }
    }
}

export { NodeFfmpegSession };

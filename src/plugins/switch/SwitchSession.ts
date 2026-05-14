import { Buffer } from 'node:buffer';
import { AVPacket } from '@vad-systems/nms-protocol';
import { SwitchSessionConfig } from '@vad-systems/nms-shared';
import { BaseAvSession, Protocol } from '@vad-systems/nms-server';

export class SwitchSession extends BaseAvSession<any, SwitchSessionConfig> {
    constructor(conf: SwitchSessionConfig) {
        super(conf, '127.0.0.1', Protocol.RTMP);
        this.streamPath = conf.streamPath;
        this.streamApp = conf.app;
        this.streamName = conf.name;
        this.streamQuery = conf.args || {};
        this.isPublisher = true;
        this.isStop = true;
    }

    public stop() {
        this.isStop = true;
        this.onClose();
    }

    public sendBuffer(buffer: Buffer | AVPacket) {
        // Virtual session, nowhere to send
    }
}


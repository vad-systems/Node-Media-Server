import { Buffer } from 'node:buffer';
import { AVPacket } from '@vad-systems/nms-protocol';
import { SessionConfig } from '@vad-systems/nms-shared';
import { BaseAvSession, Protocol } from '@vad-systems/nms-server';

export class SwitchSession extends BaseAvSession<any, SessionConfig<any>> {
    constructor(conf: any, streamPath: string) {
        super(conf, '127.0.0.1', Protocol.RTMP);
        this.streamPath = streamPath;
        const regRes = /\/(.*)\/(.*)/gi.exec(streamPath);
        if (regRes) {
            this.streamApp = regRes[1];
            this.streamName = regRes[2];
        }
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


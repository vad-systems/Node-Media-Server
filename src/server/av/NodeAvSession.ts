import { ParsedUrlQuery } from 'node:querystring';
import WebSocket from 'ws';
import { context } from '@vad-systems/nms-core';
import { Flv } from '@vad-systems/nms-protocol';
import { AvSessionConfig } from '@vad-systems/nms-shared';
import { BaseAvSession, Protocol } from '@vad-systems/nms-server';

class NodeAvSession extends BaseAvSession<never, AvSessionConfig> {
    public req: any;
    public res: any;

    private flv: Flv;

    constructor(
        config: AvSessionConfig,
        remoteIp: string,
        protocol: Protocol,
        info?: {
            streamPath: string;
            streamQuery: ParsedUrlQuery;
            streamApp: string;
            streamName: string;
            streamHost: string;
            isPublisher: boolean;
        },
    ) {
        super(config, remoteIp, protocol);
        this.flv = new Flv();
        if (info) {
            this.streamPath = info.streamPath;
            this.streamQuery = info.streamQuery;
            this.streamApp = info.streamApp;
            this.streamName = info.streamName;
            this.streamHost = info.streamHost;
            this.isPublisher = info.isPublisher;
        }
    }

    setTransport(req: any, res: any) {
        this.req = req;
        this.res = res;
    }

    run = () => {
        if (this.res instanceof WebSocket) {
            this.res.on('message', this.onData);
            this.res.on('close', this.onClose);
            this.res.on('error', this.onError);
        } else {
            this.req.on('data', this.onData);
            this.req.on('error', this.onError);
            this.req.socket.on('close', this.onClose);
        }
        if (this.isPublisher) {
            this.onPush();
        } else {
            this.onPlay();
        }
        context.nodeEvent.emit('postConnect', this);
    };

    onPush() {
        super.onPush();
        this.flv.onPacketCallback = this.onPacket;
    }

    onData = (data: Buffer) => {
        this.inBytes += data.length;
        try {
            this.flv.parserData(data);
        } catch (err: any) {
            this.logger.warn(`${this.remoteIp} parserData error, ${err}`);
            this.stop();
        }
    };

    sendBuffer = (buffer: Buffer) => {
        if (this.res instanceof WebSocket) {
            if (this.res.readyState !== WebSocket.OPEN) {
                return;
            }
            this.res.send(buffer);
        } else {
            if (this.res.writableEnded) {
                return;
            }
            this.res.write(buffer);
        }
        this.outBytes += buffer.length;
    };

    stop = () => {
        if (this.res instanceof WebSocket) {
            this.res.close();
        } else {
            this.res.end();
        }
    };
}

export { NodeAvSession };

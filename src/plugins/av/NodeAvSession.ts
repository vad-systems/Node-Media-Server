import { ParsedUrlQuery } from 'node:querystring';
import WebSocket from 'ws';
import Http from 'http';
import express from 'express';
import { context } from '@vad-systems/nms-core';
import { AVPacket, Flv } from '@vad-systems/nms-protocol';
import { AvSessionConfig, SessionState } from '@vad-systems/nms-shared';
import { BaseAvSession, Protocol } from '@vad-systems/nms-server';

class NodeAvSession extends BaseAvSession<never, AvSessionConfig> {
    public req: Http.IncomingMessage | express.Request;
    public res: WebSocket | express.Response;

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

    setTransport(req: Http.IncomingMessage | express.Request, res: WebSocket | express.Response) {
        this.req = req;
        this.res = res;
    }

    start = () => {
        super.start();
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
            this.logger.warn(`[AV] parserData error: ${err} remoteIp=${this.remoteIp}`);
            this.stop();
        }
    };

    sendBuffer = (buffer: Buffer | AVPacket) => {
        if (!Buffer.isBuffer(buffer)) {
            return;
        }

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

    onClose = () => {
        if (this.state !== SessionState.STOPPED && this.state !== SessionState.STOPPING) {
            this.stop();
        }
        super.onClose();
    };

    stop = () => {
        if (this.state === SessionState.STOPPED || this.state === SessionState.STOPPING) {
            return;
        }
        super.stop();
        if (this.res instanceof WebSocket) {
            this.res.close();
        } else {
            (
                this.res as express.Response
            ).end();
        }
        this.didStop();
    };
}

export { NodeAvSession };

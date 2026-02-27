import url from 'url';
import WebSocket from 'ws';
import context from '../../core/context.js';
import logger from '../../core/logger.js';
import { HttpSessionConfig, NodeHttpRequest, NodeHttpResponse } from '../../types/index.js';
import BroadcastServer from '../BroadcastServer.js';
import { NodeAvSession, Protocol } from '../NodeAvSession.js';

class NodeHttpSession extends NodeAvSession<never, HttpSessionConfig> {
    public readonly req;
    public readonly res;

    private flv: any;

    private broadcast: BroadcastServer<HttpSessionConfig, NodeHttpSession>;
    private inBytes: number = 0;
    private outBytes: number = 0;
    private isPublisher: boolean;
    private streamApp: string;
    private streamName: string;
    private streamHost: string;

    constructor(config: HttpSessionConfig, req: NodeHttpRequest, res: NodeHttpResponse) {
        super(config, req.remoteAddress + ':' + req.remotePort, Protocol.FLV);

        this.req = req.req;
        this.res = res.res;

        if (this.res instanceof WebSocket) {
            const urlInfo = url.parse(this.req.url, true);
            this.streamHost = this.req.headers.host?.split(':')[0];
            this.streamPath = urlInfo.pathname.split('.')[0];
            this.streamApp = this.streamPath.split('/')[1];
            this.streamName = this.streamPath.split('/')[2];
            this.streamQuery = urlInfo.query;
            if (this.res.protocol.toLowerCase() === 'post' || this.res.protocol.toLowerCase() === 'publisher') {
                this.isPublisher = true;
            }
        } else {
            this.streamHost = this.req.hostname;
            this.streamApp = this.req.params.splat[0]; // TODO
            this.streamName = this.req.params.splat[1]; // TODO
            this.streamPath = '/' + this.streamApp + '/' + this.streamName;
            this.streamQuery = this.req.query;
            if (this.req.method === 'POST') {
                this.isPublisher = true;
            }
        }

        this.broadcast = context.broadcasts.get(this.streamPath) ?? new BroadcastServer();
        context.broadcasts.set(this.streamPath, this.broadcast);
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
    };

    onPlay = () => {
        const err = this.broadcast.postPlay(this);
        if (err != null) {
            logger.error(`FLV session ${this.id} ${this.remoteIp} play ${this.streamPath} error, ${err}`);
            this.stop();
            return;
        }
        this.isPublisher = false;
        logger.log(`FLV session ${this.id} ${this.remoteIp} start play ${this.streamPath}`);
    };

    onPush = () => {
        const err = this.broadcast.postPublish(this);
        if (err != null) {
            logger.error(`FLV session ${this.id} ${this.remoteIp} push ${this.streamPath} error, ${err}`);
            this.stop();
            return;
        }
        this.isPublisher = true;
        this.flv.onPacketCallback = this.onPacket;
        logger.log(`FLV session ${this.id} ${this.remoteIp} start push ${this.streamPath}`);
    };

    /**
     * @param {Buffer} data
     */
    onData = (data) => {
        this.inBytes += data.length;
        let err = this.flv.parserData(data);
        if (err != null) {
            logger.error(`FLV session ${this.id} ${this.remoteIp} parserData error, ${err}`);
            this.stop();
        }
    };

    onClose = () => {
        logger.log(`FLV session ${this.id} close`);
        if (this.isPublisher) {
            this.broadcast.donePublish(this);
        } else {
            this.broadcast.donePlay(this);
        }
        context.sessions.delete(this.id);
    };

    /**
     *
     * @param {string} err
     */
    onError = (err) => {
        logger.error(`FLV session ${this.id} ${this.remoteIp} socket error, ${err}`);
    };

    /**
     * @param {AVPacket} packet
     */
    onPacket = (packet) => {
        this.broadcast.broadcastMessage(packet);
    };

    /**
     * @override
     * @param {Buffer} buffer
     */
    sendBuffer = (buffer) => {
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

    /**
     * @override
     */
    stop = () => {
        if (this.res instanceof WebSocket) {
            this.res.close();
        } else {
            this.res.end();
        }
    };
}

export { NodeHttpSession };

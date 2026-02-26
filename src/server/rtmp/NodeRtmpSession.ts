import { Socket } from 'net';
import context from '../../core/context.js';
import logger from '../../core/logger.js';
import AVPacket from '../../core/protocol/AVPacket.js';
import Rtmp from '../../core/protocol/rtmp.js';
import { RtmpSessionConfig } from '../../types/index.js';
import BroadcastServer from '../BroadcastServer.js';
import { NodeAvSession, Protocol } from '../NodeAvSession.js';

class NodeRtmpSession extends NodeAvSession<never, RtmpSessionConfig> {
    public readonly socket: Socket;
    private rtmp: Rtmp;
    private broadcast: BroadcastServer<RtmpSessionConfig, NodeRtmpSession>;
    private streamApp: string;
    private streamName: string;
    private streamHost: string;
    private isPublisher: boolean;
    private inBytes: number = 0;
    private outBytes: number = 0;

    constructor(config: RtmpSessionConfig, socket: Socket) {
        super(config, socket.remoteAddress + ':' + socket.remotePort, Protocol.RTMP);
        this.socket = socket;
        this.rtmp = new Rtmp();
        this.broadcast = new BroadcastServer();
    }

    run = () => {
        this.rtmp.onConnectCallback = this.onConnect;
        this.rtmp.onPlayCallback = this.onPlay;
        this.rtmp.onPushCallback = this.onPush;
        this.rtmp.onOutputCallback = this.onOutput;
        this.rtmp.onPacketCallback = this.onPacket;
        this.socket.on('data', this.onData);
        this.socket.on('close', this.onClose);
        this.socket.on('error', this.onError);
    };

    onConnect = (req: { app: string, name: string, host: string, query: any }) => {
        this.streamApp = req.app;
        this.streamName = req.name;
        this.streamHost = req.host;
        this.streamPath = '/' + req.app + '/' + req.name;
        this.streamQuery = req.query;
        this.broadcast = context.broadcasts.get(this.streamPath) ?? new BroadcastServer();
        context.broadcasts.set(this.streamPath, this.broadcast);
    };

    onPlay = () => {
        const err = this.broadcast.postPlay(this);
        if (err != null) {
            logger.error(`RTMP session ${this.id} ${this.remoteIp} play ${this.streamPath} error, ${err}`);
            this.socket.end();
            return;
        }
        this.isPublisher = false;
        logger.log(`RTMP session ${this.id} ${this.remoteIp} start play ${this.streamPath}`);
    };

    onPush = () => {
        const err = this.broadcast.postPublish(this);
        if (err != null) {
            logger.error(`RTMP session ${this.id} ${this.remoteIp} push ${this.streamPath} error, ${err}`);
            this.socket.end();
            return;
        }
        this.isPublisher = true;
        logger.log(`RTMP session ${this.id} ${this.remoteIp} start push ${this.streamPath}`);
    };

    onOutput = (buffer: Buffer) => {
        this.socket.write(buffer);
    };

    /**
     *
     * @param {AVPacket} packet
     */
    onPacket = (packet: AVPacket) => {
        this.broadcast.broadcastMessage(packet);
    };

    onData = (data: Buffer) => {
        this.inBytes += data.length;
        let err = this.rtmp.parserData(data);
        if (err != null) {
            logger.error(`RTMP session ${this.id} ${this.remoteIp} parserData error, ${err}`);
            this.socket.end();
        }
    };

    onClose = () => {
        logger.log(`RTMP session ${this.id} close`);
        if (this.isPublisher) {
            this.broadcast.donePublish(this);
        } else {
            this.broadcast.donePlay(this);
        }
        context.sessions.delete(this.id);
    };

    onError = (error: Error) => {
        logger.log(`RTMP session ${this.id} socket error, ${error.name}: ${error.message}`);
    };

    sendBuffer = (buffer: Buffer) => {
        this.outBytes += buffer.length;
        this.socket.write(buffer);
    };

    stop = () => {
        this.socket.end();
    };
}

export { NodeRtmpSession };

import URL from 'url';
import {Logger} from './node_core_logger';
import context from './node_core_ctx';
import NodeCoreUtils from './node_core_utils';
import {NodeSession} from './node_session';
import {NodeRtmpSession} from './node_rtmp_session';
import {Arguments, HttpSessionConfig, NodeConnectionType, NodeHttpRequest, NodeHttpResponse} from "./types";

type FlvPayload = {
    length: number;
}

type FlvPacket<T extends FlvPayload> = {
    header: {
        length: number,
        timestamp: number,
        type: number,
    };
    payload: T;
}

function createFlvPacket<T extends FlvPayload>(payload: T = null, type: number = 0, timestamp: number = 0) {
    return {
        header: {
            length: payload ? payload.length : 0,
            timestamp,
            type,
        },
        payload,
    };
}

class NodeHttpSession extends NodeSession<never, HttpSessionConfig> {
    req;
    res;

    playStreamPath: string;
    playArgs: Arguments | null;

    isStarting = false;
    isPlaying = false;
    isIdling = false;

    connectCmdObj = null;
    connectTime = null;

    numPlayCache = 0;

    constructor(config: HttpSessionConfig, req: NodeHttpRequest, res: NodeHttpResponse) {
        super(
            config,
            req.remoteAddress,
            req.nmsConnectionType === NodeConnectionType.WS ? 'websocket-flv' : 'http-flv'
        );
        this.req = req.req;
        this.res = res.res;

        this.playStreamPath = '';
        this.playArgs = null;

        if (req.nmsConnectionType === 'ws') {
            this.res.cork = this.res._socket.cork.bind(this.res._socket);
            this.res.uncork = this.res._socket.uncork.bind(this.res._socket);
            this.res.on('close', this.onReqClose.bind(this));
            this.res.on('error', this.onReqError.bind(this));
            this.res.write = this.res.send;
            this.res.end = this.res.close;
        } else {
            this.res.cork = this.res.socket.cork.bind(this.res.socket);
            this.res.uncork = this.res.socket.uncork.bind(this.res.socket);
            this.req.socket.on('close', this.onReqClose.bind(this));
            this.req.on('error', this.onReqError.bind(this));
        }

        context.sessions.set(this.id, this);
    }

    run() {
        let method = this.req.method;
        let urlInfo = URL.parse(this.req.url, true);
        let streamPath = urlInfo.pathname.split('.')[0];
        this.connectCmdObj = {ip: this.remoteIp, method, streamPath, query: urlInfo.query};
        this.connectTime = new Date();
        this.isStarting = true;
        Logger.log(`[${this.TAG} connect] id=${this.id} remoteIp=${this.remoteIp} args=${JSON.stringify(urlInfo.query)}`);
        context.nodeEvent.emit('preConnect', this.id, this.connectCmdObj);

        if (!this.isStarting) {
            this.stop();
            return;
        }

        context.nodeEvent.emit('postConnect', this.id, this.connectCmdObj);

        if (method === 'GET') {
            this.playStreamPath = streamPath;
            this.playArgs = urlInfo.query;

            this.onPlay();
        } else {
            this.stop();
        }
    }

    stop() {
        if (this.isStarting) {
            this.isStarting = false;
            let publisherId = context.publishers.get(this.playStreamPath);
            if (publisherId != null) {
                const session = context.sessions.get(publisherId);
                if (session instanceof NodeRtmpSession) {
                    session.players.delete(this.id);
                }
                context.nodeEvent.emit('donePlay', this.id, this.playStreamPath, this.playArgs);
            }
            Logger.log(`[${this.TAG} play] Close stream. id=${this.id} streamPath=${this.playStreamPath}`);
            Logger.log(`[${this.TAG} disconnect] id=${this.id}`);
            context.nodeEvent.emit('doneConnect', this.id, this.connectCmdObj);
            this.res.end();
            context.idlePlayers.delete(this.id);
            context.sessions.delete(this.id);
        }
    }

    onReqClose() {
        this.stop();
    }

    onReqError(e) {
        this.stop();
    }

    reject() {
        Logger.log(`[${this.TAG} reject] id=${this.id}`);
        this.stop();
    }

    onPlay() {
        context.nodeEvent.emit('prePlay', this.id, this.playStreamPath, this.playArgs);

        if (!this.isStarting) {
            return;
        }

        if (this.conf.auth !== undefined && this.conf.auth.play) {
            let results = NodeCoreUtils.verifyAuth(this.playArgs.sign, this.playStreamPath, this.conf.auth.secret);
            if (!results) {
                Logger.log(`[${this.TAG} play] Unauthorized. id=${this.id} streamPath=${this.playStreamPath} sign=${this.playArgs.sign}`);
                this.res.statusCode = 403;
                this.res.end();
                return;
            }
        }

        if (!context.publishers.has(this.playStreamPath)) {
            Logger.log(`[${this.TAG} play] Stream not found. id=${this.id} streamPath=${this.playStreamPath} `);
            context.idlePlayers.add(this.id);
            this.isIdling = true;
            return;
        }

        this.onStartPlay();
    }

    onStartPlay() {
        let publisherId = context.publishers.get(this.playStreamPath);
        let publisher = context.sessions.get(publisherId);
        if (!(publisher instanceof NodeRtmpSession)) {
            return;
        }

        let players = publisher.players;
        players.add(this.id);

        //send FLV header
        let FLVHeader = Buffer.from([0x46, 0x4c, 0x56, 0x01, 0x00, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00, 0x00]);
        if (publisher.isFirstAudioReceived) {
            FLVHeader[4] |= 0b00000100;
        }

        if (publisher.isFirstVideoReceived) {
            FLVHeader[4] |= 0b00000001;
        }
        this.res.write(FLVHeader);

        //send Metadata
        if (publisher.metaData != null) {
            let packet = createFlvPacket(publisher.metaData, 18);
            let tag = NodeHttpSession.createFlvTag(packet);
            this.res.write(tag);
        }

        //send aacSequenceHeader
        if (publisher.audioCodec == 10) {
            let packet = createFlvPacket(publisher.aacSequenceHeader, 8);
            let tag = NodeHttpSession.createFlvTag(packet);
            this.res.write(tag);
        }

        //send avcSequenceHeader
        if (publisher.videoCodec == 7 || publisher.videoCodec == 12) {
            let packet = createFlvPacket(publisher.avcSequenceHeader, 9);
            let tag = NodeHttpSession.createFlvTag(packet);
            this.res.write(tag);
        }

        //send gop cache
        if (publisher.flvGopCacheQueue != null) {
            for (let tag of publisher.flvGopCacheQueue) {
                this.res.write(tag);
            }
        }

        this.isIdling = false;
        this.isPlaying = true;
        Logger.log(`[${this.TAG} play] Join stream. id=${this.id} streamPath=${this.playStreamPath}`);
        context.nodeEvent.emit('postPlay', this.id, this.playStreamPath, this.playArgs);
    }

    static createFlvTag(packet: FlvPacket<Buffer>) {
        let PreviousTagSize = 11 + packet.header.length;
        let tagBuffer = Buffer.alloc(PreviousTagSize + 4);
        tagBuffer[0] = packet.header.type;
        tagBuffer.writeUIntBE(packet.header.length, 1, 3);
        tagBuffer[4] = (packet.header.timestamp >> 16) & 0xff;
        tagBuffer[5] = (packet.header.timestamp >> 8) & 0xff;
        tagBuffer[6] = packet.header.timestamp & 0xff;
        tagBuffer[7] = (packet.header.timestamp >> 24) & 0xff;
        tagBuffer.writeUIntBE(0, 8, 3);
        tagBuffer.writeUInt32BE(PreviousTagSize, PreviousTagSize);
        packet.payload.copy(tagBuffer, 11, 0, packet.header.length);
        return tagBuffer;
    }
}

export { NodeHttpSession };

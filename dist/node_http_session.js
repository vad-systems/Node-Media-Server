"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeHttpSession = void 0;
const url_1 = __importDefault(require("url"));
const index_js_1 = require("./core/index.js");
const node_rtmp_session_js_1 = require("./node_rtmp_session.js");
const node_session_js_1 = require("./node_session.js");
const types_js_1 = require("./types.js");
function createFlvPacket(payload = null, type = 0, timestamp = 0) {
    return {
        header: {
            length: payload ? payload.length : 0,
            timestamp,
            type,
        },
        payload,
    };
}
class NodeHttpSession extends node_session_js_1.NodeSession {
    constructor(config, req, res) {
        super(config, req.remoteAddress, req.nmsConnectionType === types_js_1.NodeConnectionType.WS ? 'websocket-flv' : 'http-flv');
        this.isStarting = false;
        this.isPlaying = false;
        this.isIdling = false;
        this.connectCmdObj = null;
        this.connectTime = null;
        this.numPlayCache = 0;
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
        }
        else {
            this.res.cork = this.res.socket.cork.bind(this.res.socket);
            this.res.uncork = this.res.socket.uncork.bind(this.res.socket);
            this.req.socket.on('close', this.onReqClose.bind(this));
            this.req.on('error', this.onReqError.bind(this));
        }
        index_js_1.context.sessions.set(this.id, this);
    }
    run() {
        let method = this.req.method;
        let urlInfo = url_1.default.parse(this.req.url, true);
        let streamPath = urlInfo.pathname.split('.')[0];
        this.connectCmdObj = { ip: this.remoteIp, method, streamPath, query: urlInfo.query };
        this.connectTime = new Date();
        this.isStarting = true;
        index_js_1.Logger.log(`[${this.TAG} connect] id=${this.id} remoteIp=${this.remoteIp} args=${JSON.stringify(urlInfo.query)}`);
        index_js_1.context.nodeEvent.emit('preConnect', this.id, this.connectCmdObj);
        if (!this.isStarting) {
            this.stop();
            return;
        }
        index_js_1.context.nodeEvent.emit('postConnect', this.id, this.connectCmdObj);
        if (method === 'GET') {
            this.playStreamPath = streamPath;
            this.playArgs = urlInfo.query;
            this.onPlay();
        }
        else {
            this.stop();
        }
    }
    stop() {
        if (this.isStarting) {
            this.isStarting = false;
            let publisherId = index_js_1.context.publishers.get(this.playStreamPath);
            if (publisherId != null) {
                const session = index_js_1.context.sessions.get(publisherId);
                if (session instanceof node_rtmp_session_js_1.NodeRtmpSession) {
                    session.players.delete(this.id);
                }
                index_js_1.context.nodeEvent.emit('donePlay', this.id, this.playStreamPath, this.playArgs);
            }
            index_js_1.Logger.log(`[${this.TAG} play] Close stream. id=${this.id} streamPath=${this.playStreamPath}`);
            index_js_1.Logger.log(`[${this.TAG} disconnect] id=${this.id}`);
            index_js_1.context.nodeEvent.emit('doneConnect', this.id, this.connectCmdObj);
            this.res.end();
            index_js_1.context.idlePlayers.delete(this.id);
            index_js_1.context.sessions.delete(this.id);
        }
    }
    onReqClose() {
        this.stop();
    }
    onReqError(e) {
        this.stop();
    }
    reject() {
        index_js_1.Logger.log(`[${this.TAG} reject] id=${this.id}`);
        this.stop();
    }
    onPlay() {
        index_js_1.context.nodeEvent.emit('prePlay', this.id, this.playStreamPath, this.playArgs);
        if (!this.isStarting) {
            return;
        }
        if (this.conf.auth !== undefined && this.conf.auth.play) {
            let results = index_js_1.NodeCoreUtils.verifyAuth(this.playArgs.sign, this.playStreamPath, this.conf.auth.secret);
            if (!results) {
                index_js_1.Logger.log(`[${this.TAG} play] Unauthorized. id=${this.id} streamPath=${this.playStreamPath} sign=${this.playArgs.sign}`);
                this.res.statusCode = 403;
                this.res.end();
                return;
            }
        }
        if (!index_js_1.context.publishers.has(this.playStreamPath)) {
            index_js_1.Logger.log(`[${this.TAG} play] Stream not found. id=${this.id} streamPath=${this.playStreamPath} `);
            index_js_1.context.idlePlayers.add(this.id);
            this.isIdling = true;
            return;
        }
        this.onStartPlay();
    }
    onStartPlay() {
        let publisherId = index_js_1.context.publishers.get(this.playStreamPath);
        let publisher = index_js_1.context.sessions.get(publisherId);
        if (!(publisher instanceof node_rtmp_session_js_1.NodeRtmpSession)) {
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
        index_js_1.Logger.log(`[${this.TAG} play] Join stream. id=${this.id} streamPath=${this.playStreamPath}`);
        index_js_1.context.nodeEvent.emit('postPlay', this.id, this.playStreamPath, this.playArgs);
    }
    static createFlvTag(packet) {
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
exports.NodeHttpSession = NodeHttpSession;

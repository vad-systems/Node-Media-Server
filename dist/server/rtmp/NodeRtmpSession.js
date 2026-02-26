"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeRtmpSession = void 0;
const context_js_1 = __importDefault(require("../../core/context.js"));
const logger_js_1 = __importDefault(require("../../core/logger.js"));
const rtmp_js_1 = __importDefault(require("../../core/protocol/rtmp.js"));
const BroadcastServer_js_1 = __importDefault(require("../BroadcastServer.js"));
const NodeAvSession_js_1 = require("../NodeAvSession.js");
class NodeRtmpSession extends NodeAvSession_js_1.NodeAvSession {
    constructor(config, socket) {
        super(config, socket.remoteAddress + ':' + socket.remotePort, NodeAvSession_js_1.Protocol.RTMP);
        this.inBytes = 0;
        this.outBytes = 0;
        this.run = () => {
            this.rtmp.onConnectCallback = this.onConnect;
            this.rtmp.onPlayCallback = this.onPlay;
            this.rtmp.onPushCallback = this.onPush;
            this.rtmp.onOutputCallback = this.onOutput;
            this.rtmp.onPacketCallback = this.onPacket;
            this.socket.on('data', this.onData);
            this.socket.on('close', this.onClose);
            this.socket.on('error', this.onError);
        };
        this.onConnect = (req) => {
            var _a;
            this.streamApp = req.app;
            this.streamName = req.name;
            this.streamHost = req.host;
            this.streamPath = '/' + req.app + '/' + req.name;
            this.streamQuery = req.query;
            this.broadcast = (_a = context_js_1.default.broadcasts.get(this.streamPath)) !== null && _a !== void 0 ? _a : new BroadcastServer_js_1.default();
            context_js_1.default.broadcasts.set(this.streamPath, this.broadcast);
        };
        this.onPlay = () => {
            const err = this.broadcast.postPlay(this);
            if (err != null) {
                logger_js_1.default.error(`RTMP session ${this.id} ${this.remoteIp} play ${this.streamPath} error, ${err}`);
                this.socket.end();
                return;
            }
            this.isPublisher = false;
            logger_js_1.default.log(`RTMP session ${this.id} ${this.remoteIp} start play ${this.streamPath}`);
        };
        this.onPush = () => {
            const err = this.broadcast.postPublish(this);
            if (err != null) {
                logger_js_1.default.error(`RTMP session ${this.id} ${this.remoteIp} push ${this.streamPath} error, ${err}`);
                this.socket.end();
                return;
            }
            this.isPublisher = true;
            logger_js_1.default.log(`RTMP session ${this.id} ${this.remoteIp} start push ${this.streamPath}`);
        };
        this.onOutput = (buffer) => {
            this.socket.write(buffer);
        };
        /**
         *
         * @param {AVPacket} packet
         */
        this.onPacket = (packet) => {
            this.broadcast.broadcastMessage(packet);
        };
        this.onData = (data) => {
            this.inBytes += data.length;
            let err = this.rtmp.parserData(data);
            if (err != null) {
                logger_js_1.default.error(`RTMP session ${this.id} ${this.remoteIp} parserData error, ${err}`);
                this.socket.end();
            }
        };
        this.onClose = () => {
            logger_js_1.default.log(`RTMP session ${this.id} close`);
            if (this.isPublisher) {
                this.broadcast.donePublish(this);
            }
            else {
                this.broadcast.donePlay(this);
            }
            context_js_1.default.sessions.delete(this.id);
        };
        this.onError = (error) => {
            logger_js_1.default.log(`RTMP session ${this.id} socket error, ${error.name}: ${error.message}`);
        };
        this.sendBuffer = (buffer) => {
            this.outBytes += buffer.length;
            this.socket.write(buffer);
        };
        this.stop = () => {
            this.socket.end();
        };
        this.socket = socket;
        this.rtmp = new rtmp_js_1.default();
        this.broadcast = new BroadcastServer_js_1.default();
    }
}
exports.NodeRtmpSession = NodeRtmpSession;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeRtmpSession = void 0;
const context_js_1 = __importDefault(require("../../core/context.js"));
const rtmp_js_1 = __importDefault(require("../../core/protocol/rtmp.js"));
const BaseAvSession_js_1 = require("../BaseAvSession.js");
const Protocol_js_1 = require("../Protocol.js");
class NodeRtmpSession extends BaseAvSession_js_1.BaseAvSession {
    constructor(config, socket) {
        super(config, socket.remoteAddress + ':' + socket.remotePort, Protocol_js_1.Protocol.RTMP);
        this.run = () => {
            this.rtmp.onConnectCallback = this.onConnect;
            this.rtmp.onPlayCallback = this.onPlay;
            this.rtmp.onPushCallback = this.onPush;
            this.rtmp.onOutputCallback = this.onOutput;
            this.rtmp.onPacketCallback = this.onPacket;
            this.socket.on('data', this.onData);
            this.socket.on('close', this.onClose);
            this.socket.on('error', this.onError);
            context_js_1.default.nodeEvent.emit('postConnect', this);
        };
        this.onConnect = (req) => {
            this.streamApp = req.app;
            this.streamName = req.name;
            this.streamHost = req.host;
            this.streamPath = '/' + req.app + '/' + req.name;
            this.streamQuery = req.query;
        };
        this.onOutput = (buffer) => {
            this.outBytes += buffer.length;
            this.socket.write(buffer);
        };
        this.onData = (data) => {
            this.inBytes += data.length;
            try {
                this.rtmp.parserData(data);
            }
            catch (err) {
                this.logger.error(`${this.remoteIp} parserData error, ${err}`);
                this.socket.end();
            }
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
    }
}
exports.NodeRtmpSession = NodeRtmpSession;

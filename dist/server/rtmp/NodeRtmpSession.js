"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeRtmpSession = void 0;
const nms_core_1 = require("../../core");
const nms_protocol_1 = require("../../protocol");
const nms_server_1 = require("..");
class NodeRtmpSession extends nms_server_1.BaseAvSession {
    socket;
    rtmp;
    constructor(config, socket) {
        super(config, socket.remoteAddress + ':' + socket.remotePort, nms_server_1.Protocol.RTMP);
        this.socket = socket;
        this.rtmp = new nms_protocol_1.Rtmp();
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
        nms_core_1.context.nodeEvent.emit('postConnect', this);
    };
    onConnect = (req) => {
        this.streamApp = req.app;
        this.streamName = req.name;
        this.streamHost = req.host;
        this.streamPath = '/' + req.app + '/' + req.name;
        this.streamQuery = req.query;
    };
    onOutput = (buffer) => {
        this.outBytes += buffer.length;
        this.socket.write(buffer);
    };
    onData = (data) => {
        this.inBytes += data.length;
        try {
            this.rtmp.parserData(data);
        }
        catch (err) {
            this.logger.warn(`${this.remoteIp} parserData error, ${err}`);
            this.socket.end();
        }
    };
    sendBuffer = (buffer) => {
        this.outBytes += buffer.length;
        this.socket.write(buffer);
    };
    stop = () => {
        this.isStop = true;
        this.socket.end();
    };
}
exports.NodeRtmpSession = NodeRtmpSession;

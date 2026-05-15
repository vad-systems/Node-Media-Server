"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeRtmpSession = void 0;
const nms_core_1 = require("../../core");
const nms_protocol_1 = require("../../protocol");
const nms_server_1 = require("..");
class NodeRtmpSession extends nms_server_1.BaseAvSession {
    socket;
    rtmp;
    pingInterval = null;
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
        this.socket.on('timeout', this.onClose);
        this.socket.on('end', this.onClose);
        const ping = this.conf.rtmp.ping ?? 30;
        const pingTimeout = this.conf.rtmp.ping_timeout ?? 60;
        if (pingTimeout > 0) {
            this.socket.setTimeout(pingTimeout * 1000);
        }
        if (ping > 0) {
            this.pingInterval = setInterval(() => {
                this.rtmp.sendPing();
            }, ping * 1000);
        }
        nms_core_1.context.nodeEvent.emit('postConnect', this);
    };
    onConnect = (req) => {
        this.streamApp = req.app;
        this.streamName = req.name;
        this.streamHost = req.host;
        this.streamPath = '/' + req.app + '/' + req.name;
        this.streamQuery = req.query;
    };
    onClose() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        if (!this.isStop) {
            this.stop();
        }
        super.onClose();
    }
    onOutput = (buffer) => {
        this.sendBuffer(buffer);
    };
    onData = (data) => {
        this.inBytes += data.length;
        try {
            this.rtmp.parserData(data);
        }
        catch (err) {
            this.logger.warn(`${this.remoteIp} parserData error, ${err}`);
            this.stop();
        }
    };
    sendBuffer = (buffer) => {
        if (Buffer.isBuffer(buffer)) {
            this.outBytes += buffer.length;
            this.socket.write(buffer);
        }
    };
    stop = () => {
        this.isStop = true;
        this.endTime = Date.now();
        this.socket.destroy();
    };
}
exports.NodeRtmpSession = NodeRtmpSession;

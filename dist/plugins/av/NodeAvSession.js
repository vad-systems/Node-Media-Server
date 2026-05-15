"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeAvSession = void 0;
const ws_1 = __importDefault(require("ws"));
const nms_protocol_1 = require("../../protocol");
const nms_shared_1 = require("../../shared");
const nms_server_1 = require("../../server");
class NodeAvSession extends nms_server_1.BaseAvSession {
    req;
    res;
    flv;
    constructor(config, remoteIp, protocol, info) {
        super(config, remoteIp, protocol);
        this.flv = new nms_protocol_1.Flv();
        if (info) {
            this.streamPath = info.streamPath;
            this.streamQuery = info.streamQuery;
            this.streamApp = info.streamApp;
            this.streamName = info.streamName;
            this.streamHost = info.streamHost;
            this.isPublisher = info.isPublisher;
        }
    }
    setTransport(req, res) {
        this.req = req;
        this.res = res;
    }
    start = () => {
        super.start();
        if (this.res instanceof ws_1.default) {
            this.res.on('message', this.onData);
            this.res.on('close', this.onClose);
            this.res.on('error', this.onError);
        }
        else {
            this.req.on('data', this.onData);
            this.req.on('error', this.onError);
            this.req.socket.on('close', this.onClose);
        }
        if (this.isPublisher) {
            this.onPush();
        }
        else {
            this.onPlay();
        }
    };
    onPush() {
        super.onPush();
        this.flv.onPacketCallback = this.onPacket;
    }
    onData = (data) => {
        this.inBytes += data.length;
        try {
            this.flv.parserData(data);
        }
        catch (err) {
            this.logger.warn(`[AV] parserData error: ${err} remoteIp=${this.remoteIp}`);
            this.stop();
        }
    };
    sendBuffer = (buffer) => {
        if (!Buffer.isBuffer(buffer)) {
            return;
        }
        if (this.res instanceof ws_1.default) {
            if (this.res.readyState !== ws_1.default.OPEN) {
                return;
            }
            this.res.send(buffer);
        }
        else {
            if (this.res.writableEnded) {
                return;
            }
            this.res.write(buffer);
        }
        this.outBytes += buffer.length;
    };
    onClose = () => {
        if (this.state !== nms_shared_1.SessionState.STOPPED && this.state !== nms_shared_1.SessionState.STOPPING) {
            this.stop();
        }
        super.onClose();
    };
    stop = () => {
        if (this.state === nms_shared_1.SessionState.STOPPED || this.state === nms_shared_1.SessionState.STOPPING) {
            return;
        }
        super.stop();
        if (this.res instanceof ws_1.default) {
            this.res.close();
        }
        else {
            this.res.end();
        }
        this.didStop();
    };
}
exports.NodeAvSession = NodeAvSession;

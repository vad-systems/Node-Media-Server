"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeAvSession = void 0;
const ws_1 = __importDefault(require("ws"));
const context_js_1 = __importDefault(require("../../core/context.js"));
const flv_js_1 = __importDefault(require("../../core/protocol/flv.js"));
const BaseAvSession_js_1 = require("../BaseAvSession.js");
class NodeAvSession extends BaseAvSession_js_1.BaseAvSession {
    constructor(config, remoteIp, protocol, info) {
        super(config, remoteIp, protocol);
        this.run = () => {
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
            context_js_1.default.nodeEvent.emit('postConnect', this);
        };
        this.onData = (data) => {
            this.inBytes += data.length;
            try {
                this.flv.parserData(data);
            }
            catch (err) {
                this.logger.error(`${this.remoteIp} parserData error, ${err}`);
                this.stop();
            }
        };
        this.sendBuffer = (buffer) => {
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
        this.stop = () => {
            if (this.res instanceof ws_1.default) {
                this.res.close();
            }
            else {
                this.res.end();
            }
        };
        this.flv = new flv_js_1.default();
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
    onPush() {
        super.onPush();
        this.flv.onPacketCallback = this.onPacket;
    }
}
exports.NodeAvSession = NodeAvSession;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeHttpSession = void 0;
const url_1 = __importDefault(require("url"));
const ws_1 = __importDefault(require("ws"));
const context_js_1 = __importDefault(require("../../core/context.js"));
const logger_js_1 = __importDefault(require("../../core/logger.js"));
const BroadcastServer_js_1 = __importDefault(require("../BroadcastServer.js"));
const NodeAvSession_js_1 = require("../NodeAvSession.js");
class NodeHttpSession extends NodeAvSession_js_1.NodeAvSession {
    constructor(config, req, res) {
        var _a, _b;
        super(config, req.remoteAddress + ':' + req.remotePort, NodeAvSession_js_1.Protocol.FLV);
        this.inBytes = 0;
        this.outBytes = 0;
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
        };
        this.onPlay = () => {
            const err = this.broadcast.postPlay(this);
            if (err != null) {
                logger_js_1.default.error(`FLV session ${this.id} ${this.remoteIp} play ${this.streamPath} error, ${err}`);
                this.stop();
                return;
            }
            this.isPublisher = false;
            logger_js_1.default.log(`FLV session ${this.id} ${this.remoteIp} start play ${this.streamPath}`);
        };
        this.onPush = () => {
            const err = this.broadcast.postPublish(this);
            if (err != null) {
                logger_js_1.default.error(`FLV session ${this.id} ${this.remoteIp} push ${this.streamPath} error, ${err}`);
                this.stop();
                return;
            }
            this.isPublisher = true;
            this.flv.onPacketCallback = this.onPacket;
            logger_js_1.default.log(`FLV session ${this.id} ${this.remoteIp} start push ${this.streamPath}`);
        };
        /**
         * @param {Buffer} data
         */
        this.onData = (data) => {
            this.inBytes += data.length;
            let err = this.flv.parserData(data);
            if (err != null) {
                logger_js_1.default.error(`FLV session ${this.id} ${this.remoteIp} parserData error, ${err}`);
                this.stop();
            }
        };
        this.onClose = () => {
            logger_js_1.default.log(`FLV session ${this.id} close`);
            if (this.isPublisher) {
                this.broadcast.donePublish(this);
            }
            else {
                this.broadcast.donePlay(this);
            }
            context_js_1.default.sessions.delete(this.id);
        };
        /**
         *
         * @param {string} err
         */
        this.onError = (err) => {
            logger_js_1.default.error(`FLV session ${this.id} ${this.remoteIp} socket error, ${err}`);
        };
        /**
         * @param {AVPacket} packet
         */
        this.onPacket = (packet) => {
            this.broadcast.broadcastMessage(packet);
        };
        /**
         * @override
         * @param {Buffer} buffer
         */
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
        /**
         * @override
         */
        this.stop = () => {
            if (this.res instanceof ws_1.default) {
                this.res.close();
            }
            else {
                this.res.end();
            }
        };
        this.req = req.req;
        this.res = res.res;
        if (this.res instanceof ws_1.default) {
            const urlInfo = url_1.default.parse(this.req.url, true);
            this.streamHost = (_a = this.req.headers.host) === null || _a === void 0 ? void 0 : _a.split(':')[0];
            this.streamPath = urlInfo.pathname.split('.')[0];
            this.streamApp = this.streamPath.split('/')[1];
            this.streamName = this.streamPath.split('/')[2];
            this.streamQuery = urlInfo.query;
            if (this.res.protocol.toLowerCase() === 'post' || this.res.protocol.toLowerCase() === 'publisher') {
                this.isPublisher = true;
            }
        }
        else {
            this.streamHost = this.req.hostname;
            this.streamApp = this.req.params.splat[0]; // TODO
            this.streamName = this.req.params.splat[1]; // TODO
            this.streamPath = '/' + this.streamApp + '/' + this.streamName;
            this.streamQuery = this.req.query;
            if (this.req.method === 'POST') {
                this.isPublisher = true;
            }
        }
        this.broadcast = (_b = context_js_1.default.broadcasts.get(this.streamPath)) !== null && _b !== void 0 ? _b : new BroadcastServer_js_1.default();
        context_js_1.default.broadcasts.set(this.streamPath, this.broadcast);
    }
}
exports.NodeHttpSession = NodeHttpSession;

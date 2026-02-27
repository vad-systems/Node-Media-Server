"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const node_buffer_1 = require("node:buffer");
const node_crypto_1 = __importDefault(require("node:crypto"));
const context_js_1 = __importDefault(require("../core/context.js"));
const amf_js_1 = require("../core/protocol/amf.js");
const flv_js_1 = __importDefault(require("../core/protocol/flv.js"));
const rtmp_js_1 = __importDefault(require("../core/protocol/rtmp.js"));
const NodeAvSession_js_1 = require("./NodeAvSession.js");
class BroadcastServer {
    constructor() {
        this.verifyAuth = (authKey, session) => {
            var _a, _b;
            if (authKey === '') {
                return true;
            }
            let signStr = (_a = session.streamQuery) === null || _a === void 0 ? void 0 : _a.sign; // TOOD
            if (((_b = signStr === null || signStr === void 0 ? void 0 : signStr.split('-')) === null || _b === void 0 ? void 0 : _b.length) !== 2) {
                return false;
            }
            let now = Date.now() / 1000 | 0;
            let exp = (0, lodash_1.parseInt)(signStr.split('-')[0]);
            let shv = signStr.split('-')[1];
            let str = session.streamPath + '-' + exp + '-' + authKey;
            if (exp < now) {
                return false;
            }
            let md5 = node_crypto_1.default.createHash('md5');
            let ohv = md5.update(str).digest('hex');
            return shv === ohv;
        };
        this.postPlay = (session) => {
            var _a, _b;
            if (session.remoteIp !== '') {
                context_js_1.default.nodeEvent.emit('prePlay', session);
            }
            const config = context_js_1.default.configProvider.getConfig();
            if (((_a = config.auth) === null || _a === void 0 ? void 0 : _a.play) && session.remoteIp !== '') {
                if (!this.verifyAuth((_b = config.auth) === null || _b === void 0 ? void 0 : _b.secret, session)) {
                    return `play stream ${session.streamPath} authentication verification failed`;
                }
            }
            if (session.remoteIp !== '') {
                context_js_1.default.nodeEvent.emit('postPlay', session);
            }
            switch (session.protocol) {
                case NodeAvSession_js_1.Protocol.FLV:
                    session.sendBuffer(this.flvHeader);
                    if (this.flvMetaData !== null) {
                        session.sendBuffer(this.flvMetaData);
                    }
                    if (this.flvAudioHeader !== null) {
                        session.sendBuffer(this.flvAudioHeader);
                    }
                    if (this.flvVideoHeader !== null) {
                        session.sendBuffer(this.flvVideoHeader);
                    }
                    if (this.flvGopCache !== null) {
                        this.flvGopCache.forEach((v) => {
                            session.sendBuffer(v);
                        });
                    }
                    break;
                case NodeAvSession_js_1.Protocol.RTMP:
                    if (this.rtmpMetaData != null) {
                        session.sendBuffer(this.rtmpMetaData);
                    }
                    if (this.rtmpAudioHeader != null) {
                        session.sendBuffer(this.rtmpAudioHeader);
                    }
                    if (this.rtmpVideoHeader != null) {
                        session.sendBuffer(this.rtmpVideoHeader);
                    }
                    if (this.rtmpGopCache !== null) {
                        this.rtmpGopCache.forEach((v) => {
                            session.sendBuffer(v);
                        });
                    }
            }
            this._subscribers.set(session.id, session);
            return null;
        };
        this.donePlay = (session) => {
            session.endTime = Date.now();
            if (session.remoteIp !== '') {
                context_js_1.default.nodeEvent.emit('donePlay', session);
            }
            this._subscribers.delete(session.id);
        };
        this.postPublish = (session) => {
            var _a, _b;
            context_js_1.default.nodeEvent.emit('prePublish', session);
            const config = context_js_1.default.configProvider.getConfig();
            if ((_a = config.auth) === null || _a === void 0 ? void 0 : _a.publish) {
                if (!this.verifyAuth((_b = config.auth) === null || _b === void 0 ? void 0 : _b.secret, session)) {
                    return `publish stream ${session.streamPath} authentication verification failed`;
                }
            }
            if (this._publisher == null) {
                this._publisher = session;
            }
            else {
                return `streamPath=${session.streamPath} already has a publisher`;
            }
            context_js_1.default.nodeEvent.emit('postPublish', session);
            return null;
        };
        this.donePublish = (session) => {
            var _a, _b;
            if (session === this._publisher) {
                session.endTime = Date.now();
                context_js_1.default.nodeEvent.emit('donePublish', session);
                this._publisher = null;
                this.flvMetaData = null;
                this.flvAudioHeader = null;
                this.flvVideoHeader = null;
                this.rtmpMetaData = null;
                this.rtmpAudioHeader = null;
                this.rtmpVideoHeader = null;
                (_a = this.flvGopCache) === null || _a === void 0 ? void 0 : _a.clear();
                (_b = this.rtmpGopCache) === null || _b === void 0 ? void 0 : _b.clear();
            }
        };
        this.broadcastMessage = (packet) => {
            var _a, _b, _c, _d, _e, _f;
            if (packet.flags == 5) {
                let metadata = (0, amf_js_1.decodeAmf0Data)(packet.data);
                if (this._publisher && metadata.cmd === '@setDataFrame' && metadata.dataObj !== null) {
                    this._publisher.audioCodec = metadata.dataObj.audiocodecid;
                    this._publisher.audioChannels = metadata.dataObj.stereo ? 2 : 1;
                    this._publisher.audioSamplerate = metadata.dataObj.audiosamplerate;
                    this._publisher.audioDatarate = metadata.dataObj.audiodatarate;
                    this._publisher.videoCodec = metadata.dataObj.videocodecid;
                    this._publisher.videoWidth = metadata.dataObj.width;
                    this._publisher.videoHeight = metadata.dataObj.height;
                    this._publisher.videoFramerate = metadata.dataObj.framerate;
                    this._publisher.videoDatarate = metadata.dataObj.videodatarate;
                }
            }
            const flvMessage = flv_js_1.default.createMessage(packet);
            const rtmpMessage = rtmp_js_1.default.createMessage(packet);
            switch (packet.flags) {
                case 0:
                    this.flvAudioHeader = node_buffer_1.Buffer.from(flvMessage);
                    this.rtmpAudioHeader = node_buffer_1.Buffer.from(rtmpMessage);
                    break;
                case 1:
                    (_a = this.flvGopCache) === null || _a === void 0 ? void 0 : _a.add(flvMessage);
                    (_b = this.rtmpGopCache) === null || _b === void 0 ? void 0 : _b.add(rtmpMessage);
                    break;
                case 2:
                    this.flvVideoHeader = node_buffer_1.Buffer.from(flvMessage);
                    this.rtmpVideoHeader = node_buffer_1.Buffer.from(rtmpMessage);
                    break;
                case 3:
                    (_c = this.flvGopCache) === null || _c === void 0 ? void 0 : _c.clear();
                    (_d = this.rtmpGopCache) === null || _d === void 0 ? void 0 : _d.clear();
                    this.flvGopCache = new Set();
                    this.rtmpGopCache = new Set();
                    this.flvGopCache.add(flvMessage);
                    this.rtmpGopCache.add(rtmpMessage);
                    break;
                case 4:
                    (_e = this.flvGopCache) === null || _e === void 0 ? void 0 : _e.add(flvMessage);
                    (_f = this.rtmpGopCache) === null || _f === void 0 ? void 0 : _f.add(rtmpMessage);
                    break;
                case 5:
                    this.flvMetaData = node_buffer_1.Buffer.from(flvMessage);
                    this.rtmpMetaData = node_buffer_1.Buffer.from(rtmpMessage);
                    break;
            }
            if (this.flvGopCache && this.flvGopCache.size > 4096) {
                this.flvGopCache.clear();
            }
            if (this.rtmpGopCache && this.rtmpGopCache.size > 4096) {
                this.rtmpGopCache.clear();
            }
            this._subscribers.forEach((v, k) => {
                switch (v.protocol) {
                    case NodeAvSession_js_1.Protocol.FLV:
                        v.sendBuffer(flvMessage);
                        break;
                    case NodeAvSession_js_1.Protocol.RTMP:
                        v.sendBuffer(rtmpMessage);
                        break;
                }
            });
        };
        this._publisher = null;
        this._subscribers = new Map();
        this.flvHeader = flv_js_1.default.createHeader(true, true);
        this.flvMetaData = null;
        this.flvAudioHeader = null;
        this.flvVideoHeader = null;
        this.rtmpMetaData = null;
        this.rtmpAudioHeader = null;
        this.rtmpVideoHeader = null;
        this.flvGopCache = null;
        this.rtmpGopCache = null;
    }
    get publisher() {
        return this._publisher;
    }
    set publisher(value) {
        this._publisher = value;
    }
    get subscribers() {
        return this._subscribers;
    }
    set subscribers(value) {
        this._subscribers = value;
    }
}
exports.default = BroadcastServer;

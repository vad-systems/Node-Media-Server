"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_buffer_1 = require("node:buffer");
const amf_js_1 = require("../core/protocol/amf.js");
const av_js_1 = require("../core/protocol/av.js");
const flv_js_1 = __importDefault(require("../core/protocol/flv.js"));
const rtmp_js_1 = __importDefault(require("../core/protocol/rtmp.js"));
const BaseAvSession_js_1 = require("./BaseAvSession.js");
const BroadcastServer_js_1 = __importDefault(require("./BroadcastServer.js"));
const Protocol_js_1 = require("./Protocol.js");
class AvBroadcastServer extends BroadcastServer_js_1.default {
    constructor() {
        super();
        this.donePublish = (session) => {
            var _a, _b;
            if (session === this.publisher) {
                super.donePublish(session);
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
    postPlay(session) {
        super.postPlay(session);
        switch (session.protocol) {
            case Protocol_js_1.Protocol.FLV:
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
            case Protocol_js_1.Protocol.RTMP:
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
    }
    ;
    broadcastMessage(packet) {
        var _a, _b, _c, _d, _e, _f;
        if (packet.flags == 5) {
            let metadata = (0, amf_js_1.decodeAmf0Data)(packet.data);
            if (this.publisher && metadata.cmd === '@setDataFrame' && metadata.dataObj !== null) {
                this.publisher.audioCodec = metadata.dataObj.audiocodecid;
                this.publisher.audioChannels = metadata.dataObj.stereo ? 2 : 1;
                this.publisher.audioSamplerate = metadata.dataObj.audiosamplerate;
                this.publisher.audioDatarate = metadata.dataObj.audiodatarate;
                this.publisher.videoCodec = metadata.dataObj.videocodecid;
                this.publisher.videoWidth = metadata.dataObj.width;
                this.publisher.videoHeight = metadata.dataObj.height;
                this.publisher.videoFramerate = metadata.dataObj.framerate;
                this.publisher.videoDatarate = metadata.dataObj.videodatarate;
            }
        }
        const flvMessage = flv_js_1.default.createMessage(packet);
        const rtmpMessage = rtmp_js_1.default.createMessage(packet);
        switch (packet.flags) {
            case 0:
                this.flvAudioHeader = node_buffer_1.Buffer.from(flvMessage);
                this.rtmpAudioHeader = node_buffer_1.Buffer.from(rtmpMessage);
                let audioInfo = (0, av_js_1.readAACSpecificConfig)(packet.data);
                this.publisher.audioProfile = (0, av_js_1.getAACProfileName)(audioInfo);
                break;
            case 1:
                (_a = this.flvGopCache) === null || _a === void 0 ? void 0 : _a.add(flvMessage);
                (_b = this.rtmpGopCache) === null || _b === void 0 ? void 0 : _b.add(rtmpMessage);
                break;
            case 2:
                this.flvVideoHeader = node_buffer_1.Buffer.from(flvMessage);
                this.rtmpVideoHeader = node_buffer_1.Buffer.from(rtmpMessage);
                let videoInfo = (0, av_js_1.readAVCSpecificConfig)(packet.data);
                this.publisher.videoProfile = (0, av_js_1.getAVCProfileName)(videoInfo);
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
        this.subscribers.forEach((v, k) => {
            if (!(v instanceof BaseAvSession_js_1.BaseAvSession)) {
                return;
            }
            switch (v.protocol) {
                case Protocol_js_1.Protocol.FLV:
                    v.sendBuffer(flvMessage);
                    break;
                case Protocol_js_1.Protocol.RTMP:
                    v.sendBuffer(rtmpMessage);
                    break;
            }
        });
    }
    ;
}
exports.default = AvBroadcastServer;

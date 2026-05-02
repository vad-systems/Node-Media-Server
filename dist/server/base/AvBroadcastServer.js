"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nms_protocol_1 = require("../../protocol");
const node_buffer_1 = require("node:buffer");
const BaseAvSession_js_1 = require("./BaseAvSession.js");
const BroadcastServer_js_1 = require("./BroadcastServer.js");
const Protocol_js_1 = require("./Protocol.js");
class AvBroadcastServer extends BroadcastServer_js_1.BroadcastServer {
    flvHeader;
    flvMetaData;
    flvAudioHeader;
    flvVideoHeader;
    rtmpMetaData;
    rtmpAudioHeader;
    rtmpVideoHeader;
    flvGopCache;
    rtmpGopCache;
    constructor() {
        super();
        this.flvHeader = nms_protocol_1.Flv.createHeader(true, true);
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
            case Protocol_js_1.Protocol.HTTP_FLV:
            case Protocol_js_1.Protocol.WS_FLV:
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
    donePublish = (session) => {
        if (session === this.publisher) {
            super.donePublish(session);
            this.flvMetaData = null;
            this.flvAudioHeader = null;
            this.flvVideoHeader = null;
            this.rtmpMetaData = null;
            this.rtmpAudioHeader = null;
            this.rtmpVideoHeader = null;
            this.flvGopCache?.clear();
            this.rtmpGopCache?.clear();
        }
    };
    broadcastMessage(packet) {
        if (packet.flags == 5) {
            let metadata = nms_protocol_1.amf.decodeAmf0Data(packet.data);
            if (this.publisher && metadata.cmd === '@setDataFrame' && metadata.dataObj !== null) {
                this.logger.debug('[metadata frame]', metadata);
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
        const flvMessage = nms_protocol_1.Flv.createMessage(packet);
        const rtmpMessage = nms_protocol_1.Rtmp.createMessage(packet);
        switch (packet.flags) {
            case 0:
                this.flvAudioHeader = node_buffer_1.Buffer.from(flvMessage);
                this.rtmpAudioHeader = node_buffer_1.Buffer.from(rtmpMessage);
                let audioInfo = nms_protocol_1.av.readAACSpecificConfig(packet.data);
                this.publisher.audioProfile = nms_protocol_1.av.getAACProfileName(audioInfo);
                break;
            case 1:
                this.flvGopCache?.add(flvMessage);
                this.rtmpGopCache?.add(rtmpMessage);
                break;
            case 2:
                this.flvVideoHeader = node_buffer_1.Buffer.from(flvMessage);
                this.rtmpVideoHeader = node_buffer_1.Buffer.from(rtmpMessage);
                let videoInfo = nms_protocol_1.av.readAVCSpecificConfig(packet.data);
                this.publisher.videoProfile = nms_protocol_1.av.getAVCProfileName(videoInfo);
                this.publisher.videoLevel = videoInfo.level;
                break;
            case 3:
                this.flvGopCache?.clear();
                this.rtmpGopCache?.clear();
                this.flvGopCache = new Set();
                this.rtmpGopCache = new Set();
                this.flvGopCache.add(flvMessage);
                this.rtmpGopCache.add(rtmpMessage);
                break;
            case 4:
                this.flvGopCache?.add(flvMessage);
                this.rtmpGopCache?.add(rtmpMessage);
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
                case Protocol_js_1.Protocol.HTTP_FLV:
                case Protocol_js_1.Protocol.WS_FLV:
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

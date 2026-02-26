"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeAvSession = exports.Protocol = void 0;
const NodeSession_js_1 = require("./NodeSession.js");
var Protocol;
(function (Protocol) {
    Protocol["RTMP"] = "rtmp";
    Protocol["FLV"] = "flv";
})(Protocol || (exports.Protocol = Protocol = {}));
class NodeAvSession extends NodeSession_js_1.NodeSession {
    constructor(conf, remoteIp, protocol) {
        super(conf, remoteIp, protocol.toString());
        this._streamPath = null;
        this._streamQuery = null;
        this._audioCodec = null;
        this._audioChannels = null;
        this._audioSamplerate = null;
        this._audioDatarate = null;
        this._videoCodec = null;
        this._videoWidth = null;
        this._videoHeight = null;
        this._videoFramerate = null;
        this._videoDatarate = null;
        this._endTime = null;
        this.protocol = protocol;
    }
    set streamPath(path) {
        this._streamPath = path;
    }
    get streamPath() {
        return this._streamPath;
    }
    set streamQuery(query) {
        this._streamQuery = query;
    }
    get streamQuery() {
        return this._streamQuery;
    }
    set audioCodec(codec) {
        this._audioCodec = codec;
    }
    get audioCodec() {
        return this._audioCodec;
    }
    set audioChannels(channels) {
        this._audioChannels = channels;
    }
    get audioChannels() {
        return this._audioChannels;
    }
    set audioSamplerate(samplerate) {
        this._audioSamplerate = samplerate;
    }
    get audioSamplerate() {
        return this._audioSamplerate;
    }
    set audioDatarate(datarate) {
        this._audioDatarate = datarate;
    }
    get audioDatarate() {
        return this._audioDatarate;
    }
    set videoCodec(codec) {
        this._videoCodec = codec;
    }
    get videoCodec() {
        return this._videoCodec;
    }
    set videoWidth(width) {
        this._videoWidth = width;
    }
    get videoWidth() {
        return this._videoWidth;
    }
    set videoHeight(height) {
        this._videoHeight = height;
    }
    get videoHeight() {
        return this._videoHeight;
    }
    set videoFramerate(framerate) {
        this._videoFramerate = framerate;
    }
    get videoFramerate() {
        return this._videoFramerate;
    }
    set videoDatarate(datarate) {
        this._videoDatarate = datarate;
    }
    get videoDatarate() {
        return this._videoDatarate;
    }
    set endTime(time) {
        this._endTime = time;
    }
    get endTime() {
        return this._endTime;
    }
}
exports.NodeAvSession = NodeAvSession;

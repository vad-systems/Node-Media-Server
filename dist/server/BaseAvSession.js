"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAvSession = void 0;
const context_js_1 = __importDefault(require("../core/context.js"));
const AvBroadcastServer_js_1 = __importDefault(require("./AvBroadcastServer.js"));
const NodeSession_js_1 = require("./NodeSession.js");
class BaseAvSession extends NodeSession_js_1.NodeSession {
    constructor(conf, remoteIp, protocol) {
        super(conf, remoteIp, protocol.toString());
        this._audioCodec = null;
        this._audioProfile = null;
        this._audioChannels = null;
        this._audioSamplerate = null;
        this._audioDatarate = null;
        this._videoCodec = null;
        this._videoProfile = null;
        this._videoLevel = null;
        this._videoWidth = null;
        this._videoHeight = null;
        this._videoFramerate = null;
        this._videoDatarate = null;
        this.protocol = protocol;
        this.onPlay = this.onPlay.bind(this);
        this.onPush = this.onPush.bind(this);
        this.onClose = this.onClose.bind(this);
        this.onError = this.onError.bind(this);
        this.onPacket = this.onPacket.bind(this);
    }
    get avBroadcast() {
        return this.broadcast;
    }
    onPlay() {
        try {
            this.initBroadcast();
            this.broadcast.postPlay(this);
        }
        catch (err) {
            this.logger.warn(`${this.remoteIp} play ${this.streamPath} error, ${err}`);
            this.stop();
            return;
        }
        this.isPublisher = false;
        this.logger.log(`${this.remoteIp} start play ${this.streamPath}`);
    }
    onPush() {
        try {
            this.initBroadcast();
            this.broadcast.postPublish(this);
        }
        catch (err) {
            this.logger.warn(`${this.remoteIp} push ${this.streamPath} error, ${err}`);
            this.stop();
            return;
        }
        this.isPublisher = true;
        this.logger.log(`${this.remoteIp} start push ${this.streamPath}`);
    }
    onClose() {
        var _a, _b;
        this.logger.log(`close`);
        if (this.isPublisher) {
            (_a = this.broadcast) === null || _a === void 0 ? void 0 : _a.donePublish(this);
        }
        else {
            (_b = this.broadcast) === null || _b === void 0 ? void 0 : _b.donePlay(this);
        }
        context_js_1.default.nodeEvent.emit('doneConnect', this);
        this.cleanup();
    }
    onError(err) {
        this.logger.error(`${this.remoteIp} socket error, ${err}`);
    }
    onPacket(packet) {
        var _a;
        (_a = this.avBroadcast) === null || _a === void 0 ? void 0 : _a.broadcastMessage(packet);
    }
    initBroadcast() {
        var _a;
        if (!this.broadcast) {
            this.broadcast = (_a = context_js_1.default.broadcasts.get(this.streamPath)) !== null && _a !== void 0 ? _a : new AvBroadcastServer_js_1.default();
            context_js_1.default.broadcasts.set(this.streamPath, this.broadcast);
        }
    }
    set audioCodec(codec) {
        this._audioCodec = codec;
    }
    get audioCodec() {
        return this._audioCodec;
    }
    set audioProfile(profile) {
        this._audioProfile = profile;
    }
    get audioProfile() {
        return this._audioProfile;
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
    set videoProfile(profile) {
        this._videoProfile = profile;
    }
    get videoProfile() {
        return this._videoProfile;
    }
    set videoLevel(level) {
        this._videoLevel = level;
    }
    get videoLevel() {
        return this._videoLevel;
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
}
exports.BaseAvSession = BaseAvSession;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAvSession = void 0;
const nms_core_1 = require("../../core");
const AvBroadcastServer_js_1 = require("./AvBroadcastServer.js");
const NodeSession_js_1 = require("./NodeSession.js");
class BaseAvSession extends NodeSession_js_1.NodeSession {
    protocol;
    _audioCodec = null;
    _audioProfile = null;
    _audioChannels = null;
    _audioSamplerate = null;
    _audioDatarate = null;
    _videoCodec = null;
    _videoProfile = null;
    _videoLevel = null;
    _videoWidth = null;
    _videoHeight = null;
    _videoFramerate = null;
    _videoDatarate = null;
    constructor(conf, remoteIp, protocol) {
        super(conf, remoteIp, protocol.toString());
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
        this.logger.log(`close`);
        if (this.isPublisher) {
            this.broadcast?.donePublish(this);
        }
        else {
            this.broadcast?.donePlay(this);
        }
        nms_core_1.context.nodeEvent.emit('doneConnect', this);
        this.cleanup();
    }
    onError(err) {
        this.logger.error(`${this.remoteIp} socket error, ${err}`);
    }
    onPacket(packet) {
        this.avBroadcast?.broadcastMessage(packet);
    }
    initBroadcast() {
        if (!this.broadcast) {
            this.broadcast = nms_core_1.context.broadcasts.get(this.streamPath) ?? new AvBroadcastServer_js_1.AvBroadcastServer();
            nms_core_1.context.broadcasts.set(this.streamPath, this.broadcast);
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

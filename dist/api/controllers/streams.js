"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const flv_js_1 = require("../../core/protocol/flv.js");
function getStreams(req, res, next) {
    let stats = {};
    this.broadcasts.forEach((broadcast, key) => {
        const [k, app, name] = key.split('/');
        const publisher = broadcast.publisher;
        lodash_1.default.setWith(stats, [app, name], {
            key,
            app,
            name,
            publisher: publisher ? {
                app,
                stream: name,
                clientId: publisher.id,
                ip: publisher.remoteIp,
                protocol: publisher.protocol === 'websocket-flv' ? 'ws' : (publisher.protocol === 'http-flv' ? 'http' : publisher.protocol),
                connectCreated: publisher.startTime,
                video: publisher.videoCodec !== null ? {
                    codec: flv_js_1.FlvVideoCodec[publisher.videoCodec],
                    width: publisher.videoWidth,
                    height: publisher.videoHeight,
                    profile: publisher.videoProfile,
                    level: publisher.videoLevel,
                    fps: publisher.videoFramerate,
                } : null,
                audio: publisher.audioCodec !== null ? {
                    codec: flv_js_1.FlvAudioCodec[publisher.audioCodec],
                    profile: publisher.audioProfile,
                    channels: publisher.audioChannels,
                    samplerate: publisher.audioSamplerate,
                } : null,
                bytes: publisher.inBytes,
            } : null,
            subscribers: [...broadcast.subscribers.values()].map(subscriber => {
                switch (subscriber.TAG) {
                    case 'rtmp': {
                        return {
                            app,
                            stream: name,
                            clientId: subscriber.id,
                            connectCreated: subscriber.startTime,
                            bytes: subscriber.outBytes,
                            ip: subscriber.remoteIp,
                            protocol: 'rtmp',
                        };
                    }
                    case 'http-flv':
                    case 'websocket-flv': {
                        return {
                            app,
                            stream: name,
                            clientId: subscriber.id,
                            connectCreated: subscriber.startTime,
                            bytes: subscriber.outBytes,
                            ip: subscriber.remoteIp,
                            protocol: subscriber.TAG === 'websocket-flv' ? 'ws' : 'http',
                        };
                    }
                    case 'relay':
                    case 'trans':
                    case 'fission': {
                        return {
                            app,
                            stream: name,
                            clientId: subscriber.id,
                            connectCreated: subscriber.startTime,
                            bytes: subscriber.outBytes,
                            ip: subscriber.remoteIp,
                            protocol: subscriber.TAG,
                        };
                    }
                }
                return null;
            }).filter(Boolean),
        });
    });
    res.json(stats);
}
function getStream(req, res, next) {
    var _a, _b;
    let streamStats = {
        isLive: false,
        viewers: 0,
        duration: 0,
        bitrate: 0,
        startTime: null,
        arguments: {},
    };
    let publishStreamPath = `/${req.params.app}/${req.params.stream}`;
    let broadcast = this.broadcasts.get(publishStreamPath);
    let publisherSession = this.sessions.get((_a = broadcast === null || broadcast === void 0 ? void 0 : broadcast.publisher) === null || _a === void 0 ? void 0 : _a.id);
    streamStats.isLive = !!publisherSession;
    streamStats.viewers = ((_b = broadcast === null || broadcast === void 0 ? void 0 : broadcast.subscribers) === null || _b === void 0 ? void 0 : _b.size) || 0;
    streamStats.duration = streamStats.isLive
        ? Math.ceil((Date.now() - publisherSession.startTime) / 1000)
        : 0;
    streamStats.bitrate = 0;
    streamStats.startTime = streamStats.isLive
        ? publisherSession.startTime
        : null;
    streamStats.arguments = !!publisherSession ? publisherSession.streamQuery : {};
    res.json(streamStats);
}
function delStream(req, res, next) {
    var _a, _b;
    let publishStreamPath = `/${req.params.app}/${req.params.stream}`;
    let publisherSession = this.sessions.get((_b = (_a = this.broadcasts.get(publishStreamPath)) === null || _a === void 0 ? void 0 : _a.publisher) === null || _b === void 0 ? void 0 : _b.id);
    if (publisherSession) {
        publisherSession.stop();
        res.json('ok');
    }
    else {
        res.status(404).json({ error: 'stream not found' });
    }
}
exports.default = {
    delStream,
    getStreams,
    getStream,
};

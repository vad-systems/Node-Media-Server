"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const node_crypto_1 = __importDefault(require("node:crypto"));
const context_js_1 = __importDefault(require("../core/context.js"));
class BroadcastServer {
    constructor() {
        this._publisher = null;
        this._subscribers = new Map();
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
    verifyAuth(authKey, session) {
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
    }
    ;
    postPlay(session) {
        var _a, _b;
        context_js_1.default.nodeEvent.emit('prePlay', session);
        const config = context_js_1.default.configProvider.getConfig();
        if (((_a = config.auth) === null || _a === void 0 ? void 0 : _a.play) && session.remoteIp !== '') {
            if (!this.verifyAuth((_b = config.auth) === null || _b === void 0 ? void 0 : _b.secret, session)) {
                throw new Error(`play stream ${session.streamPath} authentication verification failed`);
            }
        }
        context_js_1.default.nodeEvent.emit('postPlay', session);
        session.startTime = Date.now();
        this.subscribers.set(session.id, session);
        context_js_1.default.idlePlayers.delete(session.id);
    }
    donePlay(session) {
        session.endTime = Date.now();
        context_js_1.default.idlePlayers.add(session.id);
        context_js_1.default.nodeEvent.emit('donePlay', session);
        this.subscribers.delete(session.id);
    }
    postPublish(session) {
        var _a, _b;
        context_js_1.default.nodeEvent.emit('prePublish', session);
        const config = context_js_1.default.configProvider.getConfig();
        if ((_a = config.auth) === null || _a === void 0 ? void 0 : _a.publish) {
            if (!this.verifyAuth((_b = config.auth) === null || _b === void 0 ? void 0 : _b.secret, session)) {
                throw new Error(`publish stream ${session.streamPath} authentication verification failed`);
            }
        }
        if (this.publisher == null) {
            session.startTime = Date.now();
            this.publisher = session;
            context_js_1.default.idlePlayers.delete(session.id);
        }
        else {
            throw new Error(`streamPath=${session.streamPath} already has a publisher`);
        }
        context_js_1.default.nodeEvent.emit('postPublish', session);
    }
    donePublish(session) {
        if (session === this.publisher) {
            session.endTime = Date.now();
            context_js_1.default.idlePlayers.add(session.id);
            context_js_1.default.nodeEvent.emit('donePublish', session);
            this.subscribers.forEach((subscriber) => {
                if (subscriber.isFfmpegTask()) {
                    subscriber.stop();
                    this.subscribers.delete(subscriber.id);
                }
            });
            this.publisher = null;
        }
    }
}
exports.default = BroadcastServer;

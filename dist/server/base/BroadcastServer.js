"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BroadcastServer = void 0;
const nms_core_1 = require("../../core");
const lodash_1 = require("lodash");
const node_crypto_1 = __importDefault(require("node:crypto"));
const utils_js_1 = require("../../core/utils.js");
class BroadcastServer {
    id = null;
    logger;
    _publisher;
    _subscribers;
    constructor() {
        this.id = (0, utils_js_1.generateNewSessionID)();
        this.logger = nms_core_1.LoggerFactory.getLogger(`BroadcastServer ${this.id}`);
        this._publisher = null;
        this._subscribers = new Map();
    }
    get publisher() {
        return this._publisher;
    }
    set publisher(value) {
        this._publisher = value;
        if (value) {
            this.logger.log(`[publisher] set: ${this._publisher.id}`);
        }
        else {
            this.logger.log(`[publisher] remove`);
        }
    }
    get subscribers() {
        return this._subscribers;
    }
    set subscribers(value) {
        this._subscribers = value;
    }
    verifyAuth(authKey, session) {
        if (authKey === '') {
            return true;
        }
        let signStr = session.streamQuery?.sign; // TOOD
        if (signStr?.split('-')?.length !== 2) {
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
        nms_core_1.context.nodeEvent.emit('prePlay', session);
        const config = nms_core_1.context.configProvider.getConfig();
        if (config.auth?.play && session.remoteIp !== '') {
            if (!this.verifyAuth(config.auth?.secret, session)) {
                throw new Error(`play stream ${session.streamPath} authentication verification failed`);
            }
        }
        nms_core_1.context.nodeEvent.emit('postPlay', session);
        session.startTime = Date.now();
        this.subscribers.set(session.id, session);
        nms_core_1.context.idlePlayers.delete(session.id);
    }
    donePlay(session) {
        session.endTime = Date.now();
        nms_core_1.context.idlePlayers.add(session.id);
        nms_core_1.context.nodeEvent.emit('donePlay', session);
        this.subscribers.delete(session.id);
    }
    postPublish(session) {
        nms_core_1.context.nodeEvent.emit('prePublish', session);
        const config = nms_core_1.context.configProvider.getConfig();
        if (config.auth?.publish) {
            if (!this.verifyAuth(config.auth?.secret, session)) {
                throw new Error(`publish stream ${session.streamPath} authentication verification failed`);
            }
        }
        if (this.publisher == null) {
            session.startTime = Date.now();
            this.publisher = session;
            nms_core_1.context.idlePlayers.delete(session.id);
        }
        else {
            throw new Error(`streamPath=${session.streamPath} already has a publisher`);
        }
        nms_core_1.context.nodeEvent.emit('postPublish', session);
    }
    donePublish(session) {
        if (session === this.publisher) {
            session.endTime = Date.now();
            nms_core_1.context.idlePlayers.add(session.id);
            nms_core_1.context.nodeEvent.emit('donePublish', session);
            this.subscribers.forEach((subscriber) => {
                subscriber.stop();
                this.subscribers.delete(subscriber.id);
            });
            this.publisher = null;
        }
    }
}
exports.BroadcastServer = BroadcastServer;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeSession = void 0;
const events_1 = __importDefault(require("events"));
const lodash_1 = __importDefault(require("lodash"));
const nms_core_1 = require("../../core");
class NodeSession extends events_1.default {
    conf;
    id = null;
    remoteIp;
    TAG;
    logger;
    _streamPath = null;
    _streamQuery = null;
    _streamApp = null;
    _streamName = null;
    _streamHost = null;
    _isPublisher = false;
    _broadcast = null;
    _startTime = null;
    _endTime = null;
    _inBytes = 0;
    _outBytes = 0;
    _isStop = false;
    constructor(conf, remoteIp, tag) {
        super();
        this.conf = lodash_1.default.cloneDeep(conf);
        this.id = nms_core_1.NodeCoreUtils.generateNewSessionID();
        this.remoteIp = remoteIp;
        this.TAG = tag;
        this.logger = nms_core_1.LoggerFactory.getLogger(`${this.TAG} ${this.id}`);
        nms_core_1.context.sessions.set(this.id, this);
        nms_core_1.context.idlePlayers.add(this.id);
        nms_core_1.context.nodeEvent.emit('preConnect', this);
    }
    cleanup() {
        nms_core_1.context.sessions.delete(this.id);
        nms_core_1.context.idlePlayers.delete(this.id);
    }
    getConfig(key = null) {
        if (!key) {
            return;
        }
        if (typeof this.conf != 'object') {
            return;
        }
        if (this.conf.args && typeof this.conf.args === 'object' && this.conf.args[key]) {
            return this.conf.args[key];
        }
        return this.conf[key];
    }
    isLocal() {
        return this.remoteIp.startsWith('127.0.0.1')
            || this.remoteIp.startsWith('::1')
            || this.remoteIp.startsWith('::ffff:127.0.0.1');
    }
    isFfmpegTask() {
        return false;
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
    set streamApp(value) {
        this._streamApp = value;
    }
    get streamApp() {
        return this._streamApp;
    }
    set streamName(value) {
        this._streamName = value;
    }
    get streamName() {
        return this._streamName;
    }
    set streamHost(value) {
        this._streamHost = value;
    }
    get streamHost() {
        return this._streamHost;
    }
    set isPublisher(value) {
        this._isPublisher = value;
    }
    get isPublisher() {
        return this._isPublisher;
    }
    set broadcast(value) {
        this._broadcast = value;
    }
    get broadcast() {
        return this._broadcast;
    }
    set startTime(time) {
        this._startTime = time;
    }
    get startTime() {
        return this._startTime;
    }
    set endTime(time) {
        this._endTime = time;
    }
    get endTime() {
        return this._endTime;
    }
    set inBytes(value) {
        this._inBytes = value;
    }
    get inBytes() {
        return this._inBytes;
    }
    set outBytes(value) {
        this._outBytes = value;
    }
    get outBytes() {
        return this._outBytes;
    }
    get isStop() {
        return this._isStop;
    }
    set isStop(value) {
        this._isStop = value;
    }
}
exports.NodeSession = NodeSession;

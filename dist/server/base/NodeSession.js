"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeSession = void 0;
const events_1 = __importDefault(require("events"));
const lodash_1 = __importDefault(require("lodash"));
const nms_core_1 = require("../../core");
const nms_shared_1 = require("../../shared");
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
    _parentId = null;
    _state = nms_shared_1.SessionState.CONNECTING;
    _isManualStop = false;
    constructor(conf, remoteIp, tag) {
        super();
        this.state = nms_shared_1.SessionState.CONNECTING;
        this.conf = lodash_1.default.cloneDeep(conf);
        this.id = nms_core_1.NodeCoreUtils.generateNewSessionID();
        this.remoteIp = remoteIp;
        this.TAG = tag;
        this.logger = nms_core_1.LoggerFactory.getLogger(`${this.TAG} ${this.id}`);
        nms_core_1.context.nodeEvent.emit('preConnect', this);
        nms_core_1.context.sessions.set(this.id, this);
        nms_core_1.context.idlePlayers.add(this.id);
        this.state = nms_shared_1.SessionState.CONNECTED;
        nms_core_1.context.nodeEvent.emit('postConnect', this);
    }
    cleanup() {
        this.broadcast = null;
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
        return this.remoteIp === 'localhost' ||
            this.remoteIp.startsWith('127.') ||
            this.remoteIp === '::1' ||
            this.remoteIp === '::ffff:127.0.0.1' ||
            this.remoteIp.startsWith('::ffff:127.');
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
        if (query?.parentId) {
            this._parentId = query.parentId;
        }
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
        if (this._broadcast) {
            nms_core_1.context.nodeEvent.off('offline', this.onBroadcastOffline);
            nms_core_1.context.nodeEvent.off('postDone', this.onBroadcastStop);
        }
        this._broadcast = value;
        if (value) {
            nms_core_1.context.nodeEvent.on('offline', this.onBroadcastOffline);
            nms_core_1.context.nodeEvent.on('postDone', this.onBroadcastStop);
        }
    }
    onBroadcastOffline = (broadcast) => {
        if (broadcast === this.broadcast) {
            this.logger.log(`[session] broadcast went offline`);
            this.onOffline();
            if (this._isManualStop) {
                this.cleanup();
            }
        }
    };
    onBroadcastStop = (broadcast) => {
        if (broadcast === this.broadcast) {
            this.logger.log(`[session] broadcast stopped`);
            this.stop();
        }
    };
    onOffline() {
        this.stop();
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
    get parentId() {
        return this._parentId;
    }
    set parentId(value) {
        this._parentId = value;
    }
    get state() {
        return this._state;
    }
    set state(value) {
        this._state = value;
    }
    get isManualStop() {
        return this._isManualStop;
    }
    start(...args) {
        this.logger.log(`[session start] state: ${this.state} -> ${nms_shared_1.SessionState.STARTING}`);
        this._isManualStop = false;
        this.state = nms_shared_1.SessionState.STARTING;
    }
    stop(manual = false) {
        if (this.state === nms_shared_1.SessionState.STOPPED || this.state === nms_shared_1.SessionState.STOPPING) {
            return;
        }
        if (manual) {
            this._isManualStop = true;
        }
        this.logger.log(`[session stop] manual=${manual} state: ${this.state} -> ${nms_shared_1.SessionState.STOPPING}`);
        if (this.state !== nms_shared_1.SessionState.RESTARTING) {
            this.state = nms_shared_1.SessionState.STOPPING;
        }
        nms_core_1.context.nodeEvent.emit('preDone', this);
    }
    didStop() {
        if (this.state === nms_shared_1.SessionState.STOPPED) {
            return;
        }
        this.logger.log(`[session didStop] state: ${this.state}`);
        this.endTime = Date.now();
        const stateBeforeEmit = this.state;
        nms_core_1.context.nodeEvent.emit('postDone', this);
        if (this.state === stateBeforeEmit) {
            this.state = nms_shared_1.SessionState.STOPPED;
        }
    }
    restart() {
        this.logger.log(`[session restart] state: ${this.state} -> ${nms_shared_1.SessionState.RESTARTING}`);
        this.state = nms_shared_1.SessionState.RESTARTING;
        nms_core_1.context.nodeEvent.emit('restart', this);
        this.stop();
    }
}
exports.NodeSession = NodeSession;

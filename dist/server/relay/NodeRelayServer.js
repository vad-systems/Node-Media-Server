"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeRelayServer = void 0;
const fs_1 = __importDefault(require("fs"));
const lodash_1 = __importDefault(require("lodash"));
const querystring_1 = __importDefault(require("querystring"));
const index_js_1 = require("../../core/index.js");
const index_js_2 = require("../../types/index.js");
const checkSelectiveTask_js_1 = __importDefault(require("../../util/checkSelectiveTask.js"));
const NodeTaskServer_js_1 = __importDefault(require("../NodeTaskServer.js"));
const NodeRelaySession_js_1 = require("./NodeRelaySession.js");
class NodeRelayServer extends NodeTaskServer_js_1.default {
    constructor() {
        super();
        this.logger = index_js_1.LoggerFactory.getLogger('Relay Server');
    }
    run() {
        const _super = Object.create(null, {
            run: { get: () => super.run }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.run.call(this);
            try {
                fs_1.default.accessSync(this.config.relay.ffmpeg, fs_1.default.constants.X_OK);
            }
            catch (error) {
                this.logger.error(`Node Media Relay Server startup failed. ffmpeg:${this.config.relay.ffmpeg} cannot be executed.`);
                return;
            }
            let version = yield index_js_1.NodeCoreUtils.getFFmpegVersion(this.config.relay.ffmpeg);
            if (version === '' || parseInt(version.split('.')[0]) < 4) {
                this.logger.error('Node Media Relay Server startup failed. ffmpeg requires version 4.0.0 above');
                this.logger.error('Download the latest ffmpeg static program:', index_js_1.NodeCoreUtils.getFFmpegUrl());
                return;
            }
            index_js_1.context.nodeEvent.on('postPublish', this.onPostPublish);
            index_js_1.context.nodeEvent.on('donePublish', this.onDonePublish);
            this.logger.log(`Node Media Relay Server started, ffmpeg version: ${version}`);
        });
    }
    startNewRelaySession(conf, srcId, streamPath, args) {
        for (let session of index_js_1.context.sessions.values()) {
            if (session.getConfig('inPath') === conf.inPath && session.getConfig('ouPath') === conf.ouPath) {
                this.logger.debug('[relay dynamic push] session still running', `srcid=${srcId}`, conf.inPath, 'to', conf.ouPath);
                return null;
            }
        }
        let session = new NodeRelaySession_js_1.NodeRelaySession(conf);
        const id = session.id;
        const broadcast = index_js_1.context.broadcasts.get(streamPath);
        if (broadcast) {
            session.broadcast = broadcast;
            broadcast.subscribers.set(id, session);
        }
        this.logger.log('[relay dynamic push] start', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
        index_js_1.context.sessions.set(id, session);
        session.on('end', (id) => {
            this.logger.log('[relay dynamic push] ended', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
            index_js_1.context.sessions.delete(id);
            if (session.broadcast) {
                session.broadcast.subscribers.delete(id);
            }
            setTimeout(() => {
                if (session.broadcast && session.broadcast.publisher) {
                    this.logger.log('[relay dynamic push] restart', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
                    this.handleTaskMatching(session.broadcast.publisher, '', '');
                }
            }, 1000);
        });
        session.run();
        this.logger.log('[relay dynamic push] started', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
        return session;
    }
    handleTaskMatching(session, app, stream) {
        this.logger.debug('[rtmp postPublish] Check for relays', `id=${session.id}`);
        const { tasks } = this.config.relay;
        if (!tasks) {
            return;
        }
        let i = tasks.length;
        this.logger.debug('[rtmp postPublish] Check for relays', `id=${session.id}`, `app=${app}`, `stream=${stream}`, `i=${i}`);
        while (i--) {
            let taskConf = lodash_1.default.cloneDeep(tasks[i]);
            const edge = !!taskConf.edge && (typeof taskConf.edge === typeof {} ? (taskConf.edge[stream] || taskConf.edge['_default'] || '') : taskConf.edge);
            this.logger.debug('[rtmp postPublish] Check for relays', `id=${session.id}`, `app=${app}`, `stream=${stream}`, `i=${i}`, `edge=${edge}`);
            if (taskConf.mode === index_js_2.RelayMode.PUSH) {
                this.handlePushTask(taskConf, app, session.streamPath, edge, stream, session.streamQuery, session.id);
            }
        }
    }
    handlePushTask(taskConf, app, streamPath, edge, stream, args, id) {
        if (!(0, checkSelectiveTask_js_1.default)(taskConf, app, streamPath)) {
            return;
        }
        let hasApp = edge.match(/rtmp:\/\/([^\/]+)\/([^\/]+)/);
        let sessionConf = Object.assign(Object.assign({}, lodash_1.default.cloneDeep(taskConf)), { ffmpeg: this.config.relay.ffmpeg, inPath: `rtmp://127.0.0.1:${this.config.rtmp.port}${streamPath}`, ouPath: taskConf.appendName === false ? edge : (hasApp ? `${edge}/${stream}` : `${edge}${streamPath}`) });
        if (Object.keys(args).length > 0) {
            sessionConf.ouPath += '?';
            sessionConf.ouPath += querystring_1.default.encode(args);
        }
        this.startNewRelaySession(sessionConf, id, streamPath, args);
    }
    stop() {
        super.stop();
        this.logger.log(`Node Media Relay Server stopped.`);
    }
}
exports.NodeRelayServer = NodeRelayServer;

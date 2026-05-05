"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeRelayServer = void 0;
const fs_1 = __importDefault(require("fs"));
const lodash_1 = __importDefault(require("lodash"));
const querystring_1 = __importDefault(require("querystring"));
const nms_core_1 = require("../../core");
const nms_shared_1 = require("../../shared");
const nms_server_1 = require("../../server");
const nms_plugin_relay_1 = require("./");
class NodeRelayServer extends nms_server_1.NodeTaskServer {
    logger = nms_core_1.LoggerFactory.getLogger('Relay Server');
    constructor() {
        super();
    }
    async run() {
        if (!this.config.relay) {
            this.logger.error(`Node Media Relay Server startup failed. Config relay is missing.`);
            return;
        }
        await super.run();
        try {
            fs_1.default.accessSync(this.config.relay.ffmpeg, fs_1.default.constants.X_OK);
        }
        catch (error) {
            this.logger.error(`Node Media Relay Server startup failed. ffmpeg:${this.config.relay.ffmpeg} cannot be executed.`);
            return;
        }
        let version = await nms_core_1.NodeCoreUtils.getFFmpegVersion(this.config.relay.ffmpeg);
        if (version === '' || parseInt(version.split('.')[0]) < 4) {
            this.logger.error('Node Media Relay Server startup failed. ffmpeg requires version 4.0.0 above');
            this.logger.error('Download the latest ffmpeg static program:', nms_core_1.NodeCoreUtils.getFFmpegUrl());
            return;
        }
        nms_core_1.context.nodeEvent.on('postPublish', this.onPostPublish);
        nms_core_1.context.nodeEvent.on('donePublish', this.onDonePublish);
        this.logger.log(`Node Media Relay Server started, ffmpeg version: ${version}`);
    }
    startNewRelaySession(conf, srcId, streamPath, args) {
        for (let session of nms_core_1.context.sessions.values()) {
            if (session.getConfig('inPath') === conf.inPath && session.getConfig('ouPath') === conf.ouPath) {
                this.logger.debug('[relay dynamic push] session still running', `srcid=${srcId}`, conf.inPath, 'to', conf.ouPath);
                return null;
            }
        }
        let session = new nms_plugin_relay_1.NodeRelaySession(conf);
        const id = session.id;
        const broadcast = nms_core_1.context.broadcasts.get(streamPath);
        if (broadcast) {
            session.broadcast = broadcast;
            broadcast.subscribers.set(id, session);
        }
        this.logger.log('[relay dynamic push] start', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
        session.on('end', (id) => {
            this.logger.log('[relay dynamic push] ended', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
            if (session.broadcast) {
                session.broadcast.subscribers.delete(id);
            }
            if (session.isStop) {
                return;
            }
            setTimeout(() => {
                if (session.broadcast && session.broadcast.publisher) {
                    this.logger.log('[relay dynamic push] restart', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
                    const [app, name] = session.broadcast.publisher.streamPath.split('/').slice(1);
                    this.handleTaskMatching(session.broadcast.publisher, app, name);
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
            if (taskConf.mode === nms_shared_1.RelayMode.PUSH) {
                this.handlePushTask(taskConf, app, session.streamPath, edge, stream, session.streamQuery, session.id);
            }
        }
    }
    handlePushTask(taskConf, app, streamPath, edge, stream, args, id) {
        if (!(0, nms_shared_1.checkSelectiveTask)(taskConf, app, streamPath)) {
            return;
        }
        let hasApp = edge.match(/rtmp:\/\/([^\/]+)\/([^\/]+)/);
        let sessionConf = {
            ...lodash_1.default.cloneDeep(taskConf),
            ffmpeg: this.config.relay.ffmpeg,
            inPath: `rtmp://127.0.0.1:${this.config.rtmp.port}${streamPath}`,
            ouPath: taskConf.appendName === false ? edge : (hasApp ? `${edge}/${stream}` : `${edge}${streamPath}`),
            name: stream,
        };
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

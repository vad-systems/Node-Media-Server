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
            this.logger.error(`[Relay] Server startup failed. Config relay is missing.`);
            return;
        }
        // Cleanup any leftover relay sessions
        for (let session of nms_core_1.context.sessions.values()) {
            if (session instanceof nms_plugin_relay_1.NodeRelaySession) {
                session.stop();
                session.cleanup();
            }
        }
        await super.run();
        try {
            fs_1.default.accessSync(this.config.relay.ffmpeg, fs_1.default.constants.X_OK);
        }
        catch (error) {
            this.logger.error(`[Relay] Server startup failed. ffmpeg:${this.config.relay.ffmpeg} cannot be executed.`);
            return;
        }
        let version = await nms_core_1.NodeCoreUtils.getFFmpegVersion(this.config.relay.ffmpeg);
        if (version === '' || parseInt(version.split('.')[0]) < 4) {
            this.logger.error('[Relay] Server startup failed. ffmpeg requires version 4.0.0 above');
            this.logger.error('[Relay] Download the latest ffmpeg static program:', nms_core_1.NodeCoreUtils.getFFmpegUrl());
            return;
        }
        this.logger.log(`[Relay] Server started, ffmpeg version: ${version}`);
        this.scanBroadcasts();
    }
    startNewRelaySession(conf, srcId, streamPath, args) {
        for (let session of nms_core_1.context.sessions.values()) {
            if (session instanceof nms_plugin_relay_1.NodeRelaySession &&
                session.getConfig('inPath') === conf.inPath &&
                session.getConfig('ouPath') === conf.ouPath) {
                this.logger.debug(`[Relay] dynamic push session still running: srcId=${srcId} inPath=${conf.inPath} ouPath=${conf.ouPath}`);
                return null;
            }
        }
        let session = new nms_plugin_relay_1.NodeRelaySession(conf);
        session.parentId = srcId;
        const id = session.id;
        const broadcast = nms_core_1.context.broadcasts.get(streamPath);
        if (broadcast) {
            session.broadcast = broadcast;
            broadcast.subscribers.set(id, session);
        }
        this.logger.log(`[Relay] dynamic push start: srcId=${srcId} id=${id} inPath=${conf.inPath} ouPath=${conf.ouPath}`);
        session.on('end', (id) => {
            this.logger.log(`[Relay] dynamic push ended: srcId=${srcId} id=${id} inPath=${conf.inPath} ouPath=${conf.ouPath}`);
            const broadcast = session.broadcast;
            if (broadcast) {
                broadcast.subscribers.delete(id);
            }
            if (!this.isRunning()) {
                return;
            }
            setTimeout(() => {
                if (broadcast && broadcast.publisher) {
                    this.logger.log(`[Relay] dynamic push restart: srcId=${srcId} id=${id} inPath=${conf.inPath} ouPath=${conf.ouPath}`);
                    const [app, name] = broadcast.publisher.streamPath.split('/').slice(1);
                    this.handleTaskMatching(broadcast.publisher, app, name);
                }
            }, 1000);
        });
        session.start();
        this.logger.log(`[Relay] dynamic push started: srcId=${srcId} id=${id} inPath=${conf.inPath} ouPath=${conf.ouPath}`);
        return session;
    }
    handleTaskMatching(session, app, stream) {
        this.logger.debug(`[Relay] check for relays: id=${session.id} app=${app} stream=${stream}`);
        const { tasks } = this.config.relay;
        if (!tasks) {
            return;
        }
        let i = tasks.length;
        while (i--) {
            let taskConf = lodash_1.default.cloneDeep(tasks[i]);
            const edge = !!taskConf.edge && (typeof taskConf.edge === typeof {} ? (taskConf.edge[stream] || taskConf.edge['_default'] || '') : taskConf.edge);
            this.logger.debug(`[Relay] check task ${i}: id=${session.id} app=${app} stream=${stream} edge=${edge}`);
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
        if (Object.keys(args || {}).length > 0) {
            sessionConf.ouPath += '?';
            sessionConf.ouPath += querystring_1.default.encode(args);
        }
        this.startNewRelaySession(sessionConf, id, streamPath, args);
    }
    stop() {
        super.stop();
        for (let session of nms_core_1.context.sessions.values()) {
            if (session instanceof nms_plugin_relay_1.NodeRelaySession) {
                session.stop();
                session.cleanup();
            }
        }
        this.logger.log(`[Relay] Server stopped`);
    }
}
exports.NodeRelayServer = NodeRelayServer;

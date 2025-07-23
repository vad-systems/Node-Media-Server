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
const types_1 = require("./types");
const lodash_1 = __importDefault(require("lodash"));
const fs_1 = __importDefault(require("fs"));
const querystring_1 = __importDefault(require("querystring"));
const node_core_logger_1 = require("./node_core_logger");
const node_relay_session_1 = require("./node_relay_session");
const node_core_ctx_1 = __importDefault(require("./node_core_ctx"));
const node_core_utils_1 = require("./node_core_utils");
class NodeRelayServer {
    constructor(config) {
        this.dynamicSessions = new Map();
        this.config = lodash_1.default.cloneDeep(config);
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                fs_1.default.accessSync(this.config.relay.ffmpeg, fs_1.default.constants.X_OK);
            }
            catch (error) {
                node_core_logger_1.Logger.error(`Node Media Relay Server startup failed. ffmpeg:${this.config.relay.ffmpeg} cannot be executed.`);
                return;
            }
            let version = yield (0, node_core_utils_1.getFFmpegVersion)(this.config.relay.ffmpeg);
            if (version === '' || parseInt(version.split('.')[0]) < 4) {
                node_core_logger_1.Logger.error('Node Media Relay Server startup failed. ffmpeg requires version 4.0.0 above');
                node_core_logger_1.Logger.error('Download the latest ffmpeg static program:', (0, node_core_utils_1.getFFmpegUrl)());
                return;
            }
            node_core_ctx_1.default.nodeEvent.on('postPublish', this.onPostPublish.bind(this));
            node_core_ctx_1.default.nodeEvent.on('donePublish', this.onDonePublish.bind(this));
            node_core_logger_1.Logger.log('Node Media Relay Server started');
        });
    }
    startNewRelaySession(conf, srcId, streamPath, args) {
        for (let session of node_core_ctx_1.default.sessions.values()) {
            if (session.getConfig('inPath') === conf.inPath && session.conf.ouPath === conf.ouPath) {
                node_core_logger_1.Logger.log('[relay dynamic push] session still running', `srcid=${srcId}`, conf.inPath, 'to', conf.ouPath);
                return null;
            }
        }
        let session = new node_relay_session_1.NodeRelaySession(conf);
        const id = session.id;
        node_core_logger_1.Logger.log('[relay dynamic push] start', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
        node_core_ctx_1.default.sessions.set(id, session);
        session.on('end', (id) => {
            node_core_logger_1.Logger.log('[relay dynamic push] ended', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
            node_core_ctx_1.default.sessions.delete(id);
            const dynamicSessionsForSrc = this.dynamicSessions.get(srcId);
            if (dynamicSessionsForSrc) {
                dynamicSessionsForSrc.delete(id);
            }
            setTimeout(() => {
                if (!!srcId && !!node_core_ctx_1.default.sessions.get(srcId)) {
                    node_core_logger_1.Logger.log('[relay dynamic push] restart', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
                    this.onPostPublish(srcId, streamPath, args);
                }
            }, 1000);
        });
        const dynamicSessionsForSrc = this.dynamicSessions.get(srcId);
        if (dynamicSessionsForSrc) {
            dynamicSessionsForSrc.set(id, session);
        }
        else {
            const newMap = new Map();
            newMap.set(id, session);
            this.dynamicSessions.set(srcId, newMap);
        }
        session.run();
        node_core_logger_1.Logger.log('[relay dynamic push] started', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
        return session;
    }
    onPostPublish(id, streamPath, args) {
        node_core_logger_1.Logger.log("[rtmp postPublish] Check for relays", `id=${id}`, `streamPath=${streamPath}`);
        const { tasks, ffmpeg } = this.config.relay;
        if (!tasks) {
            return;
        }
        let regRes = /\/(.*)\/(.*)/gi.exec(streamPath);
        let [app, stream] = lodash_1.default.slice(regRes, 1);
        let i = tasks.length;
        node_core_logger_1.Logger.log("[rtmp postPublish] Check for relays", `id=${id}`, `app=${app}`, `stream=${stream}`, `i=${i}`);
        while (i--) {
            let taskConf = lodash_1.default.cloneDeep(tasks[i]);
            let isPush = taskConf.mode === types_1.Mode.PUSH;
            const edge = !!taskConf.edge && (typeof taskConf.edge === typeof {} ? (taskConf.edge[stream] || taskConf.edge["_default"] || "") : taskConf.edge);
            node_core_logger_1.Logger.log("[rtmp postPublish] Check for relays", `id=${id}`, `app=${app}`, `stream=${stream}`, `i=${i}`, `edge=${edge}`);
            if (isPush && app === taskConf.app) {
                let hasApp = edge.match(/rtmp:\/\/([^\/]+)\/([^\/]+)/);
                let sessionConf = Object.assign(Object.assign({}, lodash_1.default.cloneDeep(taskConf)), { ffmpeg, inPath: `rtmp://127.0.0.1:${this.config.rtmp.port}${streamPath}`, ouPath: taskConf.appendName === false ? edge : (hasApp ? `${edge}/${stream}` : `${edge}${streamPath}`) });
                if (Object.keys(args).length > 0) {
                    sessionConf.ouPath += '?';
                    sessionConf.ouPath += querystring_1.default.encode(args);
                }
                node_core_logger_1.Logger.log("[rtmp postPublish] patterncheck", `id=${id}`, `app=${app}`, `stream=${stream}`, `i=${i}`, `edge=${edge}`, `pattern=${taskConf.pattern}`);
                if (!!taskConf.pattern && !(new RegExp(taskConf.pattern).test(streamPath))) {
                    continue;
                }
                this.startNewRelaySession(sessionConf, id, streamPath, args);
            }
        }
    }
    onDonePublish(id, streamPath, args) {
        for (let [srcId, sessions] of this.dynamicSessions) {
            if (id === srcId) {
                for (let [_, session] of sessions) {
                    session.end();
                }
                let session = node_core_ctx_1.default.sessions.get(srcId);
                if (session && session instanceof node_relay_session_1.NodeRelaySession) {
                    session.end();
                }
            }
            else {
                for (let [sessionId, session] of sessions) {
                    if (id === sessionId) {
                        session.end();
                    }
                }
            }
        }
    }
    stop() {
        for (let [srcId, sessions] of this.dynamicSessions) {
            for (let [_, session] of sessions) {
                session.end();
            }
            let session = node_core_ctx_1.default.sessions.get(srcId);
            if (session && session instanceof node_relay_session_1.NodeRelaySession) {
                session.end();
            }
        }
    }
}
exports.NodeRelayServer = NodeRelayServer;

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeTransServer = void 0;
const fs_1 = __importDefault(require("fs"));
const lodash_1 = __importDefault(require("lodash"));
const mkdirp = __importStar(require("mkdirp"));
const nms_core_1 = require("../../core");
const nms_shared_1 = require("../../shared");
const nms_server_1 = require("../../server");
const nms_plugin_trans_1 = require("./");
class NodeTransServer extends nms_server_1.NodeTaskServer {
    logger = nms_core_1.LoggerFactory.getLogger('Trans Server');
    constructor() {
        super();
    }
    async run() {
        await super.run();
        const mediaroot = this.config.http.mediaroot;
        const ffmpeg = this.config.trans.ffmpeg;
        try {
            mkdirp.sync(mediaroot.toString());
            fs_1.default.accessSync(mediaroot, fs_1.default.constants.W_OK);
        }
        catch (error) {
            this.logger.error(`Node Media Trans Server startup failed. MediaRoot:${mediaroot} cannot be written.`);
            return;
        }
        try {
            fs_1.default.accessSync(ffmpeg, fs_1.default.constants.X_OK);
        }
        catch (error) {
            this.logger.error(`Node Media Trans Server startup failed. ffmpeg:${ffmpeg} cannot be executed.`);
            return;
        }
        const version = await nms_core_1.NodeCoreUtils.getFFmpegVersion(ffmpeg);
        if (version === '' || parseInt(version.split('.')[0]) < 4) {
            this.logger.error('Node Media Trans Server startup failed. ffmpeg requires version 4.0.0 above');
            this.logger.error('Download the latest ffmpeg static program:', nms_core_1.NodeCoreUtils.getFFmpegUrl());
            return;
        }
        const tasks = this.config.trans.tasks || [];
        let i = tasks.length;
        let apps = '';
        while (i--) {
            apps += tasks[i].app;
            apps += ' ';
        }
        this.logger.log(`Node Media Trans Server started for apps: [${apps}] , MediaRoot: ${mediaroot}, ffmpeg version: ${version}`);
    }
    handleTaskMatching(session, app, name) {
        const { tasks, ffmpeg } = this.config.trans;
        let i = tasks.length;
        const mediaroot = this.config.http.mediaroot;
        while (i--) {
            let taskConfig = lodash_1.default.cloneDeep(tasks[i]);
            let sessionConfig = {
                ...lodash_1.default.cloneDeep(taskConfig),
                ffmpeg,
                mediaroot: mediaroot,
                rtmpPort: this.config.rtmp.port,
                streamPath: session.streamPath,
                streamApp: app,
                streamName: name,
            };
            sessionConfig.args = session.streamQuery;
            if (!(0, nms_shared_1.checkSelectiveTask)(taskConfig, app, session.streamPath)) {
                continue;
            }
            let isExisting = false;
            for (let s of nms_core_1.context.sessions.values()) {
                if (s.TAG === 'trans' && s.streamPath === session.streamPath && lodash_1.default.isMatch(s.getConfig(), taskConfig)) {
                    isExisting = true;
                    break;
                }
            }
            if (isExisting) {
                this.logger.debug('[trans] session still running', `srcid=${session.id}`, `streamPath=${session.streamPath}`, taskConfig);
                continue;
            }
            let sess = new nms_plugin_trans_1.NodeTransSession(sessionConfig);
            if (session.broadcast) {
                sess.broadcast = session.broadcast;
                session.broadcast.subscribers.set(sess.id, sess);
            }
            const id = sess.id;
            sess.on('end', (id) => {
                this.logger.log('[trans] ended', `id=${id}`, sessionConfig.streamPath);
                if (sess.broadcast) {
                    sess.broadcast.subscribers.delete(id);
                }
                if (sess.isStop) {
                    return;
                }
                setTimeout(() => {
                    if (sess.broadcast && sess.broadcast.publisher) {
                        this.logger.log('[trans] restart', `id=${id}`, sessionConfig.streamPath);
                        this.handleTaskMatching(sess.broadcast.publisher, app, name);
                    }
                }, 1000);
            });
            sess.run();
        }
    }
    stop() {
        super.stop();
        this.logger.log(`Node Media Trans Server stopped.`);
    }
}
exports.NodeTransServer = NodeTransServer;

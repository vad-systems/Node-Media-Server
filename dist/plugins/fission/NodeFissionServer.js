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
exports.NodeFissionServer = void 0;
const fs_1 = __importDefault(require("fs"));
const lodash_1 = __importDefault(require("lodash"));
const mkdirp = __importStar(require("mkdirp"));
const nms_core_1 = require("../../core");
const nms_shared_1 = require("../../shared");
const nms_server_1 = require("../../server");
const nms_plugin_fission_1 = require("./");
class NodeFissionServer extends nms_server_1.NodeTaskServer {
    logger = nms_core_1.LoggerFactory.getLogger('Fission Server');
    constructor() {
        super();
    }
    async run() {
        await super.run();
        try {
            mkdirp.sync(this.config.http.mediaroot.toString());
            fs_1.default.accessSync(this.config.http.mediaroot, fs_1.default.constants.W_OK);
        }
        catch (error) {
            this.logger.error(`Node Media Fission Server startup failed. MediaRoot:${this.config.http.mediaroot} cannot be written.`);
            return;
        }
        try {
            fs_1.default.accessSync(this.config.fission.ffmpeg, fs_1.default.constants.X_OK);
        }
        catch (error) {
            this.logger.error(`Node Media Fission Server startup failed. ffmpeg:${this.config.fission.ffmpeg} cannot be executed.`);
            return;
        }
        let version = await nms_core_1.NodeCoreUtils.getFFmpegVersion(this.config.fission.ffmpeg);
        if (version === '' || parseInt(version.split('.')[0]) < 4) {
            this.logger.error('Node Media Fission Server startup failed. ffmpeg requires version 4.0.0 above');
            this.logger.error('Download the latest ffmpeg static program:', nms_core_1.NodeCoreUtils.getFFmpegUrl());
            return;
        }
        this.logger.log(`Node Media Fission Server started, MediaRoot: ${this.config.http.mediaroot}, ffmpeg version: ${version}`);
    }
    handleTaskMatching(session, app, name) {
        const srcId = session.id;
        this.logger.debug('[fission postPublish] Check for fission tasks', `id=${srcId}`, `streamPath=${session.streamPath}`);
        for (let task of this.config.fission.tasks) {
            if (!(0, nms_shared_1.checkSelectiveTask)(task, app, session.streamPath)) {
                this.logger.debug('[fission] pattern check failed, skip', `pattern=${task.pattern}`, `srcid=${srcId}`, `app=${app}`, `streamPath=${session.streamPath}`, task);
                continue;
            }
            let isExisting = false;
            for (let s of nms_core_1.context.sessions.values()) {
                if (s.TAG === 'fission' && s.streamPath === session.streamPath && lodash_1.default.isEqual(s.getConfig('model'), task.model)) {
                    isExisting = true;
                    break;
                }
            }
            if (isExisting) {
                this.logger.debug('[fission] session still running', `srcid=${srcId}`, `streamPath=${session.streamPath}`, task);
                continue;
            }
            const broadcast = session.broadcast;
            const nameSegments = name.split('_');
            if (!broadcast) {
                this.logger.warn('No broadcast found', srcId);
                continue;
            }
            if (broadcast.publisher.isLocal() && nameSegments.length > 0 && !isNaN(parseInt(nameSegments[nameSegments.length - 1]))) {
                this.logger.debug('[fission] duplication check failed, skip', `pattern=${task.pattern}`, `srcid=${srcId}`, `app=${app}`, `streamPath=${session.streamPath}`, task);
                continue;
            }
            let taskConf = lodash_1.default.cloneDeep(task);
            let sessionConf = {
                ...lodash_1.default.cloneDeep(taskConf),
                ffmpeg: this.config.fission.ffmpeg,
                mediaroot: this.config.http.mediaroot,
                rtmpPort: this.config.rtmp.port,
                streamPath: session.streamPath,
                streamApp: app,
                streamName: name,
            };
            sessionConf.args = session.streamQuery;
            let sess = new nms_plugin_fission_1.NodeFissionSession(sessionConf);
            const id = sess.id;
            if (session.broadcast) {
                sess.broadcast = session.broadcast;
                session.broadcast.subscribers.set(sess.id, sess);
            }
            this.logger.log('[fission] start', `srcid=${srcId}`, `id=${id}`, sessionConf.streamPath, `x${taskConf.model.length}`);
            sess.on('end', (id) => {
                this.logger.log('[fission] ended', `srcid=${srcId}`, `id=${id}`, sessionConf.streamPath, `x${taskConf.model.length}`);
                if (sess.broadcast) {
                    sess.broadcast.subscribers.delete(id);
                }
                if (sess.isStop) {
                    return;
                }
                setTimeout(() => {
                    if (sess.broadcast && sess.broadcast.publisher) {
                        this.logger.log('[fission] restart', `srcid=${srcId}`, `id=${id}`, sessionConf.streamPath, `x${taskConf.model.length}`);
                        this.handleTaskMatching(sess.broadcast.publisher, app, name);
                    }
                }, 1000);
            });
            sess.run();
            this.logger.log('[fission] started', `srcid=${srcId}`, `id=${id}`, sessionConf.streamPath, `x${taskConf.model.length}`);
        }
    }
    stop() {
        super.stop();
        this.logger.log(`Node Media Fission Server stopped.`);
    }
}
exports.NodeFissionServer = NodeFissionServer;

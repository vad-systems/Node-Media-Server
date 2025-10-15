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
exports.NodeFissionServer = void 0;
const fs_1 = __importDefault(require("fs"));
const lodash_1 = __importDefault(require("lodash"));
const index_js_1 = require("./core/index.js");
const node_configurable_server_js_1 = __importDefault(require("./node_configurable_server.js"));
const node_fission_session_js_1 = require("./node_fission_session.js");
const node_relay_session_js_1 = require("./node_relay_session.js");
const mkdirp = __importStar(require("mkdirp"));
const asRegExp_js_1 = __importDefault(require("./util/asRegExp.js"));
class NodeFissionServer extends node_configurable_server_js_1.default {
    constructor(config) {
        super(config);
        this.onPostPublish = this.onPostPublish.bind(this);
        this.onDonePublish = this.onDonePublish.bind(this);
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            this.fissionSessions = new Map();
            try {
                mkdirp.sync(this.config.http.mediaroot.toString());
                fs_1.default.accessSync(this.config.http.mediaroot, fs_1.default.constants.W_OK);
            }
            catch (error) {
                index_js_1.Logger.error(`Node Media Fission Server startup failed. MediaRoot:${this.config.http.mediaroot} cannot be written.`);
                return;
            }
            try {
                fs_1.default.accessSync(this.config.fission.ffmpeg, fs_1.default.constants.X_OK);
            }
            catch (error) {
                index_js_1.Logger.error(`Node Media Fission Server startup failed. ffmpeg:${this.config.fission.ffmpeg} cannot be executed.`);
                return;
            }
            let version = yield index_js_1.NodeCoreUtils.getFFmpegVersion(this.config.fission.ffmpeg);
            if (version === '' || parseInt(version.split('.')[0]) < 4) {
                index_js_1.Logger.error('Node Media Fission Server startup failed. ffmpeg requires version 4.0.0 above');
                index_js_1.Logger.error('Download the latest ffmpeg static program:', index_js_1.NodeCoreUtils.getFFmpegUrl());
                return;
            }
            index_js_1.context.nodeEvent.on('postPublish', this.onPostPublish);
            index_js_1.context.nodeEvent.on('donePublish', this.onDonePublish);
            index_js_1.Logger.log(`Node Media Fission Server started, MediaRoot: ${this.config.http.mediaroot}, ffmpeg version: ${version}`);
        });
    }
    onPostPublish(srcId, streamPath, args) {
        let regRes = /\/(.*)\/(.*)/gi.exec(streamPath);
        let [app, name] = lodash_1.default.slice(regRes, 1);
        for (let task of this.config.fission.tasks) {
            const pattern = (0, asRegExp_js_1.default)(task.pattern);
            if (app === task.app && (!pattern || pattern.test(streamPath))) {
                let s = index_js_1.context.sessions.get(srcId);
                const nameSegments = name.split('_');
                if (s.isLocal && nameSegments.length > 0 && !isNaN(parseInt(nameSegments[nameSegments.length - 1]))) {
                    continue;
                }
                let taskConf = lodash_1.default.cloneDeep(task);
                let sessionConf = Object.assign(Object.assign({}, lodash_1.default.cloneDeep(taskConf)), { ffmpeg: this.config.fission.ffmpeg, mediaroot: this.config.http.mediaroot, rtmpPort: this.config.rtmp.port, streamPath: streamPath, streamApp: app, streamName: name });
                sessionConf.args = args;
                let session = new node_fission_session_js_1.NodeFissionSession(sessionConf);
                const id = session.id;
                index_js_1.Logger.log('[fission] start', `srcid=${srcId}`, `id=${id}`, sessionConf.streamPath, `x${taskConf.model.length}`);
                index_js_1.context.sessions.set(id, session);
                session.on('end', (id) => {
                    this.fissionSessions.delete(id);
                    index_js_1.Logger.log('[fission] ended', `srcid=${srcId}`, `id=${id}`, sessionConf.streamPath, `x${taskConf.model.length}`);
                    index_js_1.context.sessions.delete(id);
                    const fissionSessionsForSrc = this.fissionSessions.get(srcId);
                    if (fissionSessionsForSrc) {
                        fissionSessionsForSrc.delete(id);
                    }
                    setTimeout(() => {
                        if (!!srcId && !!index_js_1.context.sessions.get(srcId)) {
                            index_js_1.Logger.log('[fission] restart', `srcid=${srcId}`, `id=${id}`, sessionConf.streamPath, `x${taskConf.model.length}`);
                            this.onPostPublish(srcId, streamPath, args);
                        }
                    }, 1000);
                });
                const fissionSessionsForSrc = this.fissionSessions.get(srcId);
                if (fissionSessionsForSrc) {
                    fissionSessionsForSrc.set(id, session);
                }
                else {
                    const newMap = new Map();
                    newMap.set(id, session);
                    this.fissionSessions.set(srcId, newMap);
                }
                session.run();
                index_js_1.Logger.log('[fission] started', `srcid=${srcId}`, `id=${id}`, sessionConf.streamPath, `x${taskConf.model.length}`);
            }
        }
    }
    onDonePublish(id, streamPath, args) {
        for (let [srcId, sessions] of this.fissionSessions) {
            if (id === srcId) {
                for (let [_, session] of sessions) {
                    session.end();
                }
                let session = index_js_1.context.sessions.get(srcId);
                if (session && session instanceof node_relay_session_js_1.NodeRelaySession) {
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
        index_js_1.context.nodeEvent.off('postPublish', this.onPostPublish);
        index_js_1.context.nodeEvent.off('donePublish', this.onDonePublish);
        for (let [srcId, sessions] of this.fissionSessions) {
            for (let [_, session] of sessions) {
                session.end();
            }
            let session = index_js_1.context.sessions.get(srcId);
            if (session && session instanceof node_relay_session_js_1.NodeRelaySession) {
                session.end();
            }
        }
        index_js_1.Logger.log(`Node Media Fission Server stopped.`);
    }
}
exports.NodeFissionServer = NodeFissionServer;

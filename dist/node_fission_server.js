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
exports.NodeFissionServer = void 0;
const lodash_1 = __importDefault(require("lodash"));
const fs_1 = __importDefault(require("fs"));
const node_core_logger_1 = require("./node_core_logger");
const node_fission_session_1 = require("./node_fission_session");
const node_core_ctx_1 = __importDefault(require("./node_core_ctx"));
const node_core_utils_1 = require("./node_core_utils");
const mkdirp = require('mkdirp');
class NodeFissionServer {
    constructor(config) {
        this.fissionSessions = new Map();
        this.config = config;
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                mkdirp.sync(this.config.http.mediaroot);
                fs_1.default.accessSync(this.config.http.mediaroot, fs_1.default.constants.W_OK);
            }
            catch (error) {
                node_core_logger_1.Logger.error(`Node Media Fission Server startup failed. MediaRoot:${this.config.http.mediaroot} cannot be written.`);
                return;
            }
            try {
                fs_1.default.accessSync(this.config.fission.ffmpeg, fs_1.default.constants.X_OK);
            }
            catch (error) {
                node_core_logger_1.Logger.error(`Node Media Fission Server startup failed. ffmpeg:${this.config.fission.ffmpeg} cannot be executed.`);
                return;
            }
            let version = yield (0, node_core_utils_1.getFFmpegVersion)(this.config.fission.ffmpeg);
            if (version === '' || parseInt(version.split('.')[0]) < 4) {
                node_core_logger_1.Logger.error('Node Media Fission Server startup failed. ffmpeg requires version 4.0.0 above');
                node_core_logger_1.Logger.error('Download the latest ffmpeg static program:', (0, node_core_utils_1.getFFmpegUrl)());
                return;
            }
            node_core_ctx_1.default.nodeEvent.on('postPublish', this.onPostPublish.bind(this));
            node_core_ctx_1.default.nodeEvent.on('donePublish', this.onDonePublish.bind(this));
            node_core_logger_1.Logger.log(`Node Media Fission Server started, MediaRoot: ${this.config.http.mediaroot}, ffmpeg version: ${version}`);
        });
    }
    onPostPublish(id, streamPath, args) {
        let regRes = /\/(.*)\/(.*)/gi.exec(streamPath);
        let [app, name] = lodash_1.default.slice(regRes, 1);
        for (let task of this.config.fission.tasks) {
            regRes = /(.*)\/(.*)/gi.exec(task.rule);
            let [ruleApp, ruleName] = lodash_1.default.slice(regRes, 1);
            if ((app === ruleApp || ruleApp === '*') && (name === ruleName || ruleName === '*')) {
                let s = node_core_ctx_1.default.sessions.get(id);
                const nameSegments = name.split('_');
                if (s.isLocal && nameSegments.length > 0 && !isNaN(parseInt(nameSegments[nameSegments.length - 1]))) {
                    continue;
                }
                let taskConf = lodash_1.default.cloneDeep(task);
                let sessionConf = Object.assign(Object.assign({}, lodash_1.default.cloneDeep(taskConf)), { ffmpeg: this.config.fission.ffmpeg, mediaroot: this.config.http.mediaroot, rtmpPort: this.config.rtmp.port, streamPath: streamPath, streamApp: app, streamName: name });
                sessionConf.args = args;
                let session = new node_fission_session_1.NodeFissionSession(sessionConf);
                this.fissionSessions.set(id, session);
                session.on('end', (id) => {
                    this.fissionSessions.delete(id);
                });
                session.run();
            }
        }
    }
    onDonePublish(id, streamPath, args) {
        let session = this.fissionSessions.get(id);
        if (session) {
            session.end();
        }
    }
    stop() {
        this.fissionSessions.forEach(session => {
            session.end();
        });
    }
}
exports.NodeFissionServer = NodeFissionServer;

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
exports.NodeTransServer = void 0;
const lodash_1 = __importDefault(require("lodash"));
const fs_1 = __importDefault(require("fs"));
const node_core_logger_1 = require("./node_core_logger");
const node_trans_session_1 = require("./node_trans_session");
const node_core_ctx_1 = __importDefault(require("./node_core_ctx"));
const node_core_utils_1 = require("./node_core_utils");
const mkdirp = require('mkdirp');
class NodeTransServer {
    constructor(config) {
        this.transSessions = new Map();
        this.config = config;
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const mediaroot = this.config.http.mediaroot;
            const ffmpeg = this.config.trans.ffmpeg;
            try {
                mkdirp.sync(mediaroot);
                fs_1.default.accessSync(mediaroot, fs_1.default.constants.W_OK);
            }
            catch (error) {
                node_core_logger_1.Logger.error(`Node Media Trans Server startup failed. MediaRoot:${mediaroot} cannot be written.`);
                return;
            }
            try {
                fs_1.default.accessSync(ffmpeg, fs_1.default.constants.X_OK);
            }
            catch (error) {
                node_core_logger_1.Logger.error(`Node Media Trans Server startup failed. ffmpeg:${ffmpeg} cannot be executed.`);
                return;
            }
            const version = yield (0, node_core_utils_1.getFFmpegVersion)(ffmpeg);
            if (version === '' || parseInt(version.split('.')[0]) < 4) {
                node_core_logger_1.Logger.error('Node Media Trans Server startup failed. ffmpeg requires version 4.0.0 above');
                node_core_logger_1.Logger.error('Download the latest ffmpeg static program:', (0, node_core_utils_1.getFFmpegUrl)());
                return;
            }
            const tasks = this.config.trans.tasks || [];
            let i = tasks.length;
            let apps = '';
            while (i--) {
                apps += tasks[i].app;
                apps += ' ';
            }
            node_core_ctx_1.default.nodeEvent.on('postPublish', this.onPostPublish.bind(this));
            node_core_ctx_1.default.nodeEvent.on('donePublish', this.onDonePublish.bind(this));
            node_core_logger_1.Logger.log(`Node Media Trans Server started for apps: [${apps}] , MediaRoot: ${mediaroot}, ffmpeg version: ${version}`);
        });
    }
    onPostPublish(id, streamPath, args) {
        const regRes = /\/(.*)\/(.*)/gi.exec(streamPath);
        const [app, name] = lodash_1.default.slice(regRes, 1);
        const { tasks, ffmpeg } = this.config.trans;
        let i = tasks.length;
        const mediaroot = this.config.http.mediaroot;
        while (i--) {
            let taskConfig = lodash_1.default.cloneDeep(tasks[i]);
            let sessionConfig = Object.assign(Object.assign({}, lodash_1.default.cloneDeep(taskConfig)), { ffmpeg, mediaroot: mediaroot, rtmpPort: this.config.rtmp.port, streamPath: streamPath, streamApp: app, streamName: name });
            sessionConfig.args = args;
            if (app === taskConfig.app) {
                let session = new node_trans_session_1.NodeTransSession(sessionConfig);
                this.transSessions.set(id, session);
                session.on('end', (id) => {
                    this.transSessions.delete(id);
                });
                session.run();
            }
        }
    }
    onDonePublish(id, streamPath, args) {
        const session = this.transSessions.get(id);
        if (session) {
            session.end();
        }
    }
}
exports.NodeTransServer = NodeTransServer;

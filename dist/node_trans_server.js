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
exports.NodeTransServer = void 0;
const fs_1 = __importDefault(require("fs"));
const lodash_1 = __importDefault(require("lodash"));
const index_js_1 = require("./core/index.js");
const node_trans_session_js_1 = require("./node_trans_session.js");
const mkdirp = __importStar(require("mkdirp"));
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
                mkdirp.sync(mediaroot.toString());
                fs_1.default.accessSync(mediaroot, fs_1.default.constants.W_OK);
            }
            catch (error) {
                index_js_1.Logger.error(`Node Media Trans Server startup failed. MediaRoot:${mediaroot} cannot be written.`);
                return;
            }
            try {
                fs_1.default.accessSync(ffmpeg, fs_1.default.constants.X_OK);
            }
            catch (error) {
                index_js_1.Logger.error(`Node Media Trans Server startup failed. ffmpeg:${ffmpeg} cannot be executed.`);
                return;
            }
            const version = yield index_js_1.NodeCoreUtils.getFFmpegVersion(ffmpeg);
            if (version === '' || parseInt(version.split('.')[0]) < 4) {
                index_js_1.Logger.error('Node Media Trans Server startup failed. ffmpeg requires version 4.0.0 above');
                index_js_1.Logger.error('Download the latest ffmpeg static program:', index_js_1.NodeCoreUtils.getFFmpegUrl());
                return;
            }
            const tasks = this.config.trans.tasks || [];
            let i = tasks.length;
            let apps = '';
            while (i--) {
                apps += tasks[i].app;
                apps += ' ';
            }
            index_js_1.context.nodeEvent.on('postPublish', this.onPostPublish.bind(this));
            index_js_1.context.nodeEvent.on('donePublish', this.onDonePublish.bind(this));
            index_js_1.Logger.log(`Node Media Trans Server started for apps: [${apps}] , MediaRoot: ${mediaroot}, ffmpeg version: ${version}`);
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
                let session = new node_trans_session_js_1.NodeTransSession(sessionConfig);
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

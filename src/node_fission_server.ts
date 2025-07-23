import _ from 'lodash';
import fs from 'fs';
import {Logger} from "./node_core_logger";
import {NodeFissionSession} from "./node_fission_session";
import context from './node_core_ctx';
import {getFFmpegVersion, getFFmpegUrl} from './node_core_utils';
import {Arguments, Config, FissionSessionConfig, SessionID} from "./types";

const mkdirp = require('mkdirp');

class NodeFissionServer {
    config: Config;
    fissionSessions: Map<SessionID, NodeFissionSession> = new Map();

    constructor(config: Config) {
        this.config = config;
    }

    async run() {
        try {
            mkdirp.sync(this.config.http.mediaroot);
            fs.accessSync(this.config.http.mediaroot, fs.constants.W_OK);
        } catch (error) {
            Logger.error(`Node Media Fission Server startup failed. MediaRoot:${this.config.http.mediaroot} cannot be written.`);
            return;
        }

        try {
            fs.accessSync(this.config.fission.ffmpeg, fs.constants.X_OK);
        } catch (error) {
            Logger.error(`Node Media Fission Server startup failed. ffmpeg:${this.config.fission.ffmpeg} cannot be executed.`);
            return;
        }

        let version = await getFFmpegVersion(this.config.fission.ffmpeg);
        if (version === '' || parseInt(version.split('.')[0]) < 4) {
            Logger.error('Node Media Fission Server startup failed. ffmpeg requires version 4.0.0 above');
            Logger.error('Download the latest ffmpeg static program:', getFFmpegUrl());
            return;
        }

        context.nodeEvent.on('postPublish', this.onPostPublish.bind(this));
        context.nodeEvent.on('donePublish', this.onDonePublish.bind(this));
        Logger.log(`Node Media Fission Server started, MediaRoot: ${this.config.http.mediaroot}, ffmpeg version: ${version}`);
    }

    onPostPublish(id: SessionID, streamPath: string, args: Arguments) {
        let regRes = /\/(.*)\/(.*)/gi.exec(streamPath);
        let [app, name] = _.slice(regRes, 1);
        for (let task of this.config.fission.tasks) {
            regRes = /(.*)\/(.*)/gi.exec(task.rule);
            let [ruleApp, ruleName] = _.slice(regRes, 1);
            if ((app === ruleApp || ruleApp === '*') && (name === ruleName || ruleName === '*')) {
                let s = context.sessions.get(id);
                const nameSegments = name.split('_');
                if (s.isLocal && nameSegments.length > 0 && !isNaN(parseInt(nameSegments[nameSegments.length - 1]))) {
                    continue;
                }
                let taskConf = _.cloneDeep(task);
                let sessionConf: FissionSessionConfig = {
                    ..._.cloneDeep(taskConf),
                    ffmpeg: this.config.fission.ffmpeg,
                    mediaroot: this.config.http.mediaroot,
                    rtmpPort: this.config.rtmp.port,
                    streamPath: streamPath,
                    streamApp: app,
                    streamName: name,
                };
                sessionConf.args = args;
                let session = new NodeFissionSession(sessionConf);
                this.fissionSessions.set(id, session);
                session.on('end', (id) => {
                    this.fissionSessions.delete(id);
                });
                session.run();
            }
        }
    }

    onDonePublish(id: SessionID, streamPath: string, args: Arguments) {
        let session = this.fissionSessions.get(id);
        if (session) {
            session.end();
        }
    }

    stop() {
        this.fissionSessions.forEach(session => {
            session.end();
        })
    }
}

export { NodeFissionServer };

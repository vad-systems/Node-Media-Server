import _ from 'lodash';
import fs from 'fs';
import {Logger} from "./node_core_logger";
import {NodeFissionSession} from "./node_fission_session";
import context from './node_core_ctx';
import {getFFmpegVersion, getFFmpegUrl} from './node_core_utils';
import {Arguments, Config, FissionSessionConfig, SessionID} from "./types";
import {NodeRelaySession} from "./node_relay_session";

const mkdirp = require('mkdirp');

class NodeFissionServer {
    config: Config;
    fissionSessions: Map<SessionID, Map<SessionID, NodeFissionSession>> = new Map();

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

    onPostPublish(srcId: SessionID, streamPath: string, args: Arguments) {
        let regRes = /\/(.*)\/(.*)/gi.exec(streamPath);
        let [app, name] = _.slice(regRes, 1);
        for (let task of this.config.fission.tasks) {
            regRes = /(.*)\/(.*)/gi.exec(task.rule);
            let [ruleApp, ruleName] = _.slice(regRes, 1);
            if ((app === ruleApp || ruleApp === '*') && (name === ruleName || ruleName === '*')) {
                let s = context.sessions.get(srcId);
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
                const id = session.id;
                Logger.log('[fission] start', `srcid=${srcId}`, `id=${id}`, sessionConf.streamPath, `x${taskConf.model.length}`);
                context.sessions.set(id, session);
                session.on('end', (id) => {
                    this.fissionSessions.delete(id);

                    Logger.log('[fission] ended', `srcid=${srcId}`, `id=${id}`, sessionConf.streamPath, `x${taskConf.model.length}`);
                    context.sessions.delete(id);
                    const fissionSessionsForSrc = this.fissionSessions.get(srcId);
                    if (fissionSessionsForSrc) {
                        fissionSessionsForSrc.delete(id);
                    }
                    setTimeout(() => {
                        if (!!srcId && !!context.sessions.get(srcId)) {
                            Logger.log('[fission] restart', `srcid=${srcId}`, `id=${id}`, sessionConf.streamPath, `x${taskConf.model.length}`);
                            this.onPostPublish(srcId, streamPath, args);
                        }
                    }, 1000);
                });
                const fissionSessionsForSrc = this.fissionSessions.get(srcId);
                if (fissionSessionsForSrc) {
                    fissionSessionsForSrc.set(id, session);
                } else {
                    const newMap = new Map();
                    newMap.set(id, session);
                    this.fissionSessions.set(srcId, newMap);
                }
                session.run();
                Logger.log('[fission] started', `srcid=${srcId}`, `id=${id}`, sessionConf.streamPath, `x${taskConf.model.length}`);
            }
        }
    }

    onDonePublish(id: SessionID, streamPath: string, args: Arguments) {
        for (let [srcId, sessions] of this.fissionSessions) {
            if (id === srcId) {
                for (let [_, session] of sessions) {
                    session.end();
                }
                let session = context.sessions.get(srcId);

                if (session && session instanceof NodeRelaySession) {
                    session.end();
                }
            } else {
                for (let [sessionId, session] of sessions) {
                    if (id === sessionId) {
                        session.end();
                    }
                }
            }
        }
    }

    stop() {
        for (let [srcId, sessions] of this.fissionSessions) {
            for (let [_, session] of sessions) {
                session.end();
            }

            let session = context.sessions.get(srcId);

            if (session && session instanceof NodeRelaySession) {
                session.end();
            }
        }
    }
}

export {NodeFissionServer};

import {Arguments, Config, Mode, RelaySessionConfig, SessionID} from "./types";
import _ from 'lodash';
import fs from 'fs';
import querystring from 'querystring';
import {Logger} from './node_core_logger';
import {NodeRelaySession} from './node_relay_session';
import context from './node_core_ctx';
import {getFFmpegVersion, getFFmpegUrl} from './node_core_utils';

class NodeRelayServer {
    config: Config;
    dynamicSessions: Map<SessionID, Map<SessionID, NodeRelaySession>> = new Map();

    constructor(config: Config) {
        this.config = _.cloneDeep(config);
    }

    async run() {
        try {
            fs.accessSync(this.config.relay.ffmpeg, fs.constants.X_OK);
        } catch (error) {
            Logger.error(`Node Media Relay Server startup failed. ffmpeg:${this.config.relay.ffmpeg} cannot be executed.`);
            return;
        }

        let version = await getFFmpegVersion(this.config.relay.ffmpeg);
        if (version === '' || parseInt(version.split('.')[0]) < 4) {
            Logger.error('Node Media Relay Server startup failed. ffmpeg requires version 4.0.0 above');
            Logger.error('Download the latest ffmpeg static program:', getFFmpegUrl());
            return;
        }

        context.nodeEvent.on('postPublish', this.onPostPublish.bind(this));
        context.nodeEvent.on('donePublish', this.onDonePublish.bind(this));

        Logger.log('Node Media Relay Server started');
    }

    startNewRelaySession(conf: RelaySessionConfig, srcId: SessionID, streamPath: string, args: Arguments) {
        for (let session of context.sessions.values()) {
            if (session.getConfig('inPath') === conf.inPath && session.conf.ouPath === conf.ouPath) {
                Logger.log('[relay dynamic push] session still running', `srcid=${srcId}`, conf.inPath, 'to', conf.ouPath);
                return null;
            }
        }

        let session = new NodeRelaySession(conf);
        const id = session.id;
        Logger.log('[relay dynamic push] start', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
        context.sessions.set(id, session);
        session.on('end', (id) => {
            Logger.log('[relay dynamic push] ended', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
            context.sessions.delete(id);
            const dynamicSessionsForSrc = this.dynamicSessions.get(srcId);
            if (dynamicSessionsForSrc) {
                dynamicSessionsForSrc.delete(id);
            }
            setTimeout(() => {
                if (!!srcId && !!context.sessions.get(srcId)) {
                    Logger.log('[relay dynamic push] restart', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
                    this.onPostPublish(srcId, streamPath, args);
                }
            }, 1000);
        });
        const dynamicSessionsForSrc = this.dynamicSessions.get(srcId);
        if (dynamicSessionsForSrc) {
            dynamicSessionsForSrc.set(id, session);
        } else {
            const newMap = new Map();
            newMap.set(id, session);
            this.dynamicSessions.set(srcId, newMap);
        }
        session.run();
        Logger.log('[relay dynamic push] started', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
        return session;
    }

    onPostPublish(id: SessionID, streamPath: string, args: Arguments) {
        Logger.log("[rtmp postPublish] Check for relays", `id=${id}`, `streamPath=${streamPath}`);
        const {tasks, ffmpeg} = this.config.relay;
        if (!tasks) {
            return;
        }
        let regRes = /\/(.*)\/(.*)/gi.exec(streamPath);
        let [app, stream] = _.slice(regRes, 1);
        let i = tasks.length;
        Logger.log("[rtmp postPublish] Check for relays", `id=${id}`, `app=${app}`, `stream=${stream}`, `i=${i}`);
        while (i--) {
            let taskConf = _.cloneDeep(tasks[i]);
            let isPush = taskConf.mode === Mode.PUSH;
            const edge = !!taskConf.edge && (typeof taskConf.edge === typeof {} ? (taskConf.edge[stream] || taskConf.edge["_default"] || "") : taskConf.edge);
            Logger.log("[rtmp postPublish] Check for relays", `id=${id}`, `app=${app}`, `stream=${stream}`, `i=${i}`, `edge=${edge}`);
            if (isPush && app === taskConf.app) {
                let hasApp = edge.match(/rtmp:\/\/([^\/]+)\/([^\/]+)/);
                let sessionConf: RelaySessionConfig = {
                    ..._.cloneDeep(taskConf),
                    ffmpeg,
                    inPath: `rtmp://127.0.0.1:${this.config.rtmp.port}${streamPath}`,
                    ouPath: taskConf.appendName === false ? edge : (hasApp ? `${edge}/${stream}` : `${edge}${streamPath}`),
                };
                if (Object.keys(args).length > 0) {
                    sessionConf.ouPath += '?';
                    sessionConf.ouPath += querystring.encode(args);
                }
                Logger.log("[rtmp postPublish] patterncheck", `id=${id}`, `app=${app}`, `stream=${stream}`, `i=${i}`, `edge=${edge}`, `pattern=${taskConf.pattern}`);
                if (!!taskConf.pattern && !(new RegExp(taskConf.pattern).test(streamPath))) {
                    continue;
                }
                this.startNewRelaySession(sessionConf, id, streamPath, args);
            }
        }

    }

    onDonePublish(id: SessionID, streamPath: string, args: Arguments) {
        for (let [srcId, sessions] of this.dynamicSessions) {
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
        for (let [srcId, sessions] of this.dynamicSessions) {
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

export { NodeRelayServer };

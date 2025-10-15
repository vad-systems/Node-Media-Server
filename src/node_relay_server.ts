import fs from 'fs';
import _ from 'lodash';
import querystring from 'querystring';
import { Logger, context, NodeCoreUtils } from './core/index.js';
import NodeConfigurableServer from './node_configurable_server.js';
import { NodeRelaySession } from './node_relay_session.js';
import { Arguments, Config, RelayMode, RelaySessionConfig, SessionID } from './types/index.js';
import asRegExp from './util/asRegExp.js';

class NodeRelayServer extends NodeConfigurableServer<Config> {
    dynamicSessions: Map<SessionID, Map<SessionID, NodeRelaySession>> = new Map();

    constructor(config: Config) {
        super(config);

        this.onPostPublish = this.onPostPublish.bind(this);
        this.onDonePublish = this.onDonePublish.bind(this);
    }

    async run() {
        try {
            fs.accessSync(this.config.relay.ffmpeg, fs.constants.X_OK);
        } catch (error) {
            Logger.error(`Node Media Relay Server startup failed. ffmpeg:${this.config.relay.ffmpeg} cannot be executed.`);
            return;
        }

        let version = await NodeCoreUtils.getFFmpegVersion(this.config.relay.ffmpeg);
        if (version === '' || parseInt(version.split('.')[0]) < 4) {
            Logger.error('Node Media Relay Server startup failed. ffmpeg requires version 4.0.0 above');
            Logger.error('Download the latest ffmpeg static program:', NodeCoreUtils.getFFmpegUrl());
            return;
        }

        context.nodeEvent.on('postPublish', this.onPostPublish);
        context.nodeEvent.on('donePublish', this.onDonePublish);

        Logger.log(`Node Media Relay Server started, ffmpeg version: ${version}`);
    }

    startNewRelaySession(conf: RelaySessionConfig, srcId: SessionID, streamPath: string, args: Arguments) {
        for (let session of context.sessions.values()) {
            if (session.getConfig('inPath') === conf.inPath && session.conf.ouPath === conf.ouPath) {
                Logger.log(
                    '[relay dynamic push] session still running',
                    `srcid=${srcId}`,
                    conf.inPath,
                    'to',
                    conf.ouPath,
                );
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
                    Logger.log(
                        '[relay dynamic push] restart',
                        `srcid=${srcId}`,
                        `id=${id}`,
                        conf.inPath,
                        'to',
                        conf.ouPath,
                    );
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
        Logger.log('[rtmp postPublish] Check for relays', `id=${id}`, `streamPath=${streamPath}`);
        const { tasks, ffmpeg } = this.config.relay;
        if (!tasks) {
            return;
        }
        let regRes = /\/(.*)\/(.*)/gi.exec(streamPath);
        let [app, stream] = _.slice(regRes, 1);
        let i = tasks.length;
        Logger.log('[rtmp postPublish] Check for relays', `id=${id}`, `app=${app}`, `stream=${stream}`, `i=${i}`);
        while (i--) {
            let taskConf = _.cloneDeep(tasks[i]);
            let isPush = taskConf.mode === RelayMode.PUSH;
            const edge = !!taskConf.edge && (
                typeof taskConf.edge === typeof {} ? (
                    taskConf.edge[stream] || taskConf.edge['_default'] || ''
                ) : taskConf.edge
            );
            Logger.log(
                '[rtmp postPublish] Check for relays',
                `id=${id}`,
                `app=${app}`,
                `stream=${stream}`,
                `i=${i}`,
                `edge=${edge}`,
            );
            const pattern = asRegExp(taskConf.pattern);
            if (isPush && (app === taskConf.app && (!pattern || pattern.test(streamPath)))) {
                let hasApp = edge.match(/rtmp:\/\/([^\/]+)\/([^\/]+)/);
                let sessionConf: RelaySessionConfig = {
                    ..._.cloneDeep(taskConf),
                    ffmpeg,
                    inPath: `rtmp://127.0.0.1:${this.config.rtmp.port}${streamPath}`,
                    ouPath: taskConf.appendName === false ? edge : (
                        hasApp ? `${edge}/${stream}` : `${edge}${streamPath}`
                    ),
                };
                if (Object.keys(args).length > 0) {
                    sessionConf.ouPath += '?';
                    sessionConf.ouPath += querystring.encode(args);
                }
                Logger.log(
                    '[rtmp postPublish] patterncheck',
                    `id=${id}`,
                    `app=${app}`,
                    `stream=${stream}`,
                    `i=${i}`,
                    `edge=${edge}`,
                    `pattern=${taskConf.pattern}`,
                );

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
        context.nodeEvent.off('postPublish', this.onPostPublish);
        context.nodeEvent.off('donePublish', this.onDonePublish);

        for (let [srcId, sessions] of this.dynamicSessions) {
            for (let [_, session] of sessions) {
                session.end();
            }

            let session = context.sessions.get(srcId);

            if (session && session instanceof NodeRelaySession) {
                session.end();
            }
        }

        Logger.log(`Node Media Relay Server stopped.`);
    }
}

export { NodeRelayServer };

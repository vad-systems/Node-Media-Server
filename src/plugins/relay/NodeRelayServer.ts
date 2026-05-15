import fs from 'fs';
import _ from 'lodash';
import querystring from 'querystring';
import { context, LoggerFactory, NodeCoreUtils } from '@vad-systems/nms-core';
import { Arguments, RelayMode, RelayPushTaskConfig, RelaySessionConfig, SessionID, checkSelectiveTask, SessionState } from '@vad-systems/nms-shared';
import { BaseAvSession, NodeTaskServer } from '@vad-systems/nms-server';
import { NodeRelaySession } from '@vad-systems/nms-plugin-relay';

class NodeRelayServer extends NodeTaskServer {
    private logger = LoggerFactory.getLogger('Relay Server');

    constructor() {
        super();
    }

    async run() {
        if (!this.config.relay) {
            this.logger.error(`[Relay] Server startup failed. Config relay is missing.`);
            return;
        }

        // Cleanup any leftover relay sessions
        for (let session of context.sessions.values()) {
            if (session instanceof NodeRelaySession) {
                session.stop();
                session.cleanup();
            }
        }

        await super.run();

        try {
            fs.accessSync(this.config.relay.ffmpeg, fs.constants.X_OK);
        } catch (error) {
            this.logger.error(`[Relay] Server startup failed. ffmpeg:${this.config.relay.ffmpeg} cannot be executed.`);
            return;
        }

        let version = await NodeCoreUtils.getFFmpegVersion(this.config.relay.ffmpeg);
        if (version === '' || parseInt(version.split('.')[0]) < 4) {
            this.logger.error('[Relay] Server startup failed. ffmpeg requires version 4.0.0 above');
            this.logger.error('[Relay] Download the latest ffmpeg static program:', NodeCoreUtils.getFFmpegUrl());
            return;
        }

        this.logger.log(`[Relay] Server started, ffmpeg version: ${version}`);
        this.scanBroadcasts();
    }

    startNewRelaySession(conf: RelaySessionConfig, srcId: SessionID, streamPath: string, args: Arguments) {
        for (let session of context.sessions.values()) {
            if (session instanceof NodeRelaySession &&
                session.getConfig('inPath') === conf.inPath &&
                session.getConfig('ouPath') === conf.ouPath) {
                this.logger.debug(
                    `[Relay] dynamic push session still running: srcId=${srcId} inPath=${conf.inPath} ouPath=${conf.ouPath}`,
                );
                return null;
            }
        }

        let session = new NodeRelaySession(conf);
        session.parentId = srcId;
        const id = session.id;

        const broadcast = context.broadcasts.get(streamPath);
        if (broadcast) {
            session.broadcast = broadcast;
            broadcast.subscribers.set(id, session);
        }

        this.logger.log(`[Relay] dynamic push start: srcId=${srcId} id=${id} inPath=${conf.inPath} ouPath=${conf.ouPath}`);
        session.on('end', (id) => {
            this.logger.log(`[Relay] dynamic push ended: srcId=${srcId} id=${id} inPath=${conf.inPath} ouPath=${conf.ouPath}`);
            const broadcast = session.broadcast;
            if (broadcast) {
                broadcast.subscribers.delete(id);
            }
            if (!this.isRunning()) {
                return;
            }
            setTimeout(() => {
                if (broadcast && broadcast.publisher) {
                    this.logger.log(
                        `[Relay] dynamic push restart: srcId=${srcId} id=${id} inPath=${conf.inPath} ouPath=${conf.ouPath}`,
                    );
                    const [app, name] = broadcast.publisher.streamPath.split('/').slice(1);
                    this.handleTaskMatching(broadcast.publisher as BaseAvSession<any, any>, app, name);
                }
            }, 1000);
        });
        session.start();
        this.logger.log(`[Relay] dynamic push started: srcId=${srcId} id=${id} inPath=${conf.inPath} ouPath=${conf.ouPath}`);
        return session;
    }

    handleTaskMatching(session: BaseAvSession<any, any>, app: string, stream: string) {
        this.logger.debug(`[Relay] check for relays: id=${session.id} app=${app} stream=${stream}`);
        const { tasks } = this.config.relay;
        if (!tasks) {
            return;
        }

        let i = tasks.length;
        while (i--) {
            let taskConf = _.cloneDeep(tasks[i]);
            const edge = !!taskConf.edge && (
                typeof taskConf.edge === typeof {} ? (
                    taskConf.edge[stream] || taskConf.edge['_default'] || ''
                ) : taskConf.edge
            );
            this.logger.debug(
                `[Relay] check task ${i}: id=${session.id} app=${app} stream=${stream} edge=${edge}`,
            );

            if (taskConf.mode === RelayMode.PUSH) {
                this.handlePushTask(taskConf, app, session.streamPath, edge, stream, session.streamQuery, session.id);
            }
        }
    }

    private handlePushTask(
        taskConf: RelayPushTaskConfig,
        app: string,
        streamPath: string,
        edge: string,
        stream: string,
        args: Arguments,
        id: string,
    ) {
        if (!checkSelectiveTask(taskConf, app, streamPath)) {
            return;
        }

        let hasApp = edge.match(/rtmp:\/\/([^\/]+)\/([^\/]+)/);
        let sessionConf: RelaySessionConfig = {
            ..._.cloneDeep(taskConf),
            ffmpeg: this.config.relay.ffmpeg,
            inPath: `rtmp://127.0.0.1:${this.config.rtmp.port}${streamPath}`,
            ouPath: taskConf.appendName === false ? edge : (
                hasApp ? `${edge}/${stream}` : `${edge}${streamPath}`
            ),
            name: stream,
        };

        if (Object.keys(args || {}).length > 0) {
            sessionConf.ouPath += '?';
            sessionConf.ouPath += querystring.encode(args);
        }

        this.startNewRelaySession(sessionConf, id, streamPath, args);
    }

    stop() {
        super.stop();

        for (let session of context.sessions.values()) {
            if (session instanceof NodeRelaySession) {
                session.stop();
                session.cleanup();
            }
        }

        this.logger.log(`[Relay] Server stopped`);
    }
}

export { NodeRelayServer };

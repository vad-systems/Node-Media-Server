import fs from 'fs';
import _ from 'lodash';
import querystring from 'querystring';
import { context, LoggerFactory, NodeCoreUtils } from '@vad-systems/nms-core';
import { Arguments, RelayMode, RelayPushTaskConfig, RelaySessionConfig, SessionID, checkSelectiveTask } from '@vad-systems/nms-shared';
import { BaseAvSession, NodeTaskServer } from '@vad-systems/nms-server';
import { NodeRelaySession } from '@vad-systems/nms-plugin-relay';

class NodeRelayServer extends NodeTaskServer {
    private logger = LoggerFactory.getLogger('Relay Server');

    constructor() {
        super();
    }

    async run() {
        if (!this.config.relay) {
            this.logger.error(`Node Media Relay Server startup failed. Config relay is missing.`);
            return;
        }

        await super.run();

        try {
            fs.accessSync(this.config.relay.ffmpeg, fs.constants.X_OK);
        } catch (error) {
            this.logger.error(`Node Media Relay Server startup failed. ffmpeg:${this.config.relay.ffmpeg} cannot be executed.`);
            return;
        }

        let version = await NodeCoreUtils.getFFmpegVersion(this.config.relay.ffmpeg);
        if (version === '' || parseInt(version.split('.')[0]) < 4) {
            this.logger.error('Node Media Relay Server startup failed. ffmpeg requires version 4.0.0 above');
            this.logger.error('Download the latest ffmpeg static program:', NodeCoreUtils.getFFmpegUrl());
            return;
        }

        context.nodeEvent.on('postPublish', this.onPostPublish);
        context.nodeEvent.on('donePublish', this.onDonePublish);

        this.logger.log(`Node Media Relay Server started, ffmpeg version: ${version}`);
    }

    startNewRelaySession(conf: RelaySessionConfig, srcId: SessionID, streamPath: string, args: Arguments) {
        for (let session of context.sessions.values()) {
            if (session.getConfig('inPath') === conf.inPath && session.getConfig('ouPath') === conf.ouPath) {
                this.logger.debug(
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
        session.parentId = srcId;
        const id = session.id;

        const broadcast = context.broadcasts.get(streamPath);
        if (broadcast) {
            session.broadcast = broadcast;
            broadcast.subscribers.set(id, session);
        }

        this.logger.log('[relay dynamic push] start', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
        session.on('end', (id) => {
            this.logger.log('[relay dynamic push] ended', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
            if (session.broadcast) {
                session.broadcast.subscribers.delete(id);
            }
            if (session.isStop) {
                return;
            }
            setTimeout(() => {
                if (session.broadcast && session.broadcast.publisher) {
                    this.logger.log(
                        '[relay dynamic push] restart',
                        `srcid=${srcId}`,
                        `id=${id}`,
                        conf.inPath,
                        'to',
                        conf.ouPath,
                    );
                    const [app, name] = session.broadcast.publisher.streamPath.split('/').slice(1);
                    this.handleTaskMatching(session.broadcast.publisher as BaseAvSession<any, any>, app, name);
                }
            }, 1000);
        });
        session.run();
        this.logger.log('[relay dynamic push] started', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
        return session;
    }

    handleTaskMatching(session: BaseAvSession<any, any>, app: string, stream: string) {
        this.logger.debug('[rtmp postPublish] Check for relays', `id=${session.id}`);
        const { tasks } = this.config.relay;
        if (!tasks) {
            return;
        }

        let i = tasks.length;
        this.logger.debug(
            '[rtmp postPublish] Check for relays',
            `id=${session.id}`,
            `app=${app}`,
            `stream=${stream}`,
            `i=${i}`,
        );
        while (i--) {
            let taskConf = _.cloneDeep(tasks[i]);
            const edge = !!taskConf.edge && (
                typeof taskConf.edge === typeof {} ? (
                    taskConf.edge[stream] || taskConf.edge['_default'] || ''
                ) : taskConf.edge
            );
            this.logger.debug(
                '[rtmp postPublish] Check for relays',
                `id=${session.id}`,
                `app=${app}`,
                `stream=${stream}`,
                `i=${i}`,
                `edge=${edge}`,
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

        if (Object.keys(args).length > 0) {
            sessionConf.ouPath += '?';
            sessionConf.ouPath += querystring.encode(args);
        }

        this.startNewRelaySession(sessionConf, id, streamPath, args);
    }

    stop() {
        super.stop();

        this.logger.log(`Node Media Relay Server stopped.`);
    }
}

export { NodeRelayServer };

import fs from 'fs';
import _ from 'lodash';
import * as mkdirp from 'mkdirp';
import { context, LoggerFactory, NodeCoreUtils } from '@vad-systems/nms-core';
import { TransSessionConfig, checkSelectiveTask, SessionState } from '@vad-systems/nms-shared';
import { BaseAvSession, NodeTaskServer } from '@vad-systems/nms-server';
import { NodeTransSession } from '@vad-systems/nms-plugin-trans';

class NodeTransServer extends NodeTaskServer {
    private logger = LoggerFactory.getLogger('Trans Server');

    constructor() {
        super();
    }

    async run() {
        if (!this.config.trans) {
            this.logger.error(`[Trans] Server startup failed. Config trans is missing.`);
            return;
        }

        // Cleanup any leftover trans sessions
        for (let session of context.sessions.values()) {
            if (session instanceof NodeTransSession) {
                session.stop();
                session.cleanup();
            }
        }

        await super.run();

        const mediaroot = this.config.http.mediaroot;
        const ffmpeg = this.config.trans.ffmpeg;

        try {
            mkdirp.sync(mediaroot.toString());
            fs.accessSync(mediaroot, fs.constants.W_OK);
        } catch (error) {
            this.logger.error(`[Trans] Server startup failed. MediaRoot:${mediaroot} cannot be written.`);
            return;
        }

        try {
            fs.accessSync(ffmpeg, fs.constants.X_OK);
        } catch (error) {
            this.logger.error(`[Trans] Server startup failed. ffmpeg:${ffmpeg} cannot be executed.`);
            return;
        }

        const version = await NodeCoreUtils.getFFmpegVersion(ffmpeg);
        if (version === '' || parseInt(version.split('.')[0]) < 4) {
            this.logger.error('[Trans] Server startup failed. ffmpeg requires version 4.0.0 above');
            this.logger.error('[Trans] Download the latest ffmpeg static program:', NodeCoreUtils.getFFmpegUrl());
            return;
        }

        const tasks = this.config.trans.tasks || [];
        let i = tasks.length;
        let apps = '';
        while (i--) {
            apps += tasks[i].app;
            apps += ' ';
        }

        this.logger.log(`[Trans] Server started for apps: [${apps}], MediaRoot: ${mediaroot}, ffmpeg version: ${version}`);
        this.scanBroadcasts();
    }

    handleTaskMatching(session: BaseAvSession<any, any>, app: string, name: string) {
        const { tasks, ffmpeg } = this.config.trans;
        let i = tasks.length;
        const mediaroot = this.config.http.mediaroot;

        while (i--) {
            let taskConfig = _.cloneDeep(tasks[i]);
            let sessionConfig: TransSessionConfig = {
                ..._.cloneDeep(taskConfig),
                ffmpeg,
                mediaroot: mediaroot,
                rtmpPort: this.config.rtmp.port,
                streamPath: session.streamPath,
                streamApp: app,
                streamName: name,
            };
            sessionConfig.args = session.streamQuery;

            if (!checkSelectiveTask(taskConfig, app, session.streamPath)) {
                continue;
            }

            let isExisting = false;
            for (let s of context.sessions.values()) {
                if (s.TAG === 'trans' && s.streamPath === session.streamPath && _.isMatch(s.getConfig(), taskConfig)) {
                    isExisting = true;
                    break;
                }
            }
            if (isExisting) {
                this.logger.debug(
                    `[Trans] session still running: srcId=${session.id} streamPath=${session.streamPath}`,
                );
                continue;
            }

            let sess = new NodeTransSession(sessionConfig);
            sess.parentId = session.id;

            if (session.broadcast) {
                sess.broadcast = session.broadcast;
                session.broadcast.subscribers.set(sess.id, sess);
            }

            const id = sess.id;
            sess.on('end', (id) => {
                this.logger.log(`[Trans] session ended: id=${id} streamPath=${sessionConfig.streamPath}`);
                const broadcast = sess.broadcast;
                if (broadcast) {
                    broadcast.subscribers.delete(id);
                }
                if (!this.isRunning()) {
                    return;
                }
                setTimeout(() => {
                    if (broadcast && broadcast.publisher) {
                        this.logger.log(`[Trans] session restart: id=${id} streamPath=${sessionConfig.streamPath}`);
                        this.handleTaskMatching(broadcast.publisher as BaseAvSession<any, any>, app, name);
                    }
                }, 1000);
            });

            sess.start();
        }
    }

    stop() {
        super.stop();

        for (let session of context.sessions.values()) {
            if (session instanceof NodeTransSession) {
                session.stop();
                session.cleanup();
            }
        }

        this.logger.log(`[Trans] Server stopped`);
    }
}

export { NodeTransServer };

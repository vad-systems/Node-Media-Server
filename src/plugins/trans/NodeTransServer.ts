import fs from 'fs';
import _ from 'lodash';
import * as mkdirp from 'mkdirp';
import { context, LoggerFactory, NodeCoreUtils } from '@vad-systems/nms-core';
import { TransSessionConfig, checkSelectiveTask } from '@vad-systems/nms-shared';
import { BaseAvSession, NodeTaskServer } from '@vad-systems/nms-server';
import { NodeTransSession } from './NodeTransSession.js';

class NodeTransServer extends NodeTaskServer {
    private logger = LoggerFactory.getLogger('Trans Server');

    constructor() {
        super();
    }

    async run() {
        await super.run();

        const mediaroot = this.config.http.mediaroot;
        const ffmpeg = this.config.trans.ffmpeg;

        try {
            mkdirp.sync(mediaroot.toString());
            fs.accessSync(mediaroot, fs.constants.W_OK);
        } catch (error) {
            this.logger.error(`Node Media Trans Server startup failed. MediaRoot:${mediaroot} cannot be written.`);
            return;
        }

        try {
            fs.accessSync(ffmpeg, fs.constants.X_OK);
        } catch (error) {
            this.logger.error(`Node Media Trans Server startup failed. ffmpeg:${ffmpeg} cannot be executed.`);
            return;
        }

        const version = await NodeCoreUtils.getFFmpegVersion(ffmpeg);
        if (version === '' || parseInt(version.split('.')[0]) < 4) {
            this.logger.error('Node Media Trans Server startup failed. ffmpeg requires version 4.0.0 above');
            this.logger.error('Download the latest ffmpeg static program:', NodeCoreUtils.getFFmpegUrl());
            return;
        }

        const tasks = this.config.trans.tasks || [];
        let i = tasks.length;
        let apps = '';
        while (i--) {
            apps += tasks[i].app;
            apps += ' ';
        }

        this.logger.log(`Node Media Trans Server started for apps: [${apps}] , MediaRoot: ${mediaroot}, ffmpeg version: ${version}`);
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
                    '[trans] session still running',
                    `srcid=${session.id}`,
                    `streamPath=${session.streamPath}`,
                    taskConfig,
                );
                continue;
            }

            let sess = new NodeTransSession(sessionConfig);

            if (session.broadcast) {
                sess.broadcast = session.broadcast;
                session.broadcast.subscribers.set(sess.id, sess);
            }

            const id = sess.id;
            sess.on('end', (id) => {
                this.logger.log('[trans] ended', `id=${id}`, sessionConfig.streamPath);
                if (sess.broadcast) {
                    sess.broadcast.subscribers.delete(id);
                }
                if (sess.isStop) {
                    return;
                }
                setTimeout(() => {
                    if (sess.broadcast && sess.broadcast.publisher) {
                        this.logger.log('[trans] restart', `id=${id}`, sessionConfig.streamPath);
                        this.handleTaskMatching(sess.broadcast.publisher as BaseAvSession<any, any>, app, name);
                    }
                }, 1000);
            });

            sess.run();
        }
    }

    stop() {
        super.stop();

        this.logger.log(`Node Media Trans Server stopped.`);
    }
}

export { NodeTransServer };

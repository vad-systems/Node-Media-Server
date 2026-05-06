import fs from 'fs';
import _ from 'lodash';
import * as mkdirp from 'mkdirp';
import { context, LoggerFactory, NodeCoreUtils } from '@vad-systems/nms-core';
import { FissionSessionConfig, checkSelectiveTask } from '@vad-systems/nms-shared';
import { BaseAvSession, NodeTaskServer } from '@vad-systems/nms-server';
import { NodeFissionSession } from '@vad-systems/nms-plugin-fission';

class NodeFissionServer extends NodeTaskServer {
    private logger = LoggerFactory.getLogger('Fission Server');

    constructor() {
        super();
    }

    async run() {
        if (!this.config.fission) {
            this.logger.error(`Node Media Fission Server startup failed. Config fission is missing.`);
            return;
        }

        await super.run();

        try {
            mkdirp.sync(this.config.http.mediaroot.toString());
            fs.accessSync(this.config.http.mediaroot, fs.constants.W_OK);
        } catch (error) {
            this.logger.error(`Node Media Fission Server startup failed. MediaRoot:${this.config.http.mediaroot} cannot be written.`);
            return;
        }

        try {
            fs.accessSync(this.config.fission.ffmpeg, fs.constants.X_OK);
        } catch (error) {
            this.logger.error(`Node Media Fission Server startup failed. ffmpeg:${this.config.fission.ffmpeg} cannot be executed.`);
            return;
        }

        let version = await NodeCoreUtils.getFFmpegVersion(this.config.fission.ffmpeg);
        if (version === '' || parseInt(version.split('.')[0]) < 4) {
            this.logger.error('Node Media Fission Server startup failed. ffmpeg requires version 4.0.0 above');
            this.logger.error('Download the latest ffmpeg static program:', NodeCoreUtils.getFFmpegUrl());
            return;
        }

        this.logger.log(`Node Media Fission Server started, MediaRoot: ${this.config.http.mediaroot}, ffmpeg version: ${version}`);
    }

    handleTaskMatching(session: BaseAvSession<any, any>, app: string, name: string) {
        const srcId = session.id;
        this.logger.debug(
            '[fission postPublish] Check for fission tasks',
            `id=${srcId}`,
            `streamPath=${session.streamPath}`,
        );
        for (let task of this.config.fission.tasks) {
            if (!checkSelectiveTask(task, app, session.streamPath)) {
                this.logger.debug(
                    '[fission] pattern check failed, skip',
                    `pattern=${task.pattern}`,
                    `srcid=${srcId}`,
                    `app=${app}`,
                    `streamPath=${session.streamPath}`,
                    task,
                );
                continue;
            }

            let isExisting = false;
            for (let s of context.sessions.values()) {
                if (s.TAG === 'fission' && s.streamPath === session.streamPath && _.isEqual(s.getConfig('model'), task.model)) {
                    isExisting = true;
                    break;
                }
            }
            if (isExisting) {
                this.logger.debug(
                    '[fission] session still running',
                    `srcid=${srcId}`,
                    `streamPath=${session.streamPath}`,
                    task,
                );
                continue;
            }

            const broadcast = session.broadcast;
            const nameSegments = name.split('_');
            if (!broadcast) {
                this.logger.warn('No broadcast found', srcId);
                continue;
            }
            if (broadcast.publisher.isLocal() && nameSegments.length > 0 && !isNaN(parseInt(nameSegments[nameSegments.length - 1]))) {
                this.logger.debug(
                    '[fission] duplication check failed, skip',
                    `pattern=${task.pattern}`,
                    `srcid=${srcId}`,
                    `app=${app}`,
                    `streamPath=${session.streamPath}`,
                    task,
                );
                continue;
            }
            let taskConf = _.cloneDeep(task);
            let sessionConf: FissionSessionConfig = {
                ..._.cloneDeep(taskConf),
                ffmpeg: this.config.fission.ffmpeg,
                mediaroot: this.config.http.mediaroot,
                rtmpPort: this.config.rtmp.port,
                streamPath: session.streamPath,
                streamApp: app,
                streamName: name,
            };
            sessionConf.args = session.streamQuery;
            let sess = new NodeFissionSession(sessionConf);
            sess.parentId = srcId;
            const id = sess.id;

            if (session.broadcast) {
                sess.broadcast = session.broadcast;
                session.broadcast.subscribers.set(sess.id, sess);
            }

            this.logger.log(
                '[fission] start',
                `srcid=${srcId}`,
                `id=${id}`,
                sessionConf.streamPath,
                `x${taskConf.model.length}`,
            );
            sess.on('end', (id) => {
                this.logger.log(
                    '[fission] ended',
                    `srcid=${srcId}`,
                    `id=${id}`,
                    sessionConf.streamPath,
                    `x${taskConf.model.length}`,
                );
                if (sess.broadcast) {
                    sess.broadcast.subscribers.delete(id);
                }
                if (sess.isStop) {
                    return;
                }
                setTimeout(() => {
                    if (sess.broadcast && sess.broadcast.publisher) {
                        this.logger.log(
                            '[fission] restart',
                            `srcid=${srcId}`,
                            `id=${id}`,
                            sessionConf.streamPath,
                            `x${taskConf.model.length}`,
                        );
                        this.handleTaskMatching(sess.broadcast.publisher as BaseAvSession<any, any>, app, name);
                    }
                }, 1000);
            });
            sess.run();
            this.logger.log(
                '[fission] started',
                `srcid=${srcId}`,
                `id=${id}`,
                sessionConf.streamPath,
                `x${taskConf.model.length}`,
            );
        }
    }

    stop() {
        super.stop();

        this.logger.log(`Node Media Fission Server stopped.`);
    }
}

export { NodeFissionServer };

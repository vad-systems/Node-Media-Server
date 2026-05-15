import fs from 'fs';
import _ from 'lodash';
import * as mkdirp from 'mkdirp';
import { context, LoggerFactory, NodeCoreUtils } from '@vad-systems/nms-core';
import { FissionSessionConfig, checkSelectiveTask, SessionState } from '@vad-systems/nms-shared';
import { BaseAvSession, NodeTaskServer } from '@vad-systems/nms-server';
import { NodeFissionSession } from '@vad-systems/nms-plugin-fission';

class NodeFissionServer extends NodeTaskServer {
    private logger = LoggerFactory.getLogger('Fission Server');

    constructor() {
        super();
    }

    async run() {
        if (!this.config.fission) {
            this.logger.error(`[Fission] Server startup failed. Config fission is missing.`);
            return;
        }

        // Cleanup any leftover fission sessions
        for (let session of context.sessions.values()) {
            if (session instanceof NodeFissionSession) {
                session.stop();
                session.cleanup();
            }
        }

        await super.run();

        try {
            mkdirp.sync(this.config.http.mediaroot.toString());
            fs.accessSync(this.config.http.mediaroot, fs.constants.W_OK);
        } catch (error) {
            this.logger.error(`[Fission] Server startup failed. MediaRoot:${this.config.http.mediaroot} cannot be written.`);
            return;
        }

        try {
            fs.accessSync(this.config.fission.ffmpeg, fs.constants.X_OK);
        } catch (error) {
            this.logger.error(`[Fission] Server startup failed. ffmpeg:${this.config.fission.ffmpeg} cannot be executed.`);
            return;
        }

        let version = await NodeCoreUtils.getFFmpegVersion(this.config.fission.ffmpeg);
        if (version === '' || parseInt(version.split('.')[0]) < 4) {
            this.logger.error('[Fission] Server startup failed. ffmpeg requires version 4.0.0 above');
            this.logger.error('[Fission] Download the latest ffmpeg static program:', NodeCoreUtils.getFFmpegUrl());
            return;
        }

        this.logger.log(`[Fission] Server started, MediaRoot: ${this.config.http.mediaroot}, ffmpeg version: ${version}`);
        this.scanBroadcasts();
    }

    handleTaskMatching(session: BaseAvSession<any, any>, app: string, name: string) {
        const srcId = session.id;
        this.logger.debug(`[Fission] check for fission tasks: id=${srcId} streamPath=${session.streamPath}`);
        for (let task of this.config.fission.tasks) {
            if (!checkSelectiveTask(task, app, session.streamPath)) {
                this.logger.debug(
                    `[Fission] pattern check failed: pattern=${task.pattern} srcId=${srcId} app=${app} streamPath=${session.streamPath}`,
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
                    `[Fission] session still running: srcId=${srcId} streamPath=${session.streamPath}`,
                );
                continue;
            }

            const broadcast = session.broadcast;
            const nameSegments = name.split('_');
            if (!broadcast) {
                this.logger.warn(`[Fission] no broadcast found for session: ${srcId}`);
                continue;
            }
            if (broadcast.publisher.isLocal() && nameSegments.length > 0 && !isNaN(parseInt(nameSegments[nameSegments.length - 1]))) {
                this.logger.debug(
                    `[Fission] duplication check failed: pattern=${task.pattern} srcId=${srcId} app=${app} streamPath=${session.streamPath}`,
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
                `[Fission] session start: srcId=${srcId} id=${id} streamPath=${sessionConf.streamPath} tasks=${taskConf.model.length}`,
            );
            sess.on('end', (id) => {
                this.logger.log(
                    `[Fission] session ended: srcId=${srcId} id=${id} streamPath=${sessionConf.streamPath} tasks=${taskConf.model.length}`,
                );
                const broadcast = sess.broadcast;
                if (broadcast) {
                    broadcast.subscribers.delete(id);
                }
                if (!this.isRunning()) {
                    return;
                }
                setTimeout(() => {
                    if (broadcast && broadcast.publisher) {
                        this.logger.log(
                            `[Fission] session restart: srcId=${srcId} id=${id} streamPath=${sessionConf.streamPath} tasks=${taskConf.model.length}`,
                        );
                        this.handleTaskMatching(broadcast.publisher as BaseAvSession<any, any>, app, name);
                    }
                }, 1000);
            });
            sess.start();
            this.logger.log(
                `[Fission] session started: srcId=${srcId} id=${id} streamPath=${sessionConf.streamPath} tasks=${taskConf.model.length}`,
            );
        }
    }

    stop() {
        super.stop();

        for (let session of context.sessions.values()) {
            if (session instanceof NodeFissionSession) {
                session.stop();
                session.cleanup();
            }
        }

        this.logger.log(`[Fission] Server stopped`);
    }
}

export { NodeFissionServer };

import fs from 'fs';
import _ from 'lodash';
import * as mkdirp from 'mkdirp';
import { context, Logger, NodeCoreUtils } from '../../core/index.js';
import { NodeAvSession } from '../NodeAvSession.js';
import NodeConfigurableServer from '../NodeConfigurableServer.js';
import { NodeSession } from '../NodeSession.js';
import { NodeFissionSession } from './NodeFissionSession.js';
import { NodeRelaySession } from '../relay/NodeRelaySession.js';
import { FissionSessionConfig, SessionID } from '../../types/index.js';
import checkSelectiveTask from '../../util/checkSelectiveTask.js';

class NodeFissionServer extends NodeConfigurableServer {
    private fissionSessions: Map<SessionID, Map<SessionID, NodeFissionSession>>;

    constructor() {
        super();
        this.onPostPublish = this.onPostPublish.bind(this);
        this.onDonePublish = this.onDonePublish.bind(this);
    }

    async run() {
        await super.run();

        this.fissionSessions = new Map();

        try {
            mkdirp.sync(this.config.http.mediaroot.toString());
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

        let version = await NodeCoreUtils.getFFmpegVersion(this.config.fission.ffmpeg);
        if (version === '' || parseInt(version.split('.')[0]) < 4) {
            Logger.error('Node Media Fission Server startup failed. ffmpeg requires version 4.0.0 above');
            Logger.error('Download the latest ffmpeg static program:', NodeCoreUtils.getFFmpegUrl());
            return;
        }

        context.nodeEvent.on('postPublish', this.onPostPublish);
        context.nodeEvent.on('donePublish', this.onDonePublish);
        Logger.log(`Node Media Fission Server started, MediaRoot: ${this.config.http.mediaroot}, ffmpeg version: ${version}`);
    }

    onPostPublish(session: NodeSession<any, any>) {
        const srcId = session.id;
        if (session instanceof NodeAvSession) {
            Logger.log('[fission postPublish] Check for fission tasks', `id=${srcId}`, `streamPath=${session.streamPath}`);
            let regRes = /\/(.*)\/(.*)/gi.exec(session.streamPath);
            let [app, name] = _.slice(regRes, 1);
            for (let task of this.config.fission.tasks) {
                if (!checkSelectiveTask(task, app, session.streamPath)) {
                    Logger.debug(
                        '[fission] pattern check failed, skip',
                        `pattern=${task.pattern}`,
                        `srcid=${srcId}`,
                        `app=${app}`,
                        `streamPath=${session.streamPath}`,
                        task,
                    );
                    continue;
                }

                const broadcast = [...context.broadcasts.values()]
                    .find((broadcast) => broadcast.publisher?.id === srcId);
                const nameSegments = name.split('_');
                if (!broadcast) {
                    Logger.warn("No broadcast found", srcId, [...context.broadcasts.values()].map((b) => b.publisher));
                    continue;
                }
                if (broadcast.publisher.isLocal() && nameSegments.length > 0 && !isNaN(parseInt(nameSegments[nameSegments.length - 1]))) {
                    Logger.debug(
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
                const id = sess.id;
                Logger.log(
                    '[fission] start',
                    `srcid=${srcId}`,
                    `id=${id}`,
                    sessionConf.streamPath,
                    `x${taskConf.model.length}`,
                );
                context.sessions.set(id, sess);
                sess.on('end', (id) => {
                    Logger.log(
                        '[fission] ended',
                        `srcid=${srcId}`,
                        `id=${id}`,
                        sessionConf.streamPath,
                        `x${taskConf.model.length}`,
                    );
                    context.sessions.delete(id);
                    const fissionSessionsForSrc = this.fissionSessions.get(srcId);
                    if (fissionSessionsForSrc) {
                        fissionSessionsForSrc.delete(id);
                    }
                    setTimeout(() => {
                        if (!!srcId) {
                            const [_x, broadcast] = [...context.broadcasts.entries()]
                                .find(([_x, broadcast]) => broadcast.publisher?.id === srcId);
                            if (!!broadcast) {
                                Logger.log(
                                    '[fission] restart',
                                    `srcid=${srcId}`,
                                    `id=${id}`,
                                    sessionConf.streamPath,
                                    `x${taskConf.model.length}`,
                                );
                                this.onPostPublish(broadcast.publisher);
                            }
                        }
                    }, 1000);
                });
                const fissionSessionsForSrc = this.fissionSessions.get(srcId);
                if (fissionSessionsForSrc) {
                    fissionSessionsForSrc.set(id, sess);
                } else {
                    const newMap = new Map();
                    newMap.set(id, session);
                    this.fissionSessions.set(srcId, newMap);
                }
                sess.run();
                Logger.log(
                    '[fission] started',
                    `srcid=${srcId}`,
                    `id=${id}`,
                    sessionConf.streamPath,
                    `x${taskConf.model.length}`,
                );
            }
        }
    }

    onDonePublish(session: NodeSession<any, any>) {
        const id = session.id;
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
        super.stop();

        context.nodeEvent.off('postPublish', this.onPostPublish);
        context.nodeEvent.off('donePublish', this.onDonePublish);

        for (let [srcId, sessions] of this.fissionSessions) {
            for (let [_, session] of sessions) {
                session.end();
            }

            let session = context.sessions.get(srcId);

            if (session && session instanceof NodeFissionSession) {
                session.end();
            }
        }

        Logger.log(`Node Media Fission Server stopped.`);
    }
}

export { NodeFissionServer };

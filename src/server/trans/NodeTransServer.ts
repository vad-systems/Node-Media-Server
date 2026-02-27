import fs from 'fs';
import _ from 'lodash';
import * as mkdirp from 'mkdirp';
import { context, Logger, NodeCoreUtils } from '../../core/index.js';
import { NodeAvSession } from '../NodeAvSession.js';
import NodeConfigurableServer from '../NodeConfigurableServer.js';
import { NodeSession } from '../NodeSession.js';
import { NodeTransSession } from './NodeTransSession.js';
import { Arguments, SessionID, TransSessionConfig } from '../../types/index.js';
import checkSelectiveTask from '../../util/checkSelectiveTask.js';

class NodeTransServer extends NodeConfigurableServer {
    private transSessions: Map<SessionID, Map<SessionID, NodeTransSession>> = new Map();

    constructor() {
        super();
        this.onDonePublish = this.onDonePublish.bind(this);
        this.onPostPublish = this.onPostPublish.bind(this);
    }

    async run() {
        await super.run();

        const mediaroot = this.config.http.mediaroot;
        const ffmpeg = this.config.trans.ffmpeg;

        try {
            mkdirp.sync(mediaroot.toString());
            fs.accessSync(mediaroot, fs.constants.W_OK);
        } catch (error) {
            Logger.error(`Node Media Trans Server startup failed. MediaRoot:${mediaroot} cannot be written.`);
            return;
        }

        try {
            fs.accessSync(ffmpeg, fs.constants.X_OK);
        } catch (error) {
            Logger.error(`Node Media Trans Server startup failed. ffmpeg:${ffmpeg} cannot be executed.`);
            return;
        }

        const version = await NodeCoreUtils.getFFmpegVersion(ffmpeg);
        if (version === '' || parseInt(version.split('.')[0]) < 4) {
            Logger.error('Node Media Trans Server startup failed. ffmpeg requires version 4.0.0 above');
            Logger.error('Download the latest ffmpeg static program:', NodeCoreUtils.getFFmpegUrl());
            return;
        }

        const tasks = this.config.trans.tasks || [];
        let i = tasks.length;
        let apps = '';
        while (i--) {
            apps += tasks[i].app;
            apps += ' ';
        }

        context.nodeEvent.on('postPublish', this.onPostPublish);
        context.nodeEvent.on('donePublish', this.onDonePublish);

        Logger.log(`Node Media Trans Server started for apps: [${apps}] , MediaRoot: ${mediaroot}, ffmpeg version: ${version}`);
    }

    onPostPublish(session: NodeSession<any, any>) {
        if (session instanceof NodeAvSession) {
            const regRes = /\/(.*)\/(.*)/gi.exec(session.streamPath);
            const [app, name] = _.slice(regRes, 1);

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

                let sess = new NodeTransSession(sessionConfig);
                let sessions = this.transSessions.get(session.id);
                if (!sessions) {
                    sessions = new Map();
                    this.transSessions.set(sess.id, sessions);
                }
                sessions.set(sess.id, sess);
                sess.on('end', () => {
                    sessions.delete(sess.id);
                });
                sess.run();
            }
        }
    }

    onDonePublish(session: NodeSession<any, any>) {
        const sessions = this.transSessions.get(session.id);
        if (sessions) {
            for (let [_, sess] of sessions) {
                sess.end();
            }
        }
    }

    stop() {
        super.stop();

        context.nodeEvent.off('postPublish', this.onPostPublish);
        context.nodeEvent.off('donePublish', this.onDonePublish);

        for (let [id, sessions] of this.transSessions) {
            for (let [_, session] of sessions) {
                session.end();
            }
        }

        Logger.log(`Node Media Trans Server stopped.`);
    }
}

export { NodeTransServer };

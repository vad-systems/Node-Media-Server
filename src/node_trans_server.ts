import fs from 'fs';
import _ from 'lodash';
import { Logger, context, NodeCoreUtils } from './core/index.js';
import { NodeTransSession } from './node_trans_session.js';
import { Arguments, Config, SessionID, TransSessionConfig } from './types/index.js';
import * as mkdirp from 'mkdirp';
import asRegExp from './util/asRegExp.js';

class NodeTransServer {
    config: Config;
    transSessions: Map<SessionID, NodeTransSession> = new Map();

    constructor(config: Config) {
        this.config = config;
    }

    async run() {
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

        context.nodeEvent.on('postPublish', this.onPostPublish.bind(this));
        context.nodeEvent.on('donePublish', this.onDonePublish.bind(this));

        Logger.log(`Node Media Trans Server started for apps: [${apps}] , MediaRoot: ${mediaroot}, ffmpeg version: ${version}`);
    }

    onPostPublish(id: SessionID, streamPath: string, args: Arguments) {
        const regRes = /\/(.*)\/(.*)/gi.exec(streamPath);
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
                streamPath: streamPath,
                streamApp: app,
                streamName: name,
            };
            sessionConfig.args = args;

            const pattern = asRegExp(taskConfig.pattern);
            if (app === taskConfig.app && (!pattern || pattern.test(streamPath))) {
                let session = new NodeTransSession(sessionConfig);
                this.transSessions.set(id, session);
                session.on('end', (id) => {
                    this.transSessions.delete(id);
                });
                session.run();
            }
        }
    }

    onDonePublish(id: SessionID, streamPath: string, args: Arguments) {
        const session = this.transSessions.get(id);
        if (session) {
            session.end();
        }
    }
}

export { NodeTransServer };

const Logger = require('./node_core_logger');
const NodeCoreUtils = require('./node_core_utils');
const NodeRelaySession = require('./node_relay_session');
const context = require('./node_core_ctx');
const {getFFmpegVersion, getFFmpegUrl} = require('./node_core_utils');
const fs = require('fs');
const querystring = require('querystring');
const _ = require('lodash');
const {sessions} = require("./node_core_ctx");

class NodeRelayServer {
    constructor(config) {
        this.config = config;
        this.dynamicSessions = new Map();
    }

    async run() {
        try {
            fs.accessSync(this.config.relay.ffmpeg, fs.constants.X_OK);
        } catch (error) {
            Logger.error(`Node Media Relay Server startup failed. ffmpeg:${this.config.relay.ffmpeg} cannot be executed.`);
            return;
        }

        let version = await getFFmpegVersion(this.config.relay.ffmpeg);
        if (version === '' || parseInt(version.split('.')[0]) < 4) {
            Logger.error('Node Media Relay Server startup failed. ffmpeg requires version 4.0.0 above');
            Logger.error('Download the latest ffmpeg static program:', getFFmpegUrl());
            return;
        }

        context.nodeEvent.on('postPublish', this.onPostPublish.bind(this));
        context.nodeEvent.on('donePublish', this.onDonePublish.bind(this));

        Logger.log('Node Media Relay Server started');
    }

    startNewRelaySession(conf, srcId, streamPath, args) {
        Logger.log('[relay dynamic push] start', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
        let session = new NodeRelaySession(conf);
        const id = session.id;
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
                    Logger.log('[relay dynamic push] restart', `srcid=${srcId}`, `id=${id}`, conf.inPath, 'to', conf.ouPath);
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

    onPostPublish(id, streamPath, args) {
        Logger.log("[rtmp postPublish] Check for relays", `id=${id}`, `streamPath=${streamPath}`);
        const {tasks, ffmpeg} = this.config.relay;
        if (!tasks) {
            return;
        }
        let regRes = /\/(.*)\/(.*)/gi.exec(streamPath);
        let [app, stream] = _.slice(regRes, 1);
        let i = tasks.length;
        Logger.log("[rtmp postPublish] Check for relays", `id=${id}`, `app=${app}`, `stream=${stream}`, `i=${i}`);
        while (i--) {
            let conf = tasks[i];
            let isPush = conf.mode === 'push';
            const edge = !!conf.edge && (typeof conf.edge === typeof {} ? (conf.edge[stream] || conf.edge["_default"] || "") : conf.edge);
            Logger.log("[rtmp postPublish] Check for relays", `id=${id}`, `app=${app}`, `stream=${stream}`, `i=${i}`, `edge=${edge}`);
            if (isPush && app === conf.app) {
                let hasApp = edge.match(/rtmp:\/\/([^\/]+)\/([^\/]+)/);
                conf.ffmpeg = ffmpeg;
                conf.inPath = `rtmp://127.0.0.1:${this.config.rtmp.port}${streamPath}`;
                conf.ouPath = conf.appendName === false ? edge : (hasApp ? `${edge}/${stream}` : `${edge}${streamPath}`);
                if (Object.keys(args).length > 0) {
                    conf.ouPath += '?';
                    conf.ouPath += querystring.encode(args);
                }
                Logger.log("[rtmp postPublish] patterncheck", `id=${id}`, `app=${app}`, `stream=${stream}`, `i=${i}`, `edge=${edge}`, `pattern=${conf.pattern}`);
                if (!!conf.pattern && !(new RegExp(conf.pattern).test(streamPath))) {
                    continue;
                }
                this.startNewRelaySession(conf, id, streamPath, args);
            }
        }

    }

    onDonePublish(id, streamPath, args) {
        for (let [srcId, sessions] of this.dynamicSessions) {
            if (id === srcId) {
                for (let [_, session] of sessions) {
                    session.end();
                }
                let session = context.sessions.get(id);

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
}

module.exports = NodeRelayServer;

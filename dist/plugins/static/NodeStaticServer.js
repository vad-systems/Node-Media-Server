"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeStaticServer = void 0;
const nms_core_1 = require("../../core");
const nms_shared_1 = require("../../shared");
const NodeConfigurableServer_js_1 = require("../../server/base/NodeConfigurableServer.js");
const NodeStaticSession_js_1 = require("./NodeStaticSession.js");
class NodeStaticServer extends NodeConfigurableServer_js_1.NodeConfigurableServer {
    sessions = new Map();
    logger = nms_core_1.LoggerFactory.getLogger('Static');
    constructor() {
        super();
        this.onPostDone = this.onPostDone.bind(this);
    }
    async run() {
        await super.run();
        nms_core_1.context.nodeEvent.on('postDone', this.onPostDone);
        const config = this.config.static;
        if (config && config.tasks) {
            for (const task of config.tasks) {
                this.startTask(task);
            }
        }
    }
    stop() {
        super.stop();
        nms_core_1.context.nodeEvent.off('postDone', this.onPostDone);
        for (const session of this.sessions.values()) {
            session.stop();
        }
        this.sessions.clear();
    }
    startTask(task) {
        const streamPath = `/${task.app}/${task.name}`;
        if (this.sessions.has(streamPath)) {
            const session = this.sessions.get(streamPath);
            if (session.state === nms_shared_1.SessionState.STOPPED) {
                session.run();
            }
            return;
        }
        const sessionConfig = {
            ...task,
            ffmpeg: this.config.static?.ffmpeg || 'ffmpeg',
            streamPath,
            rtmpPort: this.config.rtmp?.port || 1935
        };
        const session = new NodeStaticSession_js_1.NodeStaticSession(sessionConfig);
        this.sessions.set(streamPath, session);
        session.run();
    }
    onPostDone(session) {
        if (session instanceof NodeStaticSession_js_1.NodeStaticSession) {
            if (this.isRunning() && !session.isManualStop) {
                this.logger.log(`[Static] restarting session for ${session.streamPath}`);
                // Auto restart after a delay
                setTimeout(() => {
                    if (this.isRunning() && !session.isManualStop) {
                        session.run();
                    }
                }, 1000);
            }
        }
    }
    getStatus() {
        const tasks = [];
        this.sessions.forEach((session, streamPath) => {
            const taskConfig = this.config.static?.tasks.find(t => `/${t.app}/${t.name}` === streamPath);
            tasks.push({
                id: session.id,
                app: taskConfig?.app,
                name: taskConfig?.name,
                streamPath,
                state: session.state,
                input: taskConfig?.input,
                textPath: taskConfig?.textPath
            });
        });
        return tasks;
    }
    async restart() {
        this.logger.log('[Static] restarting static server');
        for (const session of this.sessions.values()) {
            session.stop();
        }
        this.sessions.clear();
        const config = this.config.static;
        if (config && config.tasks) {
            for (const task of config.tasks) {
                this.startTask(task);
            }
        }
    }
}
exports.NodeStaticServer = NodeStaticServer;

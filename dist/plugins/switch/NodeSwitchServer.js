"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeSwitchServer = void 0;
const nms_core_1 = require("../../core");
const nms_server_1 = require("../../server");
const SwitchableBroadcastServer_js_1 = require("./SwitchableBroadcastServer.js");
const SwitchSession_js_1 = require("./SwitchSession.js");
const nms_shared_1 = require("../../shared");
class NodeSwitchServer extends nms_server_1.NodeTaskServer {
    logger = nms_core_1.LoggerFactory.getLogger('Switch Server');
    switchBroadcasts = new Map();
    sessions = new Map(); // key: outputPath
    sourceToOutputs = new Map();
    constructor() {
        super();
    }
    async run() {
        if (!this.config.switch || !this.config.switch.tasks) {
            this.logger.error(`[Switch] Server startup failed. Config switch is missing or has no tasks.`);
            return;
        }
        // Cleanup any leftover switch sessions
        for (let session of nms_core_1.context.sessions.values()) {
            if (session instanceof SwitchSession_js_1.SwitchSession) {
                session.stop();
                session.cleanup();
            }
        }
        await super.run();
        nms_core_1.context.nodeEvent.on('live', this.onBroadcastLive);
        nms_core_1.context.nodeEvent.on('offline', this.onBroadcastOffline);
        const config = this.config.switch;
        for (const task of config.tasks) {
            const broadcast = new SwitchableBroadcastServer_js_1.SwitchableBroadcastServer();
            broadcast.register();
            const fullPath = `/${task.app}/${task.name}`;
            this.switchBroadcasts.set(fullPath, broadcast);
            nms_core_1.context.broadcasts.set(fullPath, broadcast);
            const sessionConf = {
                ...task,
                streamPath: fullPath,
            };
            const switchSession = new SwitchSession_js_1.SwitchSession(sessionConf);
            this.sessions.set(fullPath, switchSession);
            switchSession.start();
            if (task.defaultSource) {
                broadcast.setInitialSource(task.defaultSource);
            }
            const allSources = [...task.sources];
            if (task.slatePath && !allSources.includes(task.slatePath)) {
                allSources.push(task.slatePath);
            }
            for (const source of allSources) {
                if (!this.sourceToOutputs.has(source)) {
                    this.sourceToOutputs.set(source, new Set());
                }
                this.sourceToOutputs.get(source).add(fullPath);
            }
        }
        this.logger.log('[Switch] Server started');
        this.scanBroadcasts();
    }
    handleTaskMatching(session, _app, _name) {
        const sourcePath = session.streamPath;
        const matchedOutputs = this.sourceToOutputs.get(sourcePath);
        if (!matchedOutputs || matchedOutputs.size === 0)
            return;
        this.logger.log(`[Switch] source stream published: ${sourcePath}, updating SwitchSessions for outputs: ${Array.from(matchedOutputs).join(', ')}`);
        matchedOutputs.forEach(outputPath => {
            const switchSession = this.sessions.get(outputPath);
            if (switchSession) {
                if (switchSession.state === nms_shared_1.SessionState.STOPPED) {
                    this.logger.log(`[Switch] restarting stopped session for ${outputPath}`);
                    switchSession.start();
                }
                switchSession.addSource(sourcePath);
            }
            const broadcast = this.switchBroadcasts.get(outputPath);
            const config = this.config.switch;
            const task = config?.tasks.find(t => `/${t.app}/${t.name}` === outputPath);
            if (broadcast && task) {
                const currentActive = this.isSourceActive(broadcast.activeSource) && !!broadcast.currentSession;
                if (!currentActive) {
                    this.logger.log(`[Switch] activating ${outputPath} immediately with ${sourcePath} (no current active source)`);
                    this.doSwitch(outputPath, sourcePath, false, true);
                }
                else if (sourcePath === task.defaultSource && !broadcast.isManualSwitch) {
                    if (broadcast.activeSource !== sourcePath) {
                        this.logger.log(`[Switch] returning ${outputPath} to default source ${sourcePath}`);
                        this.doSwitch(outputPath, sourcePath, false);
                    }
                }
                this.updateBroadcastLiveness(broadcast);
            }
        });
    }
    switch(fullPath, newSourcePath) {
        return this.doSwitch(fullPath, newSourcePath, true);
    }
    doSwitch(fullPath, newSourcePath, isManual, force = false) {
        const broadcast = this.switchBroadcasts.get(fullPath);
        if (!broadcast) {
            this.logger.warn(`[Switch] switch failed: output path ${fullPath} not found`);
            return false;
        }
        if (newSourcePath === null) {
            broadcast.switchSource(null, 0, isManual);
            this.updateBroadcastLiveness(broadcast);
            return true;
        }
        if (newSourcePath === fullPath) {
            this.logger.warn(`[Switch] switch failed: cannot switch ${fullPath} to itself`);
            return false;
        }
        const config = this.config.switch;
        const task = config?.tasks.find(t => `/${t.app}/${t.name}` === fullPath);
        const isLive = this.isSourceActive(newSourcePath);
        const isConfigured = task && (task.sources.includes(newSourcePath) || task.slatePath === newSourcePath);
        if (!isConfigured && (!isManual || !isLive)) {
            this.logger.warn(`[Switch] switch failed: source ${newSourcePath} not valid or not live for ${fullPath}`);
            return false;
        }
        if (isManual && !isConfigured) {
            this.ensureSubscription(newSourcePath, fullPath);
        }
        broadcast.switchSource(newSourcePath, task?.switchTimeout, isManual, force);
        return true;
    }
    ensureSubscription(sourcePath, outputPath) {
        if (!this.sourceToOutputs.has(sourcePath)) {
            this.sourceToOutputs.set(sourcePath, new Set());
        }
        this.sourceToOutputs.get(sourcePath).add(outputPath);
        const switchSession = this.sessions.get(outputPath);
        if (switchSession) {
            switchSession.addSource(sourcePath);
        }
    }
    getStatus() {
        const tasks = [];
        this.switchBroadcasts.forEach((broadcast, fullPath) => {
            const config = this.config.switch;
            const taskConfig = config?.tasks.find(t => `/${t.app}/${t.name}` === fullPath);
            const session = this.sessions.get(fullPath);
            tasks.push({
                id: session?.id,
                app: taskConfig?.app,
                name: taskConfig?.name,
                outputPath: fullPath,
                state: broadcast.state,
                sessionState: session?.state,
                activeSource: broadcast.activeSource,
                pendingSource: broadcast.pendingSource,
                isSwitching: broadcast.isSwitching,
                sources: taskConfig?.sources || [],
                defaultSource: taskConfig?.defaultSource,
                slatePath: taskConfig?.slatePath
            });
        });
        return tasks;
    }
    onPostDone(session) {
        if (session instanceof SwitchSession_js_1.SwitchSession) {
            if (this.isRunning() && !session.isManualStop) {
                this.logger.log(`[Switch] restarting switch session for ${session.streamPath}`);
                const broadcast = this.switchBroadcasts.get(session.streamPath);
                if (broadcast) {
                    if (session.state === nms_shared_1.SessionState.RESTARTING) {
                        broadcast.restart();
                        const task = this.config.switch?.tasks.find(t => `/${t.app}/${t.name}` === session.streamPath);
                        if (task && task.defaultSource) {
                            broadcast.setInitialSource(task.defaultSource);
                        }
                    }
                }
                session.start();
            }
            return;
        }
        if (!(session instanceof nms_server_1.NodeSession) || !session.isPublisher) {
            return;
        }
        if (session.streamPath) {
            const sourcePath = session.streamPath;
            const fullPaths = this.sourceToOutputs.get(sourcePath);
            if (fullPaths) {
                fullPaths.forEach(fullPath => {
                    const broadcast = this.switchBroadcasts.get(fullPath);
                    if (broadcast) {
                        const wasActive = broadcast.activeSource === sourcePath;
                        const wasPending = broadcast.pendingSource === sourcePath;
                        if (wasActive || wasPending) {
                            this.triggerFallback(fullPath, sourcePath);
                        }
                        broadcast.notifySourceOffline(sourcePath);
                        this.updateBroadcastLiveness(broadcast);
                    }
                });
            }
        }
    }
    onBroadcastLive = (broadcast) => {
        const path = Array.from(nms_core_1.context.broadcasts.entries()).find(([_, b]) => b === broadcast)?.[0];
        if (path && broadcast.publisher) {
            this.handleTaskMatching(broadcast.publisher, '', '');
        }
    };
    onBroadcastOffline = (broadcast) => {
        const path = Array.from(nms_core_1.context.broadcasts.entries()).find(([_, b]) => b === broadcast)?.[0];
        if (path) {
            // Tell all sessions that this source is gone
            this.sessions.forEach(session => session.removeSource(path));
            const affectedOutputs = this.sourceToOutputs.get(path);
            if (affectedOutputs) {
                affectedOutputs.forEach(fullPath => {
                    const switchBroadcast = this.switchBroadcasts.get(fullPath);
                    if (switchBroadcast) {
                        const wasActive = switchBroadcast.activeSource === path;
                        const wasPending = switchBroadcast.pendingSource === path;
                        if (wasActive || wasPending) {
                            this.triggerFallback(fullPath, path);
                        }
                        switchBroadcast.notifySourceOffline(path);
                        this.updateBroadcastLiveness(switchBroadcast);
                    }
                });
            }
        }
    };
    triggerFallback(fullPath, failedSourcePath) {
        const config = this.config.switch;
        const task = config?.tasks.find(t => `/${t.app}/${t.name}` === fullPath);
        if (!task)
            return;
        let targetSource;
        if (task.defaultSource && task.defaultSource !== failedSourcePath && this.isSourceActive(task.defaultSource)) {
            targetSource = task.defaultSource;
        }
        else {
            targetSource = task.sources.find(s => s !== failedSourcePath && this.isSourceActive(s));
        }
        if (!targetSource && task.slatePath && task.slatePath !== failedSourcePath && this.isSourceActive(task.slatePath)) {
            targetSource = task.slatePath;
        }
        if (targetSource) {
            this.logger.log(`[Switch] triggering fallback for ${fullPath} to: ${targetSource}`);
            this.doSwitch(fullPath, targetSource, false, true);
        }
        else if (!task.slatePath) {
            this.logger.log(`[Switch] no active fallback source and no slate declared for ${fullPath}. Terminating broadcast.`);
            this.doSwitch(fullPath, null, false);
        }
    }
    updateBroadcastLiveness(broadcast) {
        const active = this.isSourceActive(broadcast.activeSource);
        if (!active) {
            // If no active source, ensure no session is acting as publisher
            // This is handled by doSwitch(null) or cutOver
        }
    }
    isSourceActive(sourcePath) {
        if (!sourcePath)
            return false;
        const sourceBroadcast = nms_core_1.context.broadcasts.get(sourcePath);
        return !!(sourceBroadcast && sourceBroadcast.publisher && sourceBroadcast.publisher.state !== nms_shared_1.SessionState.STOPPED && sourceBroadcast.publisher.state !== nms_shared_1.SessionState.STOPPING);
    }
    stop() {
        super.stop();
        nms_core_1.context.nodeEvent.off('live', this.onBroadcastLive);
        nms_core_1.context.nodeEvent.off('offline', this.onBroadcastOffline);
        this.sessions.forEach(session => {
            session.stop();
            session.cleanup();
        });
        this.logger.log('[Switch] Server stopped');
    }
}
exports.NodeSwitchServer = NodeSwitchServer;

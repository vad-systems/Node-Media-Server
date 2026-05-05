"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeSwitchServer = void 0;
const nms_core_1 = require("../../core");
const nms_server_1 = require("../../server");
const SwitchableBroadcastServer_js_1 = require("./SwitchableBroadcastServer.js");
const SwitchSession_js_1 = require("./SwitchSession.js");
const nms_protocol_1 = require("../../protocol");
class RawSubscriber extends nms_server_1.BaseAvSession {
    onPacketReceived;
    constructor(streamPath, onPacketReceived) {
        super({}, '127.0.0.1', nms_server_1.Protocol.RAW);
        this.onPacketReceived = onPacketReceived;
        this.streamPath = streamPath;
    }
    play() {
        this.onPlay();
    }
    sendBuffer(buffer) {
        if (buffer instanceof nms_protocol_1.AVPacket) {
            this.onPacketReceived(buffer);
        }
    }
    stop() {
        this.isStop = true;
        this.onClose();
    }
}
class NodeSwitchServer extends nms_server_1.NodeTaskServer {
    logger = nms_core_1.LoggerFactory.getLogger('Switch Server');
    switchBroadcasts = new Map();
    switchSessions = new Map();
    sourceToOutputs = new Map();
    sourceSubscribers = new Map();
    constructor() {
        super();
    }
    async run() {
        if (!this.config.switch || !this.config.switch.tasks) {
            this.logger.error(`Node Media Switch Server startup failed. Config switch is missing or has no tasks.`);
            return;
        }
        await super.run();
        const config = this.config.switch;
        for (const task of config.tasks) {
            const broadcast = new SwitchableBroadcastServer_js_1.SwitchableBroadcastServer();
            const fullPath = `/${task.app}/${task.name}`;
            this.switchBroadcasts.set(fullPath, broadcast);
            nms_core_1.context.broadcasts.set(fullPath, broadcast);
            // Create virtual publisher session to make it visible in the streams API
            const session = new SwitchSession_js_1.SwitchSession(this.config, fullPath);
            session.broadcast = broadcast;
            broadcast.setVirtualPublisher(session);
            session.startTime = Date.now();
            this.switchSessions.set(fullPath, session);
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
        this.logger.log('Node Media Switch Server started');
    }
    handleTaskMatching(session, _app, _name) {
        const sourcePath = session.streamPath;
        const matchedOutputs = this.sourceToOutputs.get(sourcePath);
        if (!matchedOutputs || matchedOutputs.size === 0)
            return;
        this.logger.log(`Source stream published: ${sourcePath}, subscribing for RAW packets for: ${Array.from(matchedOutputs).join(', ')}`);
        this.createRawSubscriber(session);
        // Requirement 1 & 2: Automatic activation and default source priority
        matchedOutputs.forEach(fullPath => {
            const broadcast = this.switchBroadcasts.get(fullPath);
            const config = this.config.switch;
            const task = config?.tasks.find(t => `/${t.app}/${t.name}` === fullPath);
            if (broadcast && task) {
                const currentActive = this.isSourceActive(broadcast.activeSource);
                if (!currentActive) {
                    // Requirement: No active source, switch immediately
                    this.logger.log(`Activating ${fullPath} immediately with ${sourcePath} (no current active source)`);
                    this.doSwitch(fullPath, sourcePath, false);
                }
                else if (sourcePath === task.defaultSource && !broadcast.isManualSwitch) {
                    // Requirement: Default source returned and current source was not manual
                    if (broadcast.activeSource !== sourcePath) {
                        this.logger.log(`Returning ${fullPath} to default source ${sourcePath}`);
                        this.doSwitch(fullPath, sourcePath, false);
                    }
                }
                this.updateBroadcastLiveness(broadcast);
            }
        });
    }
    createRawSubscriber(session) {
        const sourcePath = session.streamPath;
        const matchedOutputs = this.sourceToOutputs.get(sourcePath);
        if (!matchedOutputs || matchedOutputs.size === 0)
            return;
        if (this.sourceSubscribers.has(session.id))
            return;
        const subscriber = new RawSubscriber(sourcePath, (packet) => {
            matchedOutputs.forEach(fullPath => {
                const switchBroadcast = this.switchBroadcasts.get(fullPath);
                if (switchBroadcast) {
                    try {
                        switchBroadcast.handleSourcePacket(sourcePath, packet);
                    }
                    catch (err) {
                        this.logger.error(`Error handling source packet for ${fullPath}:`, err);
                    }
                }
            });
        });
        subscriber.play();
        this.sourceSubscribers.set(session.id, subscriber);
    }
    switch(fullPath, newSourcePath) {
        return this.doSwitch(fullPath, newSourcePath, true);
    }
    doSwitch(fullPath, newSourcePath, isManual) {
        const broadcast = this.switchBroadcasts.get(fullPath);
        if (!broadcast) {
            this.logger.warn(`Switch failed: output path ${fullPath} not found`);
            return false;
        }
        if (newSourcePath === null) {
            broadcast.switchSource(null, 0, isManual);
            this.updateBroadcastLiveness(broadcast);
            return true;
        }
        if (newSourcePath === fullPath) {
            this.logger.warn(`Switch failed: cannot switch ${fullPath} to itself`);
            return false;
        }
        const config = this.config.switch;
        const task = config?.tasks.find(t => `/${t.app}/${t.name}` === fullPath);
        const isLive = this.isSourceActive(newSourcePath);
        const isConfigured = task && (task.sources.includes(newSourcePath) || task.slatePath === newSourcePath);
        if (!isConfigured && (!isManual || !isLive)) {
            this.logger.warn(`Switch failed: source ${newSourcePath} not valid or not live for ${fullPath}`);
            return false;
        }
        if (isManual && !isConfigured) {
            this.ensureSubscription(newSourcePath, fullPath);
        }
        broadcast.switchSource(newSourcePath, task?.switchTimeout, isManual);
        return true;
    }
    ensureSubscription(sourcePath, outputPath) {
        if (!this.sourceToOutputs.has(sourcePath)) {
            this.sourceToOutputs.set(sourcePath, new Set());
        }
        this.sourceToOutputs.get(sourcePath).add(outputPath);
        for (const session of nms_core_1.context.sessions.values()) {
            if (session instanceof nms_server_1.BaseAvSession && session.streamPath === sourcePath && !session.isStop) {
                this.createRawSubscriber(session);
                break;
            }
        }
    }
    getStatus() {
        const tasks = [];
        this.switchBroadcasts.forEach((broadcast, fullPath) => {
            const config = this.config.switch;
            const taskConfig = config?.tasks.find(t => `/${t.app}/${t.name}` === fullPath);
            tasks.push({
                app: taskConfig?.app,
                name: taskConfig?.name,
                outputPath: fullPath,
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
    onDonePublish(session) {
        super.onDonePublish(session);
        const subscriber = this.sourceSubscribers.get(session.id);
        if (subscriber) {
            subscriber.stop();
            this.sourceSubscribers.delete(session.id);
        }
        if (session instanceof nms_server_1.BaseAvSession) {
            const sourcePath = session.streamPath;
            const fullPaths = this.sourceToOutputs.get(sourcePath);
            if (fullPaths) {
                fullPaths.forEach(fullPath => {
                    const broadcast = this.switchBroadcasts.get(fullPath);
                    if (broadcast) {
                        if (broadcast.activeSource === sourcePath) {
                            this.triggerFallback(fullPath, sourcePath);
                        }
                        this.updateBroadcastLiveness(broadcast);
                    }
                });
            }
        }
    }
    triggerFallback(fullPath, failedSourcePath) {
        const config = this.config.switch;
        const task = config?.tasks.find(t => `/${t.app}/${t.name}` === fullPath);
        if (!task)
            return;
        let targetSource;
        // Requirement 1: Switch over to the next available source
        // First try return to default if it's not the one that failed and it's active
        if (task.defaultSource && task.defaultSource !== failedSourcePath && this.isSourceActive(task.defaultSource)) {
            targetSource = task.defaultSource;
        }
        else {
            // Try any other configured source that is active
            targetSource = task.sources.find(s => s !== failedSourcePath && this.isSourceActive(s));
        }
        if (!targetSource && task.slatePath && task.slatePath !== failedSourcePath && this.isSourceActive(task.slatePath)) {
            targetSource = task.slatePath;
        }
        if (targetSource) {
            this.logger.log(`Triggering fallback for ${fullPath} to: ${targetSource}`);
            this.doSwitch(fullPath, targetSource, false);
        }
        else if (!task.slatePath) {
            this.logger.log(`No active fallback source and no slate declared for ${fullPath}. Terminating broadcast.`);
            this.doSwitch(fullPath, null, false);
        }
    }
    updateBroadcastLiveness(broadcast) {
        const active = this.isSourceActive(broadcast.activeSource);
        const fullPath = Array.from(this.switchBroadcasts.entries()).find(([_, b]) => b === broadcast)?.[0];
        if (!fullPath)
            return;
        const session = this.switchSessions.get(fullPath);
        if (session) {
            const wasActive = broadcast.publisher === session;
            if (active && !wasActive) {
                session.isStop = false;
                session.startTime = Date.now();
                broadcast.publisher = session;
                this.logger.log(`Switchable broadcast ${fullPath} is now LIVE`);
            }
            else if (!active && wasActive) {
                session.stop();
                broadcast.publisher = null;
                this.logger.log(`Switchable broadcast ${fullPath} is now OFFLINE`);
            }
        }
    }
    isSourceActive(sourcePath) {
        if (!sourcePath)
            return false;
        const sourceBroadcast = nms_core_1.context.broadcasts.get(sourcePath);
        return !!(sourceBroadcast && sourceBroadcast.publisher && !sourceBroadcast.publisher.isStop);
    }
    stop() {
        super.stop();
        this.switchSessions.forEach(session => session.stop());
        this.logger.log('Node Media Switch Server stopped');
    }
}
exports.NodeSwitchServer = NodeSwitchServer;

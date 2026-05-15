"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwitchSession = void 0;
const nms_protocol_1 = require("../../protocol");
const nms_shared_1 = require("../../shared");
const nms_server_1 = require("../../server");
const nms_core_1 = require("../../core");
class InternalSubscriber extends nms_server_1.BaseAvSession {
    sourcePath;
    parent;
    constructor(sourcePath, parent) {
        super({}, '127.0.0.1', nms_server_1.Protocol.RAW);
        this.sourcePath = sourcePath;
        this.parent = parent;
    }
    sendBuffer(buffer) {
        if (this.state === nms_shared_1.SessionState.STOPPED || this.state === nms_shared_1.SessionState.STOPPING)
            return;
        if (buffer instanceof nms_protocol_1.AVPacket) {
            this.parent.onSourcePacket(this.sourcePath, buffer);
        }
    }
    onOffline() {
        // Do nothing by default, NodeSwitchServer will handle it via onBroadcastOffline
    }
}
class SwitchSession extends nms_server_1.BaseAvSession {
    isOutputPublisher = false;
    subscribers = new Map();
    constructor(conf) {
        super(conf, '127.0.0.1', nms_server_1.Protocol.RAW);
        this.streamPath = conf.streamPath; // Output path
        this.streamApp = conf.app;
        this.streamName = conf.name;
        this.streamQuery = conf.args || {};
    }
    start() {
        super.start();
        this.startTime = Date.now();
        this.state = nms_shared_1.SessionState.RUNNING;
        // Register as publisher for the output broadcast when we actually have a source
        // this.setAsPublisher() will be called by SwitchableBroadcastServer.cutOver
    }
    stop(manual = false) {
        if (this.state === nms_shared_1.SessionState.STOPPED || this.state === nms_shared_1.SessionState.STOPPING) {
            return;
        }
        // Unsubscribe from all sources
        for (const sourcePath of Array.from(this.subscribers.keys())) {
            this.removeSource(sourcePath);
        }
        super.stop(manual);
        if (this.isOutputPublisher) {
            this.onClose(); // This will call donePublish on output broadcast
        }
        this.didStop();
    }
    addSource(sourcePath) {
        let sub = this.subscribers.get(sourcePath);
        if (!sub) {
            this.logger.log(`[Switch] creating source subscription: ${sourcePath}`);
            sub = new InternalSubscriber(sourcePath, this);
            this.subscribers.set(sourcePath, sub);
        }
        const sourceBroadcast = nms_core_1.context.broadcasts.get(sourcePath);
        if (sourceBroadcast && !sourceBroadcast.subscribers.has(sub.id)) {
            this.logger.log(`[Switch] subscribing to source: ${sourcePath}`);
            sourceBroadcast.play(sub);
        }
    }
    removeSource(sourcePath) {
        const sub = this.subscribers.get(sourcePath);
        if (sub) {
            this.logger.log(`[Switch] removing source subscription: ${sourcePath}`);
            const sourceBroadcast = nms_core_1.context.broadcasts.get(sourcePath);
            if (sourceBroadcast) {
                sourceBroadcast.donePlay(sub);
            }
            sub.stop();
            this.subscribers.delete(sourcePath);
        }
    }
    setAsPublisher() {
        if (!this.isOutputPublisher) {
            this.onPush(); // Register as publisher for the output broadcast
            this.isOutputPublisher = true;
        }
    }
    unsetAsPublisher() {
        if (this.isOutputPublisher) {
            this.isPublisher = false;
            this.isOutputPublisher = false;
            if (this.broadcast) {
                this.broadcast.publisher = null;
            }
        }
    }
    onSourcePacket(sourcePath, packet) {
        if (this.state === nms_shared_1.SessionState.STOPPED || this.state === nms_shared_1.SessionState.STOPPING)
            return;
        const broadcast = nms_core_1.context.broadcasts.get(this.streamPath);
        if (broadcast) {
            broadcast.handleSourcePacket(sourcePath, packet, this);
        }
    }
    onOffline() {
        // Persistent session - do not stop when output broadcast goes offline
    }
    sendBuffer(buffer) {
        // This session is a publisher, not a subscriber. 
        // Packets are received via onSourcePacket from internal subscribers.
    }
    forwardPacket(packet) {
        if (this.isOutputPublisher) {
            this.onPacket(packet);
        }
    }
}
exports.SwitchSession = SwitchSession;

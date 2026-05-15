import { Buffer } from 'node:buffer';
import { AVPacket } from '@vad-systems/nms-protocol';
import { SessionState, SwitchSessionConfig } from '@vad-systems/nms-shared';
import { AvBroadcastServer, BaseAvSession, Protocol } from '@vad-systems/nms-server';
import { context } from '@vad-systems/nms-core';
import type { SwitchableBroadcastServer } from './SwitchableBroadcastServer.js';

class InternalSubscriber extends BaseAvSession<any, any> {
    constructor(public readonly sourcePath: string, private parent: SwitchSession) {
        super({}, '127.0.0.1', Protocol.RAW);
    }

    public sendBuffer(buffer: Buffer | AVPacket) {
        if (this.state === SessionState.STOPPED || this.state === SessionState.STOPPING) return;

        if (buffer instanceof AVPacket) {
            this.parent.onSourcePacket(this.sourcePath, buffer);
        }
    }

    public onOffline() {
        // Do nothing by default, NodeSwitchServer will handle it via onBroadcastOffline
    }
}

export class SwitchSession extends BaseAvSession<any, SwitchSessionConfig> {
    private isOutputPublisher: boolean = false;
    private subscribers: Map<string, InternalSubscriber> = new Map();

    constructor(conf: SwitchSessionConfig) {
        super(conf, '127.0.0.1', Protocol.RAW);
        this.streamPath = conf.streamPath; // Output path
        this.streamApp = conf.app;
        this.streamName = conf.name;
        this.streamQuery = conf.args || {};
    }

    public start() {
        super.start();
        this.startTime = Date.now();
        this.state = SessionState.RUNNING;
        
        // Register as publisher for the output broadcast when we actually have a source
        // this.setAsPublisher() will be called by SwitchableBroadcastServer.cutOver
    }

    public stop(manual: boolean = false) {
        if (this.state === SessionState.STOPPED || this.state === SessionState.STOPPING) {
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

    public addSource(sourcePath: string) {
        let sub = this.subscribers.get(sourcePath);
        if (!sub) {
            this.logger.log(`[Switch] creating source subscription: ${sourcePath}`);
            sub = new InternalSubscriber(sourcePath, this);
            this.subscribers.set(sourcePath, sub);
        }

        const sourceBroadcast = context.broadcasts.get(sourcePath) as AvBroadcastServer<any, any>;
        if (sourceBroadcast && !sourceBroadcast.subscribers.has(sub.id)) {
            this.logger.log(`[Switch] subscribing to source: ${sourcePath}`);
            sourceBroadcast.play(sub);
        }
    }

    public removeSource(sourcePath: string) {
        const sub = this.subscribers.get(sourcePath);
        if (sub) {
            this.logger.log(`[Switch] removing source subscription: ${sourcePath}`);
            const sourceBroadcast = context.broadcasts.get(sourcePath) as AvBroadcastServer<any, any>;
            if (sourceBroadcast) {
                sourceBroadcast.donePlay(sub);
            }
            sub.stop();
            this.subscribers.delete(sourcePath);
        }
    }

    public setAsPublisher() {
        if (!this.isOutputPublisher) {
            this.onPush(); // Register as publisher for the output broadcast
            this.isOutputPublisher = true;
        }
    }

    public unsetAsPublisher() {
        if (this.isOutputPublisher) {
            this.isPublisher = false;
            this.isOutputPublisher = false;
            if (this.broadcast) {
                this.broadcast.publisher = null;
            }
        }
    }

    public onSourcePacket(sourcePath: string, packet: AVPacket) {
        if (this.state === SessionState.STOPPED || this.state === SessionState.STOPPING) return;

        const broadcast = context.broadcasts.get(this.streamPath) as SwitchableBroadcastServer<any, any>;
        if (broadcast) {
            broadcast.handleSourcePacket(sourcePath, packet, this);
        }
    }

    public onOffline() {
        // Persistent session - do not stop when output broadcast goes offline
    }

    public sendBuffer(buffer: Buffer | AVPacket) {
        // This session is a publisher, not a subscriber. 
        // Packets are received via onSourcePacket from internal subscribers.
    }

    public forwardPacket(packet: AVPacket) {
        if (this.isOutputPublisher) {
            this.onPacket(packet);
        }
    }
}


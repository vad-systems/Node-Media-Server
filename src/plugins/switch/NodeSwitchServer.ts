import { context, LoggerFactory } from '@vad-systems/nms-core';
import { NodeTaskServer, BaseAvSession, Protocol } from '@vad-systems/nms-server';
import { SwitchableBroadcastServer } from './SwitchableBroadcastServer.js';
import { SwitchSession } from './SwitchSession.js';
import { AVPacket } from '@vad-systems/nms-protocol';

class RawSubscriber extends BaseAvSession<any, any> {
    constructor(streamPath: string, private onPacketReceived: (packet: AVPacket) => void) {
        super({}, '127.0.0.1', Protocol.RAW);
        this.streamPath = streamPath;
    }

    public play() {
        this.onPlay();
    }

    public sendBuffer(buffer: Buffer | AVPacket) {
        if (buffer instanceof AVPacket) {
            this.onPacketReceived(buffer);
        }
    }

    public stop() {
        this.isStop = true;
        this.onClose();
    }
}

class NodeSwitchServer extends NodeTaskServer {
    private logger = LoggerFactory.getLogger('Switch Server');
    private switchBroadcasts: Map<string, SwitchableBroadcastServer<any, any>> = new Map();
    private switchSessions: Map<string, SwitchSession> = new Map();
    private sourceToOutputs: Map<string, Set<string>> = new Map();
    private sourceSubscribers: Map<string, RawSubscriber> = new Map();

    constructor() {
        super();
    }

    async run() {
        await super.run();

        const config = this.config.switch;
        if (!config || !config.tasks) {
            return;
        }

        for (const task of config.tasks) {
            const broadcast = new SwitchableBroadcastServer();
            const fullPath = `/${task.app}/${task.name}`;
            this.switchBroadcasts.set(fullPath, broadcast);
            context.broadcasts.set(fullPath, broadcast);

            // Create virtual publisher session to make it visible in the streams API
            const session = new SwitchSession(this.config, fullPath);
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
                this.sourceToOutputs.get(source)!.add(fullPath);
            }
        }

        this.logger.log('Node Media Switch Server started');
    }

    protected handleTaskMatching(session: BaseAvSession<any, any>, _app: string, _name: string) {
        const sourcePath = session.streamPath;
        const matchedOutputs = this.sourceToOutputs.get(sourcePath);
        if (!matchedOutputs || matchedOutputs.size === 0) return;

        this.logger.log(`Source stream published: ${sourcePath}, subscribing for RAW packets for: ${Array.from(matchedOutputs).join(', ')}`);

        const subscriber = new RawSubscriber(sourcePath, (packet: AVPacket) => {
            matchedOutputs.forEach(fullPath => {
                const switchBroadcast = this.switchBroadcasts.get(fullPath);
                if (switchBroadcast) {
                    try {
                        switchBroadcast.handleSourcePacket(sourcePath, packet);
                    } catch (err) {
                        this.logger.error(`Error handling source packet for ${fullPath}:`, err);
                    }
                }
            });
        });
        subscriber.play();
        this.sourceSubscribers.set(session.id, subscriber);

        // Requirement 3 & 4: Automatic activation and default source priority
        matchedOutputs.forEach(fullPath => {
            const broadcast = this.switchBroadcasts.get(fullPath);
            const config = this.config.switch;
            const task = config?.tasks.find(t => `/${t.app}/${t.name}` === fullPath);

            if (broadcast && task) {
                const currentActive = this.isSourceActive(broadcast.activeSource);

                if (!currentActive) {
                    // Requirement 3: No active source, switch immediately
                    this.logger.log(`Activating ${fullPath} immediately with ${sourcePath} (no current active source)`);
                    this.doSwitch(fullPath, sourcePath, false);
                } else if (sourcePath === task.defaultSource && !broadcast.isManualSwitch) {
                    // Requirement 4: Default source returned and current source was not manual
                    if (broadcast.activeSource !== sourcePath) {
                        this.logger.log(`Returning ${fullPath} to default source ${sourcePath}`);
                        this.doSwitch(fullPath, sourcePath, false);
                    }
                }

                this.updateBroadcastLiveness(broadcast);
            }
        });
    }

    public switch(fullPath: string, newSourcePath: string): boolean {
        return this.doSwitch(fullPath, newSourcePath, true);
    }

    private doSwitch(fullPath: string, newSourcePath: string, isManual: boolean): boolean {
        const broadcast = this.switchBroadcasts.get(fullPath);
        if (!broadcast) {
            this.logger.warn(`Switch failed: output path ${fullPath} not found`);
            return false;
        }

        const config = this.config.switch;
        const task = config?.tasks.find(t => `/${t.app}/${t.name}` === fullPath);
        const isSlate = task?.slatePath === newSourcePath;
        if (!task || (!task.sources.includes(newSourcePath) && !isSlate)) {
            this.logger.warn(`Switch failed: source ${newSourcePath} not configured for ${fullPath}`);
            return false;
        }

        broadcast.switchSource(newSourcePath, task.switchTimeout, isManual);
        return true;
    }

    public getStatus() {
        const tasks: any[] = [];
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

    protected onDonePublish(session: any) {
        super.onDonePublish(session);
        const subscriber = this.sourceSubscribers.get(session.id);
        if (subscriber) {
            subscriber.stop();
            this.sourceSubscribers.delete(session.id);
        }
        
        if (session instanceof BaseAvSession) {
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

    private triggerFallback(fullPath: string, failedSourcePath: string) {
        const config = this.config.switch;
        const task = config?.tasks.find(t => `/${t.app}/${t.name}` === fullPath);
        if (!task) return;

        let targetSource = task.defaultSource;
        if (targetSource === failedSourcePath) {
            targetSource = undefined;
        }

        if (targetSource) {
            this.logger.log(`Triggering fallback for ${fullPath} to defaultSource: ${targetSource}`);
            this.doSwitch(fullPath, targetSource, false);
        } else if (task.slatePath) {
            this.logger.log(`Triggering fallback for ${fullPath} to slatePath: ${task.slatePath}`);
            this.doSwitch(fullPath, task.slatePath, false);
        }
    }

    private updateBroadcastLiveness(broadcast: SwitchableBroadcastServer<any, any>) {
        const active = this.isSourceActive(broadcast.activeSource);
        const fullPath = Array.from(this.switchBroadcasts.entries()).find(([_, b]) => b === broadcast)?.[0];
        if (!fullPath) return;

        const session = this.switchSessions.get(fullPath);
        if (session) {
            const wasActive = broadcast.publisher === session;
            if (active && !wasActive) {
                session.isStop = false;
                session.startTime = Date.now();
                broadcast.publisher = session;
                this.logger.log(`Switchable broadcast ${fullPath} is now LIVE`);
            } else if (!active && wasActive) {
                session.isStop = true;
                broadcast.publisher = null;
                this.logger.log(`Switchable broadcast ${fullPath} is now OFFLINE`);
            }
        }
    }

    private isSourceActive(sourcePath: string | null): boolean {
        if (!sourcePath) return false;
        const sourceBroadcast = context.broadcasts.get(sourcePath);
        return !!(sourceBroadcast && sourceBroadcast.publisher && !sourceBroadcast.publisher.isStop);
    }

    stop() {
        super.stop();
        this.switchSessions.forEach(session => session.stop());
        this.logger.log('Node Media Switch Server stopped');
    }
}

export { NodeSwitchServer };

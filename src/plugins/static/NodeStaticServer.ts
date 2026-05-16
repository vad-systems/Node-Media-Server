import { context, LoggerFactory } from '@vad-systems/nms-core';
import { SessionState } from '@vad-systems/nms-shared';
import { NodeConfigurableServer } from '../../server/base/NodeConfigurableServer.js';
import { NodeStaticSession } from './NodeStaticSession.js';
import { StaticConfig, StaticTaskConfig, StaticSessionConfig } from '../../shared/types/config/static.js';

export class NodeStaticServer extends NodeConfigurableServer {
    private sessions: Map<string, NodeStaticSession> = new Map();
    private logger = LoggerFactory.getLogger('Static');

    constructor() {
        super();
        this.onPostDone = this.onPostDone.bind(this);
    }

    public async run() {
        await super.run();
        context.nodeEvent.on('postDone', this.onPostDone);

        const config = this.config.static;
        if (config && config.tasks) {
            for (const task of config.tasks) {
                this.startTask(task);
            }
        }
    }

    public stop() {
        super.stop();
        context.nodeEvent.off('postDone', this.onPostDone);
        for (const session of this.sessions.values()) {
            session.stop();
        }
        this.sessions.clear();
    }

    private startTask(task: StaticTaskConfig) {
        const streamPath = `/${task.app}/${task.name}`;
        if (this.sessions.has(streamPath)) {
            const session = this.sessions.get(streamPath)!;
            if (session.state === SessionState.STOPPED) {
                session.run();
            }
            return;
        }

        const sessionConfig: StaticSessionConfig = {
            ...task,
            ffmpeg: this.config.static?.ffmpeg || 'ffmpeg',
            streamPath,
            rtmpPort: this.config.rtmp?.port || 1935
        };

        const session = new NodeStaticSession(sessionConfig);
        this.sessions.set(streamPath, session);
        session.run();
    }

    private onPostDone(session: any) {
        if (session instanceof NodeStaticSession) {
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

    public getStatus() {
        const tasks: any[] = [];
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

    public async restart() {
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

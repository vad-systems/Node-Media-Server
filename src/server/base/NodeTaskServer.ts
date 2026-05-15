import _ from 'lodash';
import { context } from '@vad-systems/nms-core';
import { BroadcastServer } from './BroadcastServer.js';
import { BaseAvSession } from './BaseAvSession.js';
import { NodeConfigurableServer } from './NodeConfigurableServer.js';
import { NodeSession } from './NodeSession.js';

abstract class NodeTaskServer extends NodeConfigurableServer {
    protected constructor() {
        super();
        this.onPostPublish = this.onPostPublish.bind(this);
        this.onPostDone = this.onPostDone.bind(this);
    }

    public async run() {
        await super.run();
        context.nodeEvent.on('postPublish', this.onPostPublish);
        context.nodeEvent.on('postDone', this.onPostDone);
    }

    protected scanBroadcasts() {
        for (let [path, broadcast] of context.broadcasts) {
            if (broadcast.publisher) {
                const regRes = /\/(.*)\/(.*)/i.exec(path);
                if (regRes) {
                    const [app, name] = _.slice(regRes, 1);
                    this.handleTaskMatching(broadcast.publisher as BaseAvSession<any, any>, app, name);
                }
            }
        }
    }

    public stop() {
        super.stop();
        context.nodeEvent.off('postPublish', this.onPostPublish);
        context.nodeEvent.off('postDone', this.onPostDone);
    }

    protected onPostPublish(session: NodeSession<any, any>) {
        if (session.streamPath) {
            const regRes = /\/(.*)\/(.*)/i.exec(session.streamPath);
            if (regRes) {
                const [app, name] = _.slice(regRes, 1);
                this.handleTaskMatching(session as BaseAvSession<any, any>, app, name);
            }
        }
    }

    protected abstract handleTaskMatching(session: BaseAvSession<any, any>, app: string, name: string): void;

    protected onPostDone(session: NodeSession<any, any> | BroadcastServer<any, any>) {
        if (session instanceof NodeSession && session.isPublisher) {
            // BroadcastServer handles automatic cleanup of task-subscribers in donePublish.
            // Subclasses can implement extra cleanup logic if necessary.
        }
    }
}

export { NodeTaskServer };

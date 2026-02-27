import _ from 'lodash';
import { context } from '@vad-systems/nms-core';
import { BaseAvSession } from './BaseAvSession.js';
import { NodeConfigurableServer } from './NodeConfigurableServer.js';
import { NodeSession } from './NodeSession.js';

abstract class NodeTaskServer extends NodeConfigurableServer {
    protected constructor() {
        super();
        this.onPostPublish = this.onPostPublish.bind(this);
        this.onDonePublish = this.onDonePublish.bind(this);
    }

    public async run() {
        await super.run();
        context.nodeEvent.on('postPublish', this.onPostPublish);
        context.nodeEvent.on('donePublish', this.onDonePublish);
    }

    public stop() {
        super.stop();
        context.nodeEvent.off('postPublish', this.onPostPublish);
        context.nodeEvent.off('donePublish', this.onDonePublish);
    }

    protected onPostPublish(session: NodeSession<any, any>) {
        if (session instanceof BaseAvSession) {
            const regRes = /\/(.*)\/(.*)/gi.exec(session.streamPath);
            if (regRes) {
                const [app, name] = _.slice(regRes, 1);
                this.handleTaskMatching(session, app, name);
            }
        }
    }

    protected abstract handleTaskMatching(session: BaseAvSession<any, any>, app: string, name: string): void;

    protected onDonePublish(session: NodeSession<any, any>) {
        // BroadcastServer handles automatic cleanup of task-subscribers in donePublish.
        // Subclasses can implement extra cleanup logic if necessary.
    }
}

export { NodeTaskServer };

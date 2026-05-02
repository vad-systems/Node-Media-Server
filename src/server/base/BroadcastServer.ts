import { context, LoggerFactory, LoggerInstance } from '@vad-systems/nms-core';
import { SessionConfig, SessionID } from '@vad-systems/nms-shared';
import { parseInt } from 'lodash';
import crypto from 'node:crypto';
import { generateNewSessionID } from '../../core/utils.js';
import { NodeSession } from './NodeSession.js';

class BroadcastServer<C, S extends NodeSession<C, SessionConfig<C>>> {
    public readonly id: SessionID = null;
    public readonly logger: LoggerInstance;
    private _publisher: S | null;
    private _subscribers: Map<string, NodeSession<any, any>>;

    constructor() {
        this.id = generateNewSessionID();
        this.logger = LoggerFactory.getLogger(`BroadcastServer ${this.id}`);
        this._publisher = null;
        this._subscribers = new Map();
    }

    public get publisher(): S | null {
        return this._publisher;
    }

    public set publisher(value: S | null) {
        this._publisher = value;
        if (value) {
            this.logger.log(`[publisher] set: ${this._publisher.id}`);
        } else {
            this.logger.log(`[publisher] remove`);
        }
    }

    public get subscribers(): Map<string, NodeSession<any, any>> {
        return this._subscribers;
    }

    public set subscribers(value: Map<string, NodeSession<any, any>>) {
        this._subscribers = value;
    }

    public verifyAuth(authKey: string, session: S) {
        if (authKey === '') {
            return true;
        }
        let signStr = session.streamQuery?.sign as string; // TOOD
        if (signStr?.split('-')?.length !== 2) {
            return false;
        }
        let now = Date.now() / 1000 | 0;
        let exp = parseInt(signStr.split('-')[0]);
        let shv = signStr.split('-')[1];
        let str = session.streamPath + '-' + exp + '-' + authKey;
        if (exp < now) {
            return false;
        }
        let md5 = crypto.createHash('md5');
        let ohv = md5.update(str).digest('hex');
        return shv === ohv;
    };

    public postPlay(session: S) {
        context.nodeEvent.emit('prePlay', session);

        const config = context.configProvider.getConfig();

        if (config.auth?.play && session.remoteIp !== '') {
            if (!this.verifyAuth(config.auth?.secret, session)) {
                throw new Error(`play stream ${session.streamPath} authentication verification failed`);
            }
        }

        context.nodeEvent.emit('postPlay', session);

        session.startTime = Date.now();
        this.subscribers.set(session.id, session);
        context.idlePlayers.delete(session.id);
    }

    public donePlay(session: S) {
        session.endTime = Date.now();
        context.idlePlayers.add(session.id);
        context.nodeEvent.emit('donePlay', session);
        this.subscribers.delete(session.id);
    }

    public postPublish(session: S) {
        context.nodeEvent.emit('prePublish', session);

        const config = context.configProvider.getConfig();

        if (config.auth?.publish) {
            if (!this.verifyAuth(config.auth?.secret, session)) {
                throw new Error(`publish stream ${session.streamPath} authentication verification failed`);
            }
        }

        if (this.publisher == null) {
            session.startTime = Date.now();
            this.publisher = session;
            context.idlePlayers.delete(session.id);
        } else {
            throw new Error(`streamPath=${session.streamPath} already has a publisher`);
        }
        context.nodeEvent.emit('postPublish', session);
    }

    public donePublish(session: S) {
        if (session === this.publisher) {
            session.endTime = Date.now();
            context.idlePlayers.add(session.id);
            context.nodeEvent.emit('donePublish', session);

            this.subscribers.forEach((subscriber) => {
                subscriber.stop();
                this.subscribers.delete(subscriber.id);
            });

            this.publisher = null;
        }
    }
}

export { BroadcastServer };

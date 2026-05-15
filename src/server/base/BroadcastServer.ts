import { context, LoggerFactory, LoggerInstance } from '@vad-systems/nms-core';
import { BroadcastState, SessionConfig, SessionID, SessionState } from '@vad-systems/nms-shared';
import { parseInt } from 'lodash';
import crypto from 'node:crypto';
import { generateNewSessionID } from '../../core/utils.js';
import { NodeSession } from './NodeSession.js';

class BroadcastServer<C, S extends NodeSession<C, SessionConfig<C>>> {
    public readonly id: SessionID = null;
    public readonly logger: LoggerInstance;
    private _publisher: S | null;
    private _subscribers: Map<string, NodeSession<any, any>>;
    private _state: BroadcastState = BroadcastState.OFFLINE;

    constructor() {
        this.id = generateNewSessionID();
        this.logger = LoggerFactory.getLogger(`BroadcastServer ${this.id}`);
        this._publisher = null;
        this._subscribers = new Map();
    }

    public get state(): BroadcastState {
        return this._state;
    }

    protected set state(value: BroadcastState) {
        this._state = value;
    }

    public register() {
        this.state = BroadcastState.REGISTERING;
        context.nodeEvent.emit('preRegister', this);
        this.state = BroadcastState.REGISTERED;
        context.nodeEvent.emit('postRegister', this);
    }

    public get publisher(): S | null {
        return this._publisher;
    }

    public set publisher(value: S | null) {
        this._publisher = value;
        if (value) {
            this.logger.log(`[publisher] set publisher: ${value.id}`);
            this.state = BroadcastState.LIVE;
            context.nodeEvent.emit('live', this);
        } else {
            this.logger.log(`[publisher] remove publisher`);
            if (this.state !== BroadcastState.STOPPED && this.state !== BroadcastState.STOPPING) {
                this.state = BroadcastState.OFFLINE;
                context.nodeEvent.emit('offline', this);
            }
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
        let signStr = session.streamQuery?.sign as string; // TODO
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

    public play(session: S) {
        context.nodeEvent.emit('prePlay', session);

        const config = context.configProvider.getConfig();

        if (config.auth?.play && session.remoteIp !== '') {
            if (!this.verifyAuth(config.auth?.secret, session)) {
                throw new Error(`play stream ${session.streamPath} authentication verification failed`);
            }
        }

        this.logger.log(`[play] session start play: ${session.id}`);
        context.nodeEvent.emit('postPlay', session);

        session.startTime = Date.now();
        this.subscribers.set(session.id, session);
        context.idlePlayers.delete(session.id);
    }

    public donePlay(session: S) {
        this.logger.log(`[play] session stop play: ${session.id}`);
        context.idlePlayers.add(session.id);
        session.didStop();
        this.subscribers.delete(session.id);
    }

    public publish(session: S) {
        context.nodeEvent.emit('prePublish', session);

        const config = context.configProvider.getConfig();

        if (config.auth?.publish) {
            if (!this.verifyAuth(config.auth?.secret, session)) {
                throw new Error(`publish stream ${session.streamPath} authentication verification failed`);
            }
        }

        this.logger.log(`[publish] session start publish: ${session.id}`);
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
            this.logger.log(`[publish] session stop publish: ${session.id}`);

            context.idlePlayers.add(session.id);
            session.didStop();

            this.publisher = null;
        }
    }

    public stop(manual = false) {
        this.state = BroadcastState.STOPPING;
        context.nodeEvent.emit('preDone', this);

        if (this.publisher) {
            this.publisher.stop(manual);
        }

        this.publisher = null;

        this.state = BroadcastState.STOPPED;
        context.nodeEvent.emit('postDone', this);
    }
}

export { BroadcastServer };

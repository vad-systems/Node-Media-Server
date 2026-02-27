import EventEmitter from 'events';
import _ from 'lodash';
import { ParsedUrlQuery } from 'querystring';
import { NodeCoreUtils } from '../core/index.js';
import { SessionConfig, SessionID } from '../types/index.js';

type SessionEventMap = {
    end: [SessionID],
};


abstract class NodeSession<A, T extends SessionConfig<A>, E extends Record<keyof E, any[]> = SessionEventMap> extends EventEmitter<E> {
    protected conf: T;
    public readonly id: SessionID = null;
    public readonly remoteIp: string;
    public readonly TAG: string;

    private _streamPath: string | null = null;
    private _streamQuery: ParsedUrlQuery | null = null;

    private _startTime: number | null = null;
    private _endTime: number | null = null;

    protected constructor(conf: T, remoteIp: string, tag: string) {
        super();
        this.conf = _.cloneDeep(conf);
        this.id = NodeCoreUtils.generateNewSessionID();
        this.remoteIp = remoteIp;
        this.TAG = tag;
    }

    public getConfig<C extends T[keyof T] | A[keyof A]>(key: keyof T | keyof A = null): C | undefined {
        if (!key) {
            return;
        }
        if (typeof this.conf != 'object') {
            return;
        }
        if (this.conf.args && typeof this.conf.args === 'object' && this.conf.args[key as keyof A]) {
            return this.conf.args[key as keyof A] as C;
        }
        return this.conf[key as keyof T] as C;
    }

    public isLocal() {
        return this.remoteIp.startsWith('127.0.0.1')
            || this.remoteIp.startsWith('::1')
            || this.remoteIp.startsWith('::ffff:127.0.0.1');
    }

    public set streamPath(path: string) {
        this._streamPath = path;
    }

    public get streamPath() {
        return this._streamPath;
    }

    public set streamQuery(query: ParsedUrlQuery) {
        this._streamQuery = query;
    }

    public get streamQuery() {
        return this._streamQuery;
    }

    public set startTime(time: number) {
        this._startTime = time;
    }

    public get startTime() {
        return this._startTime;
    }

    public set endTime(time: number) {
        this._endTime = time;
    }

    public get endTime() {
        return this._endTime;
    }

    abstract stop(): void;

    abstract sendBuffer(buffer: Buffer): void;
}

export { NodeSession };

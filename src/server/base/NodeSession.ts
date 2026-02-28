import EventEmitter from 'events';
import _ from 'lodash';
import { ParsedUrlQuery } from 'querystring';
import { context, LoggerFactory, LoggerInstance, NodeCoreUtils } from '@vad-systems/nms-core';
import { SessionConfig, SessionID } from '@vad-systems/nms-shared';
import type { BroadcastServer } from './BroadcastServer.js';

type SessionEventMap = {
    end: [SessionID],
};


abstract class NodeSession<A, T extends SessionConfig<A>, E extends Record<keyof E, any[]> = SessionEventMap> extends EventEmitter<E> {
    public conf: T;
    public readonly id: SessionID = null;
    public readonly remoteIp: string;
    public readonly TAG: string;
    public readonly logger: LoggerInstance;

    private _streamPath: string | null = null;
    private _streamQuery: ParsedUrlQuery | null = null;

    private _streamApp: string | null = null;
    private _streamName: string | null = null;
    private _streamHost: string | null = null;
    private _isPublisher: boolean = false;

    private _broadcast: BroadcastServer<any, any> | null = null;

    private _startTime: number | null = null;
    private _endTime: number | null = null;

    private _inBytes: number = 0;
    private _outBytes: number = 0;

    private _isStop: boolean = false;

    protected constructor(conf: T, remoteIp: string, tag: string) {
        super();
        this.conf = _.cloneDeep(conf);
        this.id = NodeCoreUtils.generateNewSessionID();
        this.remoteIp = remoteIp;
        this.TAG = tag;
        this.logger = LoggerFactory.getLogger(`${this.TAG} ${this.id}`);
        context.sessions.set(this.id, this);
        context.idlePlayers.add(this.id);
        context.nodeEvent.emit('preConnect', this);
    }

    public cleanup() {
        context.sessions.delete(this.id);
        context.idlePlayers.delete(this.id);
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

    public isFfmpegTask() {
        return false;
    }

    protected set streamPath(path: string) {
        this._streamPath = path;
    }

    public get streamPath() {
        return this._streamPath;
    }

    protected set streamQuery(query: ParsedUrlQuery) {
        this._streamQuery = query;
    }

    public get streamQuery() {
        return this._streamQuery;
    }

    protected set streamApp(value: string | null) {
        this._streamApp = value;
    }

    public get streamApp(): string | null {
        return this._streamApp;
    }

    protected set streamName(value: string | null) {
        this._streamName = value;
    }

    public get streamName(): string | null {
        return this._streamName;
    }

    protected set streamHost(value: string | null) {
        this._streamHost = value;
    }

    public get streamHost(): string | null {
        return this._streamHost;
    }

    protected set isPublisher(value: boolean) {
        this._isPublisher = value;
    }

    public get isPublisher(): boolean {
        return this._isPublisher;
    }

    public set broadcast(value: BroadcastServer<any, any> | null) {
        this._broadcast = value;
    }

    public get broadcast(): BroadcastServer<any, any> | null {
        return this._broadcast;
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

    public set inBytes(value: number) {
        this._inBytes = value;
    }

    public get inBytes() {
        return this._inBytes;
    }

    public set outBytes(value: number) {
        this._outBytes = value;
    }

    public get outBytes() {
        return this._outBytes;
    }

    public get isStop(): boolean {
        return this._isStop;
    }

    public set isStop(value: boolean) {
        this._isStop = value;
    }

    abstract stop(): void;

    abstract sendBuffer(buffer: Buffer): void;
}

export { NodeSession };

import _ from "lodash";
import EventEmitter from 'events';
import NodeCoreUtils from './node_core_utils';
import {SessionConfig, SessionID} from "./types";

type SessionEventMap = {
    end: [SessionID],
};

abstract class NodeSession<A, T extends SessionConfig<A>, E extends Record<keyof E, any[]> = SessionEventMap> extends EventEmitter<E> {
    conf: T;
    id: SessionID = null;
    remoteIp: string;
    TAG: string;

    protected constructor(conf: T, remoteIp: string, tag: string) {
        super();
        this.conf = _.cloneDeep(conf);
        this.id = NodeCoreUtils.generateNewSessionID();
        this.remoteIp = remoteIp;
        this.TAG = tag;
    }

    getConfig<C extends T[keyof T] | A[keyof A]>(key: keyof T | keyof A = null): C | undefined {
        if (!key) return;
        if (typeof this.conf != 'object') return;
        if (this.conf.args && typeof this.conf.args === 'object' && this.conf.args[key as keyof A]) return this.conf.args[key as keyof A] as C;
        return this.conf[key as keyof T] as C;
    }

    isLocal() {
        return this.remoteIp === '127.0.0.1'
            || this.remoteIp === '::1'
            || this.remoteIp === '::ffff:127.0.0.1';
    }

    abstract stop(): void;
}

export { NodeSession };

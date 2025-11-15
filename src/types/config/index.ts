export * from './relay.js';
export * from './fission.js';
export * from './trans.js';
export * from './http.js';
export * from './rtmp.js';
import { LogType } from '../core.js';
import { FissionConfig } from './fission.js';
import { HttpConfig, HttpsConfig } from './http.js';
import { RelayConfig } from './relay.js';
import { RtmpConfig } from './rtmp.js';
import { TransConfig } from './trans.js';

export type ClusterConfig = {}

export type AuthConfig = {
    readonly api?: boolean;
    readonly api_user?: string;
    readonly api_pass?: string;
    readonly play?: boolean;
    readonly publish?: boolean;
    readonly secret?: string;
}

export type ConfigType = {
    readonly http?: HttpConfig;
    readonly https?: HttpsConfig;
    readonly rtmp?: RtmpConfig;
    readonly trans?: TransConfig;
    readonly relay?: RelayConfig;
    readonly fission?: FissionConfig;

    readonly cluster?: ClusterConfig;
    readonly auth?: AuthConfig;

    readonly logType?: LogType;
}

export class Config {
    readonly http?: HttpConfig;
    readonly https?: HttpsConfig;
    readonly rtmp?: RtmpConfig;
    readonly trans?: TransConfig;
    readonly relay?: RelayConfig;
    readonly fission?: FissionConfig;

    readonly cluster?: ClusterConfig;
    readonly auth?: AuthConfig;

    readonly logType?: LogType;

    constructor(config: ConfigType) {
        this.http = config.http;
        this.https = config.https;
        this.rtmp = config.rtmp;
        this.trans = config.trans;
        this.relay = config.relay;
        this.fission = config.fission;
        this.fission = config.fission;
        this.cluster = config.cluster;
        this.auth = config.auth;
        this.logType = config.logType;
    }
}

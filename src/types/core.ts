import EventEmitter from 'events';
import ConfigProvider from '../core/config.js';
import NodeMediaServer from '../NodeMediaServer.js';
import BroadcastServer from '../server/BroadcastServer.js';
import { NodeSession } from '../server/NodeSession.js';

export type SessionID = string;

export type Arguments = {
    [key: string]: any;
};

export type NodeEventMap = {
    preConnect: [NodeSession<any, any, any>];
    postConnect: [NodeSession<any, any, any>];
    prePlay: [NodeSession<any, any, any>];
    postPlay: [NodeSession<any, any, any>];
    donePlay: [NodeSession<any, any, any>];
    doneConnect: [NodeSession<any, any, any>];
    prePublish: [NodeSession<any, any, any>];
    postPublish: [NodeSession<any, any, any>];
    donePublish: [NodeSession<any, any, any>];
    configChanged: [];
    logMessage: any[];
    errorMessage: any[];
    warnMessage: any[];
    debugMessage: any[];
    ffDebugMessage: any[];
};

export enum LogType {
    NONE = 0,
    ERROR = 1,
    WARN = 2,
    NORMAL = 3,
    DEBUG = 4,
    FFDEBUG = 5,
}

export type Context = {
    server: NodeMediaServer | null,
    sessions: Map<SessionID, NodeSession<any, any, any>>;
    broadcasts: Map<string, BroadcastServer<any, any>>;
    idlePlayers: Set<SessionID>;
    nodeEvent: EventEmitter<NodeEventMap>;
    stat: {
        inbytes: number;
        outbytes: number;
        accepted: number;
    };
    configProvider: ConfigProvider;
    rollingLog: any[][];
};

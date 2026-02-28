import EventEmitter from 'events';
import type Http from 'http';
import type WebSocket from 'ws';
import type { ConfigProvider } from '@vad-systems/nms-core';
import type NodeMediaServer from '../../NodeMediaServer.js';
import type { BroadcastServer, NodeSession } from '@vad-systems/nms-server';

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
    wsConnection: [WebSocket, Http.IncomingMessage];
    logMessage: string[];
    errorMessage: string[];
    warnMessage: string[];
    debugMessage: string[];
    ffDebugMessage: string[];
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

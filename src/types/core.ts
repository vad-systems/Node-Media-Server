import EventEmitter from 'events';
import ConfigProvider from '../core/config.js';
import { NodeSession } from '../node_session.js';

export type SessionID = string;

export type Arguments = {
    [key: string]: any;
};

export type NodeEventMap = {
    preConnect: [SessionID, any];
    postConnect: [SessionID, any];
    prePlay: [SessionID, string, Arguments];
    postPlay: [SessionID, string, Arguments];
    donePlay: [SessionID, string, Arguments];
    doneConnect: [SessionID, any];
    prePublish: [SessionID, string, Arguments];
    postPublish: [SessionID, string, Arguments];
    donePublish: [SessionID, string, Arguments];
    configChanged: [];
    logMessage: any[];
    errorMessage: any[];
    debugMessage: any[];
    ffDebugMessage: any[];
};

export enum LogType {
    NONE = 0,
    ERROR = 1,
    NORMAL = 2,
    DEBUG = 3,
    FFDEBUG = 4,
}

export type Context = {
    sessions: Map<SessionID, NodeSession<any, any>>;
    publishers: Map<string, SessionID>;
    idlePlayers: Set<SessionID>;
    nodeEvent: EventEmitter<NodeEventMap>;
    stat: {
        inbytes: number;
        outbytes: number;
        accepted: number;
    };
    configProvider: ConfigProvider;
};

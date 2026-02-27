import EventEmitter from 'events';
import { BroadcastServer, NodeSession } from '@vad-systems/nms-server';
import { Context, NodeEventMap, SessionID } from '@vad-systems/nms-shared';
import ConfigProvider from './config.js';

let sessions: Map<SessionID, NodeSession<any, any>> = new Map();
let broadcasts: Map<SessionID, BroadcastServer<any, any>> = new Map();
let idlePlayers: Set<SessionID> = new Set();

let nodeEvent = new EventEmitter<NodeEventMap>();

let stat = {
    inbytes: 0,
    outbytes: 0,
    accepted: 0,
};

const configProvider = new ConfigProvider();

const context: Context = {
    server: null,
    sessions,
    broadcasts,
    idlePlayers,
    nodeEvent,
    stat,
    configProvider,
    rollingLog: [],
};

export default context;

import EventEmitter from 'events';
import { NodeSession } from '../node_session.js';
import { Context, NodeEventMap, SessionID } from '../types/index.js';
import ConfigProvider from './config.js';

let sessions: Map<SessionID, NodeSession<any, any>> = new Map();
let publishers: Map<string, SessionID> = new Map();
let idlePlayers: Set<SessionID> = new Set();

let nodeEvent = new EventEmitter<NodeEventMap>();

let stat = {
    inbytes: 0,
    outbytes: 0,
    accepted: 0,
};

const configProvider = new ConfigProvider();

const context: Context = {
    sessions,
    publishers,
    idlePlayers,
    nodeEvent,
    stat,
    configProvider,
};

export default context;

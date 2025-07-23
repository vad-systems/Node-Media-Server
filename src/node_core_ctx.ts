import {NodeEventMap, SessionID} from "./types";
import EventEmitter from "events";
import {NodeSession} from "./node_session";

let sessions: Map<SessionID, NodeSession<any, any>> = new Map();
let publishers: Map<string, SessionID> = new Map();
let idlePlayers: Set<SessionID> = new Set();

let nodeEvent = new EventEmitter<NodeEventMap>();

let stat = {
    inbytes: 0,
    outbytes: 0,
    accepted: 0,
};

const context = {
    sessions,
    publishers,
    idlePlayers,
    nodeEvent,
    stat,
};

export = context;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
let sessions = new Map();
let publishers = new Map();
let idlePlayers = new Set();
let nodeEvent = new events_1.default();
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
exports.default = context;

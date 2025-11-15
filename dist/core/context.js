"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const config_js_1 = __importDefault(require("./config.js"));
let sessions = new Map();
let publishers = new Map();
let idlePlayers = new Set();
let nodeEvent = new events_1.default();
let stat = {
    inbytes: 0,
    outbytes: 0,
    accepted: 0,
};
const configProvider = new config_js_1.default();
const context = {
    sessions,
    publishers,
    idlePlayers,
    nodeEvent,
    stat,
    configProvider,
};
exports.default = context;

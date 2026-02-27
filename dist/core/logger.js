"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const chalk_1 = __importDefault(require("chalk"));
const context_js_1 = __importDefault(require("./context.js"));
const index_js_1 = require("../types/index.js");
let logType = index_js_1.LogType.NORMAL;
const setLogType = (type) => {
    if (Object.values(index_js_1.LogType).indexOf(type) === -1) {
        return;
    }
    logType = type;
};
context_js_1.default.nodeEvent.on('configChanged', () => setLogType(context_js_1.default.configProvider.getConfig().logType));
const logTime = () => {
    let nowDate = new Date();
    return nowDate.toLocaleDateString() + ' ' + nowDate.toLocaleTimeString([], { hour12: false });
};
const log = (...args) => {
    context_js_1.default.nodeEvent.emit('logMessage', ...args);
    if (logType < index_js_1.LogType.NORMAL) {
        return;
    }
    console.log(logTime(), process.pid, chalk_1.default.bold.green('[INFO]'), ...args);
};
const error = (...args) => {
    context_js_1.default.nodeEvent.emit('errorMessage', ...args);
    if (logType < index_js_1.LogType.ERROR) {
        return;
    }
    console.log(logTime(), process.pid, chalk_1.default.bold.red('[ERROR]'), ...args);
};
const debug = (...args) => {
    context_js_1.default.nodeEvent.emit('debugMessage', ...args);
    if (logType < index_js_1.LogType.DEBUG) {
        return;
    }
    console.log(logTime(), process.pid, chalk_1.default.bold.blue('[DEBUG]'), ...args);
};
const ffdebug = (...args) => {
    context_js_1.default.nodeEvent.emit('ffDebugMessage', ...args);
    if (logType < index_js_1.LogType.FFDEBUG) {
        return;
    }
    console.log(logTime(), process.pid, chalk_1.default.bold.blue('[FFDEBUG]'), ...args);
};
const Logger = {
    setLogType,
    log, error, debug, ffdebug,
};
exports.Logger = Logger;

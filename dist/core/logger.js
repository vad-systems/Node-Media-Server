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
let rollingLogLength = 20;
const setLogType = (type) => {
    if (Object.values(index_js_1.LogType).indexOf(type) === -1) {
        return;
    }
    logType = type;
};
const setRollingLogLength = (logLength) => {
    rollingLogLength = logLength;
};
const addRollingLog = (...args) => {
    context_js_1.default.rollingLog.push([...args]);
    context_js_1.default.rollingLog = context_js_1.default.rollingLog.slice(-rollingLogLength);
};
context_js_1.default.nodeEvent.on('configChanged', () => {
    setLogType(context_js_1.default.configProvider.getConfig().logType);
    setRollingLogLength(context_js_1.default.configProvider.getConfig().rollingLogLength);
});
const logTime = () => {
    let nowDate = new Date();
    return nowDate.toLocaleDateString() + ' ' + nowDate.toLocaleTimeString([], { hour12: false });
};
const log = (...args) => {
    context_js_1.default.nodeEvent.emit('logMessage', ...args);
    if (logType < index_js_1.LogType.NORMAL) {
        return;
    }
    const logEntry = [logTime(), process.pid, chalk_1.default.bold.green('[INFO]'), ...args];
    console.log(...logEntry);
    addRollingLog(...logEntry);
};
const error = (...args) => {
    context_js_1.default.nodeEvent.emit('errorMessage', ...args);
    if (logType < index_js_1.LogType.ERROR) {
        return;
    }
    const logEntry = [logTime(), process.pid, chalk_1.default.bold.red('[ERROR]'), ...args];
    console.log(...logEntry);
    addRollingLog(...logEntry);
};
const debug = (...args) => {
    context_js_1.default.nodeEvent.emit('debugMessage', ...args);
    if (logType < index_js_1.LogType.DEBUG) {
        return;
    }
    const logEntry = [logTime(), process.pid, chalk_1.default.bold.blue('[DEBUG]'), ...args];
    console.log(...logEntry);
    addRollingLog(...logEntry);
};
const ffdebug = (...args) => {
    context_js_1.default.nodeEvent.emit('ffDebugMessage', ...args);
    if (logType < index_js_1.LogType.FFDEBUG) {
        return;
    }
    const logEntry = [logTime(), process.pid, chalk_1.default.bold.blue('[FFDEBUG]'), ...args];
    console.log(...logEntry);
    addRollingLog(...logEntry);
};
const Logger = {
    setLogType, setRollingLogLength,
    log, error, debug, ffdebug,
};
exports.Logger = Logger;

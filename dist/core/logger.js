"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LoggerInstance = exports.LoggerFactory = void 0;
const chalk_1 = __importDefault(require("chalk"));
const nms_shared_1 = require("../shared");
const context_js_1 = __importDefault(require("./context.js"));
let logType = nms_shared_1.LogType.NORMAL;
let rollingLogLength = 20;
const setLogType = (type) => {
    if (Object.values(nms_shared_1.LogType).indexOf(type) === -1) {
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
class LoggerInstance {
    prefix;
    constructor(prefix = '') {
        this.prefix = prefix;
    }
    format(args) {
        return this.prefix ? [`[${this.prefix}]`, ...args] : args;
    }
    error(...args) {
        const formattedArgs = this.format(args);
        context_js_1.default.nodeEvent.emit('errorMessage', ...formattedArgs);
        if (logType < nms_shared_1.LogType.ERROR) {
            return;
        }
        const logEntry = [logTime(), process.pid, chalk_1.default.bold.red('[ERROR]'), ...formattedArgs];
        console.log(...logEntry);
        addRollingLog(...logEntry);
    }
    warn(...args) {
        const formattedArgs = this.format(args);
        context_js_1.default.nodeEvent.emit('warnMessage', ...formattedArgs);
        if (logType < nms_shared_1.LogType.WARN) {
            return;
        }
        const logEntry = [logTime(), process.pid, chalk_1.default.bold.yellow('[WARN]'), ...formattedArgs];
        console.log(...logEntry);
        addRollingLog(...logEntry);
    }
    log(...args) {
        const formattedArgs = this.format(args);
        context_js_1.default.nodeEvent.emit('logMessage', ...formattedArgs);
        if (logType < nms_shared_1.LogType.NORMAL) {
            return;
        }
        const logEntry = [logTime(), process.pid, chalk_1.default.bold.green('[INFO]'), ...formattedArgs];
        console.log(...logEntry);
        addRollingLog(...logEntry);
    }
    debug(...args) {
        const formattedArgs = this.format(args);
        context_js_1.default.nodeEvent.emit('debugMessage', ...formattedArgs);
        if (logType < nms_shared_1.LogType.DEBUG) {
            return;
        }
        const logEntry = [logTime(), process.pid, chalk_1.default.bold.blue('[DEBUG]'), ...formattedArgs];
        console.log(...logEntry);
        addRollingLog(...logEntry);
    }
    ffdebug(...args) {
        const formattedArgs = this.format(args);
        context_js_1.default.nodeEvent.emit('ffDebugMessage', ...formattedArgs);
        if (logType < nms_shared_1.LogType.FFDEBUG) {
            return;
        }
        const logEntry = [logTime(), process.pid, chalk_1.default.bold.blue('[FFDEBUG]'), ...formattedArgs];
        console.log(...logEntry);
        addRollingLog(...logEntry);
    }
}
exports.LoggerInstance = LoggerInstance;
class LoggerFactory {
    static getLogger(prefix = '') {
        return new LoggerInstance(prefix);
    }
}
exports.LoggerFactory = LoggerFactory;
const defaultLogger = new LoggerInstance();
const Logger = {
    setLogType, setRollingLogLength,
    log: defaultLogger.log.bind(defaultLogger),
    warn: defaultLogger.warn.bind(defaultLogger),
    error: defaultLogger.error.bind(defaultLogger),
    debug: defaultLogger.debug.bind(defaultLogger),
    ffdebug: defaultLogger.ffdebug.bind(defaultLogger),
};
exports.Logger = Logger;
exports.default = Logger;

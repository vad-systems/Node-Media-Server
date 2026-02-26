import chalk from 'chalk';
import context from './context.js';
import { LogType } from '../types/index.js';

let logType = LogType.NORMAL;
let rollingLogLength = 20;

const setLogType = (type: LogType) => {
    if (Object.values(LogType).indexOf(type) === -1) {
        return;
    }

    logType = type;
};

const setRollingLogLength = (logLength: number) => {
    rollingLogLength = logLength;
};

const addRollingLog = (...args: any[]) => {
    context.rollingLog.push([...args]);
    context.rollingLog = context.rollingLog.slice(-rollingLogLength);
};

context.nodeEvent.on('configChanged', () => {
    setLogType(context.configProvider.getConfig().logType);
    setRollingLogLength(context.configProvider.getConfig().rollingLogLength);
});

const logTime = () => {
    let nowDate = new Date();
    return nowDate.toLocaleDateString() + ' ' + nowDate.toLocaleTimeString([], { hour12: false });
};

const log = (...args: any[]) => {
    context.nodeEvent.emit('logMessage', ...args);
    if (logType < LogType.NORMAL) {
        return;
    }

    const logEntry = [logTime(), process.pid, chalk.bold.green('[INFO]'), ...args]
    console.log(...logEntry);
    addRollingLog(...logEntry);
};

const error = (...args: any[]) => {
    context.nodeEvent.emit('errorMessage', ...args);
    if (logType < LogType.ERROR) {
        return;
    }

    const logEntry = [logTime(), process.pid, chalk.bold.red('[ERROR]'), ...args]
    console.log(...logEntry);
    addRollingLog(...logEntry);
};

const warn = (...args: any[]) => {
    context.nodeEvent.emit('warnMessage', ...args);
    if (logType < LogType.ERROR) {
        return;
    }

    const logEntry = [logTime(), process.pid, chalk.bold.yellow('[WARN]'), ...args]
    console.log(...logEntry);
    addRollingLog(...logEntry);
};

const debug = (...args: any[]) => {
    context.nodeEvent.emit('debugMessage', ...args);
    if (logType < LogType.DEBUG) {
        return;
    }

    const logEntry = [logTime(), process.pid, chalk.bold.blue('[DEBUG]'), ...args]
    console.log(...logEntry);
    addRollingLog(...logEntry);
};

const ffdebug = (...args: any[]) => {
    context.nodeEvent.emit('ffDebugMessage', ...args);
    if (logType < LogType.FFDEBUG) {
        return;
    }

    const logEntry = [logTime(), process.pid, chalk.bold.blue('[FFDEBUG]'), ...args]
    console.log(...logEntry);
    addRollingLog(...logEntry);
};

const Logger = {
    setLogType, setRollingLogLength,

    log, warn, error, debug, ffdebug,
};

export { Logger };
export default Logger;

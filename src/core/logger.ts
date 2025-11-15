import chalk from 'chalk';
import context from './context.js';
import { LogType } from '../types/index.js';

let logType = LogType.NORMAL;

const setLogType = (type: LogType) => {
    if (Object.values(LogType).indexOf(type) === -1) {
        return;
    }

    logType = type;
};

context.nodeEvent.on('configChanged', () => setLogType(context.configProvider.getConfig().logType));

const logTime = () => {
    let nowDate = new Date();
    return nowDate.toLocaleDateString() + ' ' + nowDate.toLocaleTimeString([], { hour12: false });
};

const log = (...args: any[]) => {
    context.nodeEvent.emit('logMessage', ...args);
    if (logType < LogType.NORMAL) {
        return;
    }

    console.log(logTime(), process.pid, chalk.bold.green('[INFO]'), ...args);
};

const error = (...args: any[]) => {
    context.nodeEvent.emit('errorMessage', ...args);
    if (logType < LogType.ERROR) {
        return;
    }

    console.log(logTime(), process.pid, chalk.bold.red('[ERROR]'), ...args);
};

const debug = (...args: any[]) => {
    context.nodeEvent.emit('debugMessage', ...args);
    if (logType < LogType.DEBUG) {
        return;
    }

    console.log(logTime(), process.pid, chalk.bold.blue('[DEBUG]'), ...args);
};

const ffdebug = (...args: any[]) => {
    context.nodeEvent.emit('ffDebugMessage', ...args);
    if (logType < LogType.FFDEBUG) {
        return;
    }

    console.log(logTime(), process.pid, chalk.bold.blue('[FFDEBUG]'), ...args);
};

const Logger = {
    setLogType,

    log, error, debug, ffdebug,
};

export { Logger };

import chalk from 'chalk';
import { LogType } from '../types/index.js';
import context from './context.js';

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

class LoggerInstance {
    constructor(private prefix: string = '') {
    }

    private format(args: any[]) {
        return this.prefix ? [`[${this.prefix}]`, ...args] : args;
    }

    error(...args: any[]) {
        const formattedArgs = this.format(args);
        context.nodeEvent.emit('errorMessage', ...formattedArgs);
        if (logType < LogType.ERROR) {
            return;
        }

        const logEntry = [logTime(), process.pid, chalk.bold.red('[ERROR]'), ...formattedArgs];
        console.log(...logEntry);
        addRollingLog(...logEntry);
    }

    warn(...args: any[]) {
        const formattedArgs = this.format(args);
        context.nodeEvent.emit('warnMessage', ...formattedArgs);
        if (logType < LogType.WARN) {
            return;
        }

        const logEntry = [logTime(), process.pid, chalk.bold.yellow('[WARN]'), ...formattedArgs];
        console.log(...logEntry);
        addRollingLog(...logEntry);
    }

    log(...args: any[]) {
        const formattedArgs = this.format(args);
        context.nodeEvent.emit('logMessage', ...formattedArgs);
        if (logType < LogType.NORMAL) {
            return;
        }

        const logEntry = [logTime(), process.pid, chalk.bold.green('[INFO]'), ...formattedArgs];
        console.log(...logEntry);
        addRollingLog(...logEntry);
    }

    debug(...args: any[]) {
        const formattedArgs = this.format(args);
        context.nodeEvent.emit('debugMessage', ...formattedArgs);
        if (logType < LogType.DEBUG) {
            return;
        }

        const logEntry = [logTime(), process.pid, chalk.bold.blue('[DEBUG]'), ...formattedArgs];
        console.log(...logEntry);
        addRollingLog(...logEntry);
    }

    ffdebug(...args: any[]) {
        const formattedArgs = this.format(args);
        context.nodeEvent.emit('ffDebugMessage', ...formattedArgs);
        if (logType < LogType.FFDEBUG) {
            return;
        }

        const logEntry = [logTime(), process.pid, chalk.bold.blue('[FFDEBUG]'), ...formattedArgs];
        console.log(...logEntry);
        addRollingLog(...logEntry);
    }
}

export class LoggerFactory {
    public static getLogger(prefix: string = ''): LoggerInstance {
        return new LoggerInstance(prefix);
    }
}

const defaultLogger = new LoggerInstance();

const Logger = {
    setLogType, setRollingLogLength,
    log: defaultLogger.log.bind(defaultLogger),
    warn: defaultLogger.warn.bind(defaultLogger),
    error: defaultLogger.error.bind(defaultLogger),
    debug: defaultLogger.debug.bind(defaultLogger),
    ffdebug: defaultLogger.ffdebug.bind(defaultLogger),
};

export { LoggerInstance, Logger };
export default Logger;

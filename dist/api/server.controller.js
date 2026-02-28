"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const os_1 = __importDefault(require("os"));
const nms_shared_1 = require("../shared");
const Package = require('../../package.json');
function cpuAverage() {
    let totalIdle = 0, totalTick = 0;
    let cpus = os_1.default.cpus();
    for (let i = 0, len = cpus.length; i < len; i++) {
        let cpu = cpus[i];
        for (let type in cpu.times) {
            totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
    }
    return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
}
function percentageCPU() {
    return new Promise(function (resolve) {
        let startMeasure = cpuAverage();
        setTimeout(() => {
            let endMeasure = cpuAverage();
            let idleDifference = endMeasure.idle - startMeasure.idle;
            let totalDifference = endMeasure.total - startMeasure.total;
            let percentageCPU = 100 - ~~(100 * idleDifference / totalDifference);
            resolve(percentageCPU);
        }, 100);
    });
}
function getSessionsInfo(sessions) {
    let info = {
        inbytes: 0,
        outbytes: 0,
        rtmp: 0,
        http: 0,
        ws: 0,
    };
    for (let session of sessions.values()) {
        if (session.isFfmpegTask()) {
            continue;
        }
        info.inbytes += session.inBytes;
        info.outbytes += session.outBytes;
        info.rtmp += session.TAG === 'rtmp' ? 1 : 0;
        info.http += session.TAG === 'http-flv' ? 1 : 0;
        info.ws += session.TAG === 'websocket-flv' ? 1 : 0;
    }
    return info;
}
function getConfig(req, res, next) {
    const config = this.configProvider.getConfig();
    const { http, https, rtmp, trans, relay, fission, } = config;
    const response = {
        http: {
            mediaroot: http?.mediaroot,
            port: http?.port,
            allow_origin: http?.allow_origin,
        },
        https: {
            port: https?.port,
        },
        rtmp: {
            port: rtmp?.port,
            chunk_size: rtmp?.chunk_size,
            ping: rtmp?.ping,
            ping_timeout: rtmp?.ping_timeout,
            gop_cache: rtmp?.gop_cache,
        },
        trans,
        relay,
        fission,
    };
    res.json(response);
}
function updateConfig(req, res, next) {
    const currentConfig = this.configProvider.getConfig();
    const newConfigData = lodash_1.default.merge({}, currentConfig, req.body);
    const newConfig = new nms_shared_1.Config(newConfigData);
    this.configProvider.setConfig(newConfig);
    res.json(this.configProvider.getConfig());
}
async function startServer(req, res, next) {
    const serverName = req.params.server;
    const servers = {
        rtmp: this.server.rtmpServer,
        av: this.server.avServer,
        trans: this.server.transServer,
        relay: this.server.relayServer,
        fission: this.server.fissionServer,
    };
    const server = servers[serverName];
    if (server) {
        if (!server.isRunning()) {
            await server.run();
            res.json({ status: 'ok' });
        }
        else {
            res.status(400).json({ error: 'Server already running' });
        }
    }
    else {
        res.status(404).json({ error: 'Server not found' });
    }
}
function stopServer(req, res, next) {
    const serverName = req.params.server;
    const servers = {
        rtmp: this.server.rtmpServer,
        av: this.server.avServer,
        trans: this.server.transServer,
        relay: this.server.relayServer,
        fission: this.server.fissionServer,
    };
    const server = servers[serverName];
    if (server) {
        if (server.isRunning()) {
            server.stop();
            res.json({ status: 'ok' });
        }
        else {
            res.status(400).json({ error: 'Server not running' });
        }
    }
    else {
        res.status(404).json({ error: 'Server not found' });
    }
}
function getStatus(req, res, next) {
    const response = {
        av: {
            running: this.server.avServer?.isRunning() || false,
        },
        fission: {
            running: this.server.fissionServer?.isRunning() || false,
        },
        http: {
            running: this.server.httpServer?.isRunning() || false,
        },
        relay: {
            running: this.server.relayServer?.isRunning() || false,
        },
        rtmp: {
            running: this.server.rtmpServer?.isRunning() || false,
        },
        trans: {
            running: this.server.transServer?.isRunning() || false,
        },
    };
    res.json(response);
}
function getInfo(req, res, next) {
    let s = this.sessions;
    percentageCPU().then((cpuload) => {
        let sinfo = getSessionsInfo(s);
        let info = {
            os: {
                arch: os_1.default.arch(),
                platform: os_1.default.platform(),
                release: os_1.default.release(),
            },
            cpu: {
                num: os_1.default.cpus().length,
                load: cpuload,
                model: os_1.default.cpus()[0].model,
                speed: os_1.default.cpus()[0].speed,
            },
            mem: {
                total: os_1.default.totalmem(),
                free: os_1.default.freemem(),
            },
            net: {
                inbytes: this.stat.inbytes + sinfo.inbytes,
                outbytes: this.stat.outbytes + sinfo.outbytes,
            },
            nodejs: {
                uptime: Math.floor(process.uptime()),
                version: process.version,
                mem: process.memoryUsage(),
            },
            clients: {
                accepted: this.stat.accepted,
                active: this.sessions.size - this.idlePlayers.size,
                idle: this.idlePlayers.size,
                rtmp: sinfo.rtmp,
                http: sinfo.http,
                ws: sinfo.ws,
            },
            version: Package.version,
        };
        res.json(info);
    });
}
exports.default = {
    getInfo,
    getStatus,
    getConfig,
    updateConfig,
    startServer,
    stopServer,
};

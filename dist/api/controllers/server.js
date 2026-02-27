"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const os_1 = __importDefault(require("os"));
const index_js_1 = require("../../types/index.js");
const Package = require('../../../package.json');
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
            mediaroot: http === null || http === void 0 ? void 0 : http.mediaroot,
            port: http === null || http === void 0 ? void 0 : http.port,
            allow_origin: http === null || http === void 0 ? void 0 : http.allow_origin,
        },
        https: {
            port: https === null || https === void 0 ? void 0 : https.port,
        },
        rtmp: {
            port: rtmp === null || rtmp === void 0 ? void 0 : rtmp.port,
            chunk_size: rtmp === null || rtmp === void 0 ? void 0 : rtmp.chunk_size,
            ping: rtmp === null || rtmp === void 0 ? void 0 : rtmp.ping,
            ping_timeout: rtmp === null || rtmp === void 0 ? void 0 : rtmp.ping_timeout,
            gop_cache: rtmp === null || rtmp === void 0 ? void 0 : rtmp.gop_cache,
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
    const newConfig = new index_js_1.Config(newConfigData);
    this.configProvider.setConfig(newConfig);
    res.json(this.configProvider.getConfig());
}
function startServer(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
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
                yield server.run();
                res.json({ status: 'ok' });
            }
            else {
                res.status(400).json({ error: 'Server already running' });
            }
        }
        else {
            res.status(404).json({ error: 'Server not found' });
        }
    });
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
    var _a, _b, _c, _d, _e, _f;
    const response = {
        av: {
            running: ((_a = this.server.avServer) === null || _a === void 0 ? void 0 : _a.isRunning()) || false,
        },
        fission: {
            running: ((_b = this.server.fissionServer) === null || _b === void 0 ? void 0 : _b.isRunning()) || false,
        },
        http: {
            running: ((_c = this.server.httpServer) === null || _c === void 0 ? void 0 : _c.isRunning()) || false,
        },
        relay: {
            running: ((_d = this.server.relayServer) === null || _d === void 0 ? void 0 : _d.isRunning()) || false,
        },
        rtmp: {
            running: ((_e = this.server.rtmpServer) === null || _e === void 0 ? void 0 : _e.isRunning()) || false,
        },
        trans: {
            running: ((_f = this.server.transServer) === null || _f === void 0 ? void 0 : _f.isRunning()) || false,
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

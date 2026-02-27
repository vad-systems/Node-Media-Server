import OS from 'os';
import { NextFunction, Request, Response } from 'express';
import { Context } from '../../types/index.js';

const Package = require("../../../package.json");

function cpuAverage() {
    let totalIdle = 0, totalTick = 0;
    let cpus = OS.cpus();

    for (let i = 0, len = cpus.length; i < len; i++) {
        let cpu = cpus[i];
        for (let type in cpu.times) {
            totalTick += (cpu.times as any)[type];
        }
        totalIdle += cpu.times.idle;
    }

    return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
}

function percentageCPU(): Promise<number> {
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

function getSessionsInfo(sessions: Context['sessions']) {
    let info = {
        inbytes: 0,
        outbytes: 0,
        rtmp: 0,
        http: 0,
        ws: 0,
    };

    for (let session of sessions.values()) {
        if (session.TAG === "relay") {
            continue;
        }
        if (session.TAG === "fission") {
            continue;
        }
        let socket = session.TAG === "rtmp" ? (session as any).socket : (session as any).req.socket;
        info.inbytes += socket.bytesRead;
        info.outbytes += socket.bytesWritten;
        info.rtmp += session.TAG === "rtmp" ? 1 : 0;
        info.http += session.TAG === "http-flv" ? 1 : 0;
        info.ws += session.TAG === "websocket-flv" ? 1 : 0;
    }

    return info;
}

function getConfig(this: Context, req: Request, res: Response, next: NextFunction) {
    const config = this.configProvider.getConfig();
    const {
        http, https,
        rtmp,
        trans,
        relay,
        fission
    } = config;

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

function updateConfig(this: Context, req: Request, res: Response, next: NextFunction) {
    throw new Error("Not implemented");
}

function getStatus(this: Context, req: Request, res: Response, next: NextFunction) {
    const response = {
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

function getInfo(this: Context, req: Request, res: Response, next: NextFunction) {
    let s = this.sessions;
    percentageCPU().then((cpuload) => {
        let sinfo = getSessionsInfo(s);
        let info = {
            os: {
                arch: OS.arch(),
                platform: OS.platform(),
                release: OS.release(),
            },
            cpu: {
                num: OS.cpus().length,
                load: cpuload,
                model: OS.cpus()[0].model,
                speed: OS.cpus()[0].speed,
            },
            mem: {
                totle: OS.totalmem(),
                free: OS.freemem(),
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

export default {
    getInfo,
    getStatus,
    getConfig,
    updateConfig,
};

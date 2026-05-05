import { NodeConfigurableServer } from '@vad-systems/nms-server';
import { Config, Context, obfuscateUrl } from '@vad-systems/nms-shared';
import { NextFunction, Request, Response } from 'express';
import _ from 'lodash';
import OS from 'os';

const Package = require('../../package.json');

function cpuAverage() {
    let totalIdle = 0, totalTick = 0;
    let cpus = OS.cpus();

    for (let i = 0, len = cpus.length; i < len; i++) {
        let cpu = cpus[i];
        for (let type in cpu.times) {
            totalTick += (
                cpu.times as Record<string, number>
            )[type];
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

            let percentageCPU = 100 - ~~(
                100 * idleDifference / totalDifference
            );
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

function getConfig(this: Context, req: Request, res: Response, next: NextFunction) {
    const config = _.cloneDeep(this.configProvider.getConfig());
    if (config.relay && config.relay.tasks) {
        for (const task of config.relay.tasks) {
            if (task.edge) {
                if (typeof task.edge === 'string') {
                    (
                        task as any
                    ).edge = obfuscateUrl(task.edge);
                } else if (typeof task.edge === 'object') {
                    for (const key in task.edge) {
                        (
                            task.edge as any
                        )[key] = obfuscateUrl((
                            task.edge as any
                        )[key]);
                    }
                }
            }
        }
    }
    res.json(config);
}

function updateConfig(this: Context, req: Request<{}, Config, Config>, res: Response, next: NextFunction) {
    const currentConfig = this.configProvider.getConfig();
    const newConfigData = _.merge({}, currentConfig, req.body);
    const newConfig = new Config(newConfigData);
    this.configProvider.setConfig(newConfig);
    res.json(this.configProvider.getConfig());
}

async function startServer(this: Context, req: Request<{ server: string }>, res: Response, next: NextFunction) {
    const serverName = req.params.server;
    const servers: Record<string, NodeConfigurableServer | undefined> = {
        rtmp: this.server?.rtmpServer,
        av: this.server?.avServer,
        trans: this.server?.transServer,
        task: this.server?.transServer,
        relay: this.server?.relayServer,
        fission: this.server?.fissionServer,
        switch: this.server?.switchServer,
    };

    const server = servers[serverName];

    if (server) {
        if (!server.isRunning()) {
            await server.run();
            res.json({ status: 'ok' });
        } else {
            res.status(400).json({ error: 'Server already running' });
        }
    } else {
        res.status(404).json({ error: 'Server not found' });
    }
}

function stopServer(this: Context, req: Request<{ server: string }>, res: Response, next: NextFunction) {
    const serverName = req.params.server;
    const servers: Record<string, NodeConfigurableServer | undefined> = {
        rtmp: this.server?.rtmpServer,
        av: this.server?.avServer,
        trans: this.server?.transServer,
        relay: this.server?.relayServer,
        fission: this.server?.fissionServer,
        switch: this.server?.switchServer,
    };

    const server = servers[serverName];

    if (server) {
        if (server.isRunning()) {
            server.stop();
            res.json({ status: 'ok' });
        } else {
            res.status(400).json({ error: 'Server not running' });
        }
    } else {
        res.status(404).json({ error: 'Server not found' });
    }
}

function getStatus(this: Context, req: Request, res: Response, next: NextFunction) {
    const response = {
        av: {
            running: this.server?.avServer?.isRunning() || false,
        },
        fission: {
            running: this.server?.fissionServer?.isRunning() || false,
        },
        relay: {
            running: this.server?.relayServer?.isRunning() || false,
        },
        rtmp: {
            running: this.server?.rtmpServer?.isRunning() || false,
        },
        trans: {
            running: this.server?.transServer?.isRunning() || false,
        },
        task: {
            running: this.server?.transServer?.isRunning() || false,
        },
        switch: {
            running: this.server?.switchServer?.isRunning() || false,
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
                total: OS.totalmem(),
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
    startServer,
    stopServer,
};
